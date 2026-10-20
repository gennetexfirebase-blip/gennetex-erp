import { supabase } from './supabase';

/**
 * Гүйцэтгэл — Google Sheet-ийн ажлууд (perf_jobs), латин нэр → ажилтан (perf_aliases),
 * төрөл бүрийн үнэлгээ (perf_rates). guitsetgel.gennetex.com ба sanhuu-ийн цалинд.
 * Хамт ч, ганцаараа ч хийсэн ажил оролцсон инженер бүрт бүтэн 1 ажил.
 */

export type PerfPerson = {
  user_id: string;
  name: string;
  department: string | null;
  aliases: string[] | null;
  jobs: number;
  days: number;
  cable: number;
  solo: number;
  pair: number;
  kinds: Record<string, number> | null;
  amount: number;
};
export type PerfRate = { kind: string; label: string | null; amount: number };
export type PerfSummary = { people: PerfPerson[]; unmapped: { alias: string; jobs: number }[]; jobs: number; rates: PerfRate[]; last_sync_at: string | null };
export type PerfJob = { id: number; work_date: string; kind: string; engineers: string[]; job_time: string | null; cable: boolean };
export type PerfAlias = { alias: string; user_id: string | null; ignored: boolean };

/** Төрлийн монгол нэр. */
export const KIND_LABEL: Record<string, string> = {
  complain: 'Гомдол',
  'new customer': 'Шинэ хэрэглэгч',
  reinstallation: 'Дахин суурилуулалт',
  'add additional box': 'Нэмэлт бокс',
  damage: 'Гэмтэл',
  cable: 'Кабель татсан (нэмэгдэл)',
};
export const kindLabel = (k: string) => KIND_LABEL[k] || k;

const err = (e: { message: string } | null) => {
  if (!e) return;
  if (/forbidden|permission denied/.test(e.message)) throw new Error('Зөвхөн админ.');
  if (/does not exist|Could not find/.test(e.message)) throw new Error('Гүйцэтгэлийн хүснэгт серверт хараахан үүсээгүй (migration).');
  throw new Error(e.message);
};

export async function fetchPerfSummary(from: string, to: string): Promise<PerfSummary> {
  const { data, error } = await supabase.rpc('perf_summary', { p_from: from, p_to: to });
  err(error);
  const d = data as PerfSummary;
  return { ...d, people: (d.people || []).map((p) => ({ ...p, amount: Number(p.amount) || 0 })), rates: (d.rates || []).map((r) => ({ ...r, amount: Number(r.amount) || 0 })) };
}

export async function fetchPerfJobs(from: string, to: string): Promise<PerfJob[]> {
  const { data, error } = await supabase.from('perf_jobs').select('id, work_date, kind, engineers, job_time, cable').gte('work_date', from).lte('work_date', to).order('work_date').limit(20000);
  err(error);
  return (data || []) as PerfJob[];
}

export async function fetchAliases(): Promise<PerfAlias[]> {
  const { data, error } = await supabase.from('perf_aliases').select('alias, user_id, ignored').order('alias');
  err(error);
  return (data || []) as PerfAlias[];
}

export async function setAlias(alias: string, userId: string | null, ignored = false) {
  const { error } = await supabase.from('perf_aliases').upsert({ alias, user_id: userId, ignored, updated_at: new Date().toISOString() });
  err(error);
}

export async function setRate(kind: string, amount: number) {
  const { error } = await supabase.from('perf_rates').update({ amount, updated_at: new Date().toISOString() }).eq('kind', kind);
  err(error);
}

/** Google Sheet-ийг дахин татна (edge function perf-sync). */
export async function syncSheet(): Promise<{ rows: number; from: string | null; to: string | null }> {
  const { data, error } = await supabase.functions.invoke('perf-sync', { body: {} });
  if (error) {
    let msg = error.message;
    try {
      const j = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return data;
}

/* ── Гараар бүртгэх (guitsetgel форм) ─────────────────────────────── */
export type FormJob = PerfJob & { source?: 'sheet' | 'form'; note?: string | null; contract?: string | null; created_by_name?: string | null; tasks?: string[] | null; lead?: string | null; sheet_key?: string | null; customer_type?: 'household' | 'org' | null; org_kind?: string | null; damage_kind?: string | null };

/** Байгууллагад «Нэмэлт бокс» байхгүй. */
export const ORG_HIDDEN_KINDS = ['add additional box'];
export const DAMAGE_KINDS = ['Шилэн кабель шилжүүлэг', 'Шилэн кабель сольсон'];
export const ORG_DEFAULT = ['Сургууль', 'Зочид буудал'];

/** Sheet-ийн мөрийн түлхүүр (perf-sync-тэй ижил): огноо|төрөл|инженерүүд|цаг. */
export const sheetKey = (j: { work_date: string; kind: string; engineers: string[]; job_time: string | null }) => [j.work_date, j.kind, j.engineers.map((e) => e.toLowerCase()).join(','), j.job_time || ''].join('|');
const dropOverridden = (rows: FormJob[]) => {
  const ov = new Set(rows.filter((r) => r.source === 'form' && r.sheet_key).map((r) => r.sheet_key));
  return ov.size ? rows.filter((r) => r.source === 'form' || !ov.has(sheetKey(r))) : rows;
};
export type NewJob = { work_date: string; kind: string; engineers: { name: string; user_id?: string | null }[]; job_time: string; cable: boolean; contract: string; note: string };

/**
 * Local (`npm run dev:guitsetgel`, ?design=1) — нэвтрэлтгүй үзүүлэх горим:
 * Sheet-ийг Vite proxy-оор шууд уншиж, формын бүртгэлийг энэ компьютерийн
 * localStorage-д л хадгална (серверт бичихгүй).
 */
export function isLocalDemo() {
  if (!import.meta.env.DEV) return false;
  try {
    if (new URLSearchParams(window.location.search).has('design')) sessionStorage.setItem('gx_design', '1');
    return sessionStorage.getItem('gx_design') === '1';
  } catch {
    return false;
  }
}
const LOCAL_KEY = 'gx_perf_form_jobs';
const readLocal = (): FormJob[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  } catch {
    return [];
  }
};
const writeLocal = (rows: FormJob[]) => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rows));
  } catch {
    /* хувийн цонх */
  }
};

/** Sheet CSV → ажил (perf-sync-тэй ижил дүрэм). */
export function parseSheetCsv(text: string): FormJob[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const norm = (v: string) => v.replace(/\s+/g, ' ').trim();
  const [head = [], ...data] = rows;
  const col = (re: RegExp) => head.findIndex((h) => re.test(norm(h).toLowerCase()));
  const [iD, iK, iE, iT, iC, iG] = [col(/огноо|date/), col(/төрөл|type/), col(/инженер|engineer/), col(/^цаг|time/), col(/кабель|cable/), col(/гэрээ|contract/)];
  const out: FormJob[] = [];
  data.forEach((r, n) => {
    const m = norm(r[iD] || '').match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
    const engineers = (r[iE] || '').split(/[,;+/]/).map(norm).filter(Boolean);
    const kind = norm(r[iK] || '').toLowerCase();
    if (!m || !kind || !engineers.length) return;
    out.push({ id: -(n + 1), work_date: `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`, kind, engineers, job_time: iT >= 0 ? norm(r[iT] || '') || null : null, cable: iC >= 0 && /^(tiim|тийм|yes|1)$/i.test(norm(r[iC] || '')), contract: iG >= 0 ? norm(r[iG] || '') || null : null, source: 'sheet' });
  });
  return out;
}

/** Ажлууд — local горимд Sheet (proxy) + localStorage, эс бөгөөс серверээс. */
export async function fetchJobsAny(from: string, to: string): Promise<FormJob[]> {
  if (!isLocalDemo()) {
    const { data, error } = await supabase.from('perf_jobs').select('id, work_date, kind, engineers, job_time, cable, source, note, contract, created_by_name, tasks, lead, sheet_key, customer_type, org_kind, damage_kind').gte('work_date', from).lte('work_date', to).order('work_date').limit(20000);
    err(error);
    return dropOverridden((data || []) as FormJob[]);
  }
  const r = await fetch('/__perf-sheet', { cache: 'no-store' }).catch(() => null);
  const sheet = r && r.ok ? parseSheetCsv(await r.text()) : [];
  return dropOverridden([...sheet, ...readLocal()]).filter((j) => j.work_date >= from && j.work_date <= to);
}

export const TASKS = ['Коннектор сольсон', 'Кабель сольсон', 'Роутер / ONU тохируулсан', 'Төхөөрөмж сольсон', 'Бокс суурилуулсан', 'Сигнал хэмжсэн', 'Дотор утас засварласан', 'Хэрэглэгчид зааварчилгаа өгсөн'];

/** Нэг ажил (Sheet-ийн нэг мөртэй адил) — шинээр нэмэх эсвэл id-тай бол засна. */
/**
 * @param id      засах form мөрийн id
 * @param fromSheet Sheet-ийн мөрийг засаж буй бол тэр мөр — засвар form мөр болж, эх мөр устна
 *                  (дараагийн «Sheet-ээс татах» түүнийг дахин оруулахгүй).
 */
export type JobExtra = { tasks: string[]; lead: string; customer_type: 'household' | 'org'; org_kind: string; damage_kind: string };
export async function saveFormJob(job: NewJob & JobExtra, id?: number, fromSheet?: FormJob) {
  const engineers = job.engineers.map((e) => e.name.trim()).filter(Boolean);
  if (!engineers.length) throw new Error('Ажилтан сонгоно уу.');
  if (!job.kind.trim()) throw new Error('Дуудлагын төрлийг сонгоно уу.');
  if (job.customer_type === 'org' && !job.org_kind.trim()) throw new Error('Байгууллагын төрлийг сонгоно уу.');
  if (job.kind === 'damage' && !job.damage_kind) throw new Error('Гэмтлийн төрлийг сонгоно уу.');
  const row = { work_date: job.work_date, kind: job.kind.trim().toLowerCase(), engineers, job_time: job.job_time || null, cable: job.cable, contract: job.contract.trim() || null, note: job.note.trim() || null, tasks: job.tasks, lead: job.lead.trim() || null, customer_type: job.customer_type, org_kind: job.customer_type === 'org' ? job.org_kind.trim() || null : null, damage_kind: job.kind === 'damage' ? job.damage_kind || null : null };
  const sk = fromSheet ? fromSheet.sheet_key || sheetKey(fromSheet) : undefined;
  if (isLocalDemo()) {
    const rest = readLocal().filter((j) => j.id !== id);
    writeLocal([...rest, { ...row, id: id ?? Date.now(), source: 'form', created_by_name: 'Local', ...(sk ? { sheet_key: sk } : {}) }]);
    return;
  }
  if (fromSheet) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('perf_jobs').insert({ ...row, source: 'form', sheet_key: sk, created_by: u.user?.id || null, created_by_name: u.user?.email || null });
    err(error);
    const del = await supabase.from('perf_jobs').delete().eq('id', fromSheet.id).eq('source', 'sheet');
    err(del.error);
  } else if (id) {
    const { error } = await supabase.from('perf_jobs').update(row).eq('id', id).eq('source', 'form');
    err(error);
  } else {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('perf_jobs').insert({ ...row, source: 'form', created_by: u.user?.id || null, created_by_name: u.user?.email || null });
    err(error);
  }
  // Нэрийг ажилтантай шууд холбоно — гүйцэтгэл, цалинд шууд тоологдоно.
  const map = job.engineers.filter((e) => e.user_id).map((e) => ({ alias: e.name.replace(/\s+/g, ' ').trim().toLowerCase(), user_id: e.user_id, ignored: false, updated_at: new Date().toISOString() }));
  if (map.length) await supabase.from('perf_aliases').upsert(map);
}

export async function deleteFormJob(id: number) {
  if (isLocalDemo()) {
    writeLocal(readLocal().filter((j) => j.id !== id));
    return;
  }
  const { error } = await supabase.from('perf_jobs').delete().eq('id', id).eq('source', 'form');
  err(error);
}

/* ── Автомат дүгнэлт: шилдэг баг/хүн, өмнөх сартай харьцуулалт (улирлын засвартай) ── */

/** Сар бүрийн хэвийн ачааллын коэффициент (0 = 1-р сар). Өвөл дуудлага цөөрдөг. */
export const SEASON = [0.8, 0.8, 0.9, 1, 1, 1, 1, 1, 1, 1, 0.9, 0.85];
export const isWinter = (m: number) => m === 11 || m <= 1;

export type Agg = { total: number; days: number; perDay: number; people: Map<string, { jobs: number; days: number; perDay: number }>; teams: { name: string; jobs: number; days: number; perDay: number }[] };

export function aggregate(jobs: PerfJob[], nameOf: (raw: string) => string | null = (r) => r.trim()): Agg {
  const days = new Set<string>();
  const people = new Map<string, { jobs: number; d: Set<string> }>();
  const teams = new Map<string, { jobs: number; d: Set<string> }>();
  for (const j of jobs) {
    days.add(j.work_date);
    const crew = [...new Set(j.engineers.map(nameOf).filter((n): n is string => !!n))];
    for (const n of crew) {
      const p = people.get(n) || { jobs: 0, d: new Set<string>() };
      p.jobs++;
      p.d.add(j.work_date);
      people.set(n, p);
    }
    if (crew.length) {
      const key = [...crew].sort((x, y) => x.localeCompare(y, 'mn')).join(' + ');
      const t = teams.get(key) || { jobs: 0, d: new Set<string>() };
      t.jobs++;
      t.d.add(j.work_date);
      teams.set(key, t);
    }
  }
  return {
    total: jobs.length,
    days: days.size,
    perDay: days.size ? jobs.length / days.size : 0,
    people: new Map([...people].map(([n, p]) => [n, { jobs: p.jobs, days: p.d.size, perDay: p.d.size ? p.jobs / p.d.size : 0 }])),
    teams: [...teams].map(([name, t]) => ({ name, jobs: t.jobs, days: t.d.size, perDay: t.d.size ? t.jobs / t.d.size : 0 })),
  };
}

export type Insight = { tone: 'good' | 'warn' | 'info'; text: string };

/**
 * Шилдэг баг/хүн + өмнөх сартай харьцуулалт. Харьцуулалт нь ажлын өдрийн дунджаар
 * (сар дуусаагүй ч шударга), улирлын коэффициентоор засварласан — өвлийн хэвийн
 * бууралтыг «муудсан» гэж үзэхгүй.
 */
export function compareInsights(cur: Agg, prev: Agg, month: number): Insight[] {
  const out: Insight[] = [];
  if (!cur.total) return out;
  const topTeam = [...cur.teams].filter((t) => t.days >= 2).sort((a, b) => b.jobs - a.jobs)[0];
  const topPerson = [...cur.people].sort((a, b) => b[1].jobs - a[1].jobs)[0];
  if (topTeam) out.push({ tone: 'good', text: `Хамгийн их ажил хийсэн баг: ${topTeam.name} — ${topTeam.jobs} ажил (${topTeam.days} өдөр, өдөрт ${topTeam.perDay.toFixed(1)}).` });
  if (topPerson) out.push({ tone: 'good', text: `Хамгийн их ажил хийсэн хүн: ${topPerson[0]} — ${topPerson[1].jobs} ажил (өдөрт ${topPerson[1].perDay.toFixed(1)}).` });
  if (!prev.total || !prev.perDay) {
    out.push({ tone: 'info', text: 'Өмнөх сарын өгөгдөл алга — харьцуулалт дараа сараас гарна.' });
    return out;
  }

  const prevMonth = (month + 11) % 12;
  const expected = SEASON[month] / SEASON[prevMonth];
  const raw = cur.perDay / prev.perDay;
  const adj = raw / expected;
  const pct = (x: number) => `${x >= 1 ? '+' : ''}${Math.round((x - 1) * 100)}%`;
  const season = expected < 0.98 ? ` Өвлийн улиралд дуудлага ~${Math.round((1 - expected) * 100)}% цөөрдөг гэж тооцов.` : expected > 1.02 ? ` Өвөл дуусч дуудлага ~${Math.round((expected - 1) * 100)}% өсөх ёстой гэж тооцов.` : '';
  if (adj < 0.93) {
    out.push({ tone: 'warn', text: `Өдрийн дундаж ажил өмнөх сараас ${pct(raw)} (${prev.perDay.toFixed(1)} → ${cur.perDay.toFixed(1)}); улирлыг тооцоход ${pct(adj)} — бодит бууралт.${season}` });
    out.push({ tone: 'info', text: 'Сайжруулах: өдрийн дуудлагыг байршлаар нь бүлэглэж маршрут төлөвлө; энгийн гомдлыг ганцаараа явуулж баг нэмэгдүүл; давтагдсан гомдлын хаягийг урьдчилан шалга; коннектор, тоног төхөөрөмжийн нөөцийг өглөө бүрдүүл.' });
    if (isWinter(month)) out.push({ tone: 'info', text: 'Өвлийн цагт: гадна кабелийн хөлдөлт, тасралтын гомдол ихэсдэг — урьдчилан сэргийлэх үзлэг хийж, хүйтэнд тэсвэртэй коннектор ашиглаж, нэг айлд очих хугацааг богиносго.' });
  } else if (raw < 0.95) {
    out.push({ tone: 'info', text: `Өдрийн дундаж ажил ${pct(raw)} буурсан ч энэ нь улирлын хэвийн бууралт (засвартай ${pct(adj)}).${season}` });
  } else {
    out.push({ tone: 'good', text: `Өдрийн дундаж ажил өмнөх сараас ${pct(raw)} (${prev.perDay.toFixed(1)} → ${cur.perDay.toFixed(1)}), улирлын засвартай ${pct(adj)}.` });
  }
  const down = [...cur.people]
    .map(([n, p]) => ({ n, p, q: prev.people.get(n) }))
    .filter((x) => x.q && x.p.days >= 3 && x.q.days >= 3 && x.p.perDay / x.q.perDay / expected < 0.85)
    .sort((a, b) => a.p.perDay / a.q!.perDay - b.p.perDay / b.q!.perDay);
  if (down.length) out.push({ tone: 'warn', text: `Өмнөх сараас мэдэгдэхүйц буурсан: ${down.slice(0, 5).map((x) => `${x.n} (${x.q!.perDay.toFixed(1)} → ${x.p.perDay.toFixed(1)}/өдөр)`).join(', ')}. Хамтрагч, бүсийн хуваарилалт, сургалтыг нь эргэж хар.` });
  return out;
}

/* ── «Хийсэн ажил» сонголтын жагсаалт (нэмэх, байр солих) ── */
const TASKS_KEY = 'gx_perf_task_options';
export async function fetchTaskOptions(): Promise<string[]> {
  if (isLocalDemo()) {
    try {
      const v = JSON.parse(localStorage.getItem(TASKS_KEY) || 'null');
      return Array.isArray(v) && v.length ? v : TASKS;
    } catch {
      return TASKS;
    }
  }
  const { data, error } = await supabase.from('perf_settings').select('task_options').eq('id', 1).maybeSingle();
  if (error) return TASKS; // багана хараахан үүсээгүй бол анхдагч
  const v = (data as { task_options?: string[] } | null)?.task_options;
  return v && v.length ? v : TASKS;
}
export async function saveTaskOptions(list: string[]) {
  const clean = [...new Set(list.map((t) => t.trim()).filter(Boolean))];
  if (isLocalDemo()) {
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(clean));
    } catch {
      /* хувийн цонх */
    }
    return clean;
  }
  const { error } = await supabase.from('perf_settings').update({ task_options: clean }).eq('id', 1);
  err(error);
  return clean;
}

/* ── Байгууллагын төрөл (Сургууль, Зочид буудал …) — админ нэмнэ ── */
const ORG_KEY = 'gx_perf_org_options';
export async function fetchOrgOptions(): Promise<string[]> {
  if (isLocalDemo()) {
    try {
      const v = JSON.parse(localStorage.getItem(ORG_KEY) || 'null');
      return Array.isArray(v) && v.length ? v : ORG_DEFAULT;
    } catch {
      return ORG_DEFAULT;
    }
  }
  const { data, error } = await supabase.from('perf_settings').select('org_options').eq('id', 1).maybeSingle();
  if (error) return ORG_DEFAULT;
  const v = (data as { org_options?: string[] } | null)?.org_options;
  return v && v.length ? v : ORG_DEFAULT;
}
export async function saveOrgOptions(list: string[]) {
  const clean = [...new Set(list.map((t) => t.trim()).filter(Boolean))];
  if (isLocalDemo()) {
    try {
      localStorage.setItem(ORG_KEY, JSON.stringify(clean));
    } catch {
      /* хувийн цонх */
    }
    return clean;
  }
  const { error } = await supabase.from('perf_settings').update({ org_options: clean }).eq('id', 1);
  err(error);
  return clean;
}

import { supabase } from './supabase';

/**
 * Цагийн тайлан (tailan.gennetex.com) — өгөгдөл ба тооцоо.
 *
 * Сервер (`time_report_data`) зөвхөн түүхий бүртгэл буцаана; төлөвийг энд
 * company_settings-ийн дүрмээр тооцно (`compute_attendance_status`-тай ижил:
 * ажил эхлэх цаг + grace + 1 минутаас хойш ирвэл хоцролт).
 */

export const TIME_REPORT_HOST = 'tailan.gennetex.com';
export const TIME_REPORT_URL = `https://${TIME_REPORT_HOST}`;
export const WORK_HOURS = 8;
export const LUNCH_HOURS = 1;

export type Status = 'ok' | 'late' | 'leave' | 'absent' | 'off' | 'future' | 'na';

export const STATUS_LABEL: Record<Status, string> = {
  ok: 'Цагтаа ирсэн',
  late: 'Хоцорсон',
  leave: 'Чөлөөтэй',
  absent: 'Тасалсан',
  off: 'Амралт',
  future: 'Болоогүй',
  na: 'Бүртгэгдээгүй',
};

export type TrEmployee = {
  id: string;
  name: string;
  position: string;
  department: string;
  email: string | null;
  role: string | null;
  avatar_url: string | null;
};

export type DayRec = {
  date: string;
  status: Status;
  checkIn?: string;
  checkOut?: string | null;
  inM?: number;
  hours: number;
  open?: boolean;
  lateMin: number;
  over: number;
  remote?: boolean;
  pending?: boolean;
  leaveKind?: string;
  shift?: string;
};

export type Summary = {
  ok: number;
  late: number;
  leave: number;
  absent: number;
  hours: number;
  over: number;
  lateMin: number;
  work: number;
  present: number;
  rate: number;
  avgIn: number | null;
  ins: number[];
  days: DayRec[];
};

export type Settings = { workStart: string; grace: number };

export type TrModel = {
  from: string;
  to: string;
  today: string;
  list: string[];
  settings: Settings;
  emps: TrEmployee[];
  sum: Map<string, Summary>;
  weekendOf: (empId: string, d: string) => boolean;
};

type RawData = {
  settings?: { work_start?: string; grace?: number } | null;
  employees: { id: string; name: string | null; last_name: string | null; email: string | null; position: string | null; role: string | null; avatar_url: string | null; department: string | null; since?: string | null }[];
  attendance: { e: string; d: string; in: string | null; out: string | null; remote: boolean; pending: boolean }[];
  shifts?: { e: string; d: string; start: string; end: string }[];
  leaves: { e: string; from: string; to: string; kind: string | null }[];
  rest_days: { e: string; dow: number }[];
};

/* ───────── Огноо ───────── */
export const WDAY = ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'];
export const WDAY_LONG = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];
export const MONTH = ['1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар', '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар'];
const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export function daysBetween(a: string, b: string) {
  const out: string[] = [];
  for (let d = parse(a); d <= parse(b); d.setDate(d.getDate() + 1)) out.push(ymd(d));
  return out;
}
export const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
export const hm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(Math.round(m % 60))}`;
export const h1 = (h: number) => (Math.round(h * 10) / 10).toLocaleString('mn-MN');
export const fmtDate = (s: string) => {
  const d = parse(s);
  return `${MONTH[d.getMonth()]} ${d.getDate()}`;
};
export const fmtDateY = (s: string) => {
  const d = parse(s);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
};
export const todayUB = () => ubParts(new Date().toISOString()).date;

const ubFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ulaanbaatar',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
function ubParts(iso: string) {
  const p = Object.fromEntries(ubFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
export const nowMinUB = () => toMin(ubParts(new Date().toISOString()).time);

/* ───────── Хугацаа ───────── */
export type RangeKind = 'week' | 'month' | 'quarter' | 'year' | 'custom';
export type Range = { kind: RangeKind; from: string; to: string };

export function rangeFor(kind: Exclude<RangeKind, 'custom'>, anchor = parse(todayUB())): Range {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  if (kind === 'week') {
    const a = new Date(anchor);
    a.setDate(a.getDate() - 6);
    return { kind, from: ymd(a), to: ymd(anchor) };
  }
  if (kind === 'quarter') {
    const q = Math.floor(m / 3);
    return { kind, from: ymd(new Date(y, q * 3, 1)), to: ymd(new Date(y, q * 3 + 3, 0)) };
  }
  if (kind === 'year') return { kind, from: `${y}-01-01`, to: `${y}-12-31` };
  return { kind, from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) };
}

/** Өмнөх/дараагийн хугацаа руу шилжих. */
export function stepRange(r: Range, dir: -1 | 1): Range {
  if (r.kind === 'custom') {
    const len = daysBetween(r.from, r.to).length;
    const a = parse(r.from);
    a.setDate(a.getDate() + dir * len);
    const b = parse(r.to);
    b.setDate(b.getDate() + dir * len);
    return { kind: 'custom', from: ymd(a), to: ymd(b) };
  }
  const a = parse(r.kind === 'week' ? r.to : r.from);
  if (r.kind === 'week') a.setDate(a.getDate() + dir * 7);
  if (r.kind === 'month') a.setMonth(a.getMonth() + dir);
  if (r.kind === 'quarter') a.setMonth(a.getMonth() + dir * 3);
  if (r.kind === 'year') a.setFullYear(a.getFullYear() + dir);
  return rangeFor(r.kind, a);
}

export function rangeLabel(r: Range) {
  const a = parse(r.from);
  if (r.kind === 'month') return `${a.getFullYear()} оны ${MONTH[a.getMonth()]}`;
  if (r.kind === 'quarter') return `${a.getFullYear()} оны ${['I', 'II', 'III', 'IV'][Math.floor(a.getMonth() / 3)]} улирал`;
  if (r.kind === 'year') return `${a.getFullYear()} он`;
  return `${fmtDate(r.from)} – ${fmtDate(r.to)}`;
}

/* ───────── Үзэх түлхүүр (апп дотор WebView) ───────── */
const KEY_STORE = 'gx_tr_key';
export function readAccessKey(): string | null {
  try {
    const url = new URL(window.location.href);
    const k = url.searchParams.get('k');
    if (k) {
      sessionStorage.setItem(KEY_STORE, k);
      url.searchParams.delete('k');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      return k;
    }
    return sessionStorage.getItem(KEY_STORE);
  } catch {
    return null;
  }
}

/* ───────── Татах ───────── */
export async function fetchTimeReport(from: string, to: string, key: string | null): Promise<RawData> {
  const { data, error } = await supabase.rpc('time_report_data', { p_from: from, p_to: to, p_key: key });
  if (error) {
    if (/forbidden/.test(error.message)) throw new Error('forbidden');
    if (/range_too_long/.test(error.message)) throw new Error('Хугацаа 400 хоногоос урт байж болохгүй.');
    throw error;
  }
  return data as RawData;
}

export function buildModel(raw: RawData, from: string, to: string): TrModel {
  const settings: Settings = { workStart: raw.settings?.work_start || '09:00', grace: Number(raw.settings?.grace || 0) };
  const today = todayUB();
  const list = daysBetween(from, to);

  const rest = new Map<string, Set<number>>();
  raw.rest_days.forEach((r) => (rest.get(r.e) || rest.set(r.e, new Set()).get(r.e)!).add(Number(r.dow) % 7));
  const weekendOf = (empId: string, d: string) => {
    const dow = parse(d).getDay();
    const own = rest.get(empId);
    return own && own.size ? own.has(dow) : dow === 0 || dow === 6;
  };

  const att = new Map(raw.attendance.map((a) => [`${a.e}|${a.d}`, a]));
  const shifts = new Map((raw.shifts || []).map((s) => [`${s.e}|${s.d}`, `${s.start.slice(0, 5)}–${s.end.slice(0, 5)}`]));
  const leaves = new Map<string, string>();
  raw.leaves.forEach((l) => daysBetween(l.from < from ? from : l.from, l.to > to ? to : l.to).forEach((d) => leaves.set(`${l.e}|${d}`, l.kind || 'leave')));

  // Админ/супер админ нэг ч бүртгэлгүй бол (ирц бүртгүүлдэггүй) жагсаалтаас хасна.
  const withRecords = new Set(raw.attendance.map((a) => a.e));
  const emps: TrEmployee[] = raw.employees
    .filter((e) => withRecords.has(e.id) || !['admin', 'superadmin'].includes(String(e.role)))
    .map((e) => ({
      id: e.id,
      name: shortName(e.last_name, e.name, e.email),
      position: e.position || '',
      department: e.department || 'Хэлтэсгүй',
      email: e.email,
      role: e.role,
      avatar_url: e.avatar_url,
    }));
  const since = new Map(raw.employees.map((e) => [e.id, e.since || '']));

  const startM = toMin(settings.workStart);
  const nowM = nowMinUB();
  const calc = (a: RawData['attendance'][number], d: string): Omit<DayRec, 'date'> => {
    const inT = a.in ? ubParts(a.in).time : undefined;
    const outT = a.out ? ubParts(a.out).time : null;
    if (!inT) {
      return { status: 'absent', hours: 0, lateMin: 0, over: 0, checkOut: outT, remote: a.remote, pending: a.pending };
    }
    const inM = toMin(inT);
    const open = !outT;
    const outM = open ? (d === today ? Math.max(inM, nowM) : inM) : toMin(outT!);
    const span = outM - inM;
    const hours = Math.max(0, span / 60 - (span > 300 ? LUNCH_HOURS : 0));
    const late = inM >= startM + settings.grace + 1;
    return {
      status: late ? 'late' : 'ok',
      checkIn: inT,
      checkOut: outT,
      inM,
      hours,
      open,
      lateMin: late ? inM - startM : 0,
      over: Math.max(0, hours - WORK_HOURS),
      remote: a.remote,
      pending: a.pending,
    };
  };

  const sum = new Map<string, Summary>();
  emps.forEach((e) => {
    const s: Summary = { ok: 0, late: 0, leave: 0, absent: 0, hours: 0, over: 0, lateMin: 0, work: 0, present: 0, rate: 0, avgIn: null, ins: [], days: [] };
    list.forEach((d) => {
      const key = `${e.id}|${d}`;
      const a = att.get(key);
      const shift = shifts.get(key);
      let x: DayRec;
      if (d > today) x = { date: d, status: 'future', hours: 0, lateMin: 0, over: 0, shift };
      // Системд бүртгэгдэхээс өмнөх өдөр — тоолохгүй.
      else if (d < (since.get(e.id) || '') && !a?.in) x = { date: d, status: 'na', hours: 0, lateMin: 0, over: 0 };
      else if (a && a.in) x = { date: d, ...calc(a, d), shift };
      else if (leaves.has(key)) x = { date: d, status: 'leave', hours: 0, lateMin: 0, over: 0, leaveKind: leaves.get(key), shift };
      else if (weekendOf(e.id, d) && !shift) x = { date: d, status: 'off', hours: 0, lateMin: 0, over: 0 };
      // Өнөөдөр ажил эхлэх цагаас өмнө — хараахан тасалсан гэж тооцохгүй.
      else if (d === today && nowM < startM + settings.grace + 1) x = { date: d, status: 'future', hours: 0, lateMin: 0, over: 0, shift };
      else x = { date: d, status: 'absent', hours: 0, lateMin: 0, over: 0, shift, pending: a?.pending };
      s.days.push(x);
      if (x.status === 'off' || x.status === 'future' || x.status === 'na') return;
      s.work++;
      s[x.status]++;
      s.hours += x.hours;
      s.over += x.over;
      s.lateMin += x.lateMin;
      if (x.inM != null) s.ins.push(x.inM);
    });
    s.present = s.ok + s.late;
    const base = s.work - s.leave;
    s.rate = base > 0 ? Math.round((s.present / base) * 100) : 0;
    s.avgIn = s.ins.length ? s.ins.reduce((a, b) => a + b, 0) / s.ins.length : null;
    sum.set(e.id, s);
  });

  return { from, to, today, list, settings, emps, sum, weekendOf };
}

export function shortName(last: string | null, name: string | null, email?: string | null) {
  const l = String(last || '').trim();
  const n = String(name || '').trim();
  if (n && l) return `${l.slice(0, 1)}.${n}`;
  return n || l || String(email || 'Ажилтан').split('@')[0];
}

/* ───────── Анхаарах ажилтнууд ───────── */
export type Attention = { emp: TrEmployee; s: Summary; reasons: string[]; score: number };

export function attentionList(m: TrModel): Attention[] {
  return m.emps
    .map((emp) => {
      const s = m.sum.get(emp.id)!;
      const reasons: string[] = [];
      if (s.work < 1) return null;
      if (s.absent) reasons.push(`${s.absent} өдөр тасалсан`);
      if (s.late >= 3 || s.lateMin >= 60) reasons.push(`${s.late} удаа хоцорсон (нийт ${s.lateMin} мин)`);
      if (s.rate < 90 && s.work >= 3) reasons.push(`ирц ${s.rate}%`);
      const missingOut = s.days.filter((x) => x.open && x.date !== m.today).length;
      if (missingOut >= 2) reasons.push(`${missingOut} удаа явсан цагаа бүртгүүлээгүй`);
      if (!reasons.length) return null;
      return { emp, s, reasons, score: s.absent * 3 + s.late + s.lateMin / 30 + (100 - s.rate) / 5 + missingOut };
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score) as Attention[];
}

export function warningMessage(a: Attention, from: string, to: string, note: string) {
  const lines = [
    `${fmtDateY(from)} – ${fmtDateY(to)} хугацаанд таны ирцэд дараах зүйл анхаарал татаж байна: ${a.reasons.join(', ')}.`,
  ];
  if (note.trim()) lines.push(note.trim());
  else lines.push('Ажлын цагийн хуваарьт анхаарч, ирцээ тогтмол бүртгүүлнэ үү. Тайлбар байвал хүний нөөцөд хандана уу.');
  return lines.join('\n\n');
}

export async function sendWarnings(
  items: { employee_id: string; period_from: string; period_to: string; title: string; message: string; stats: Record<string, unknown> }[],
  key: string | null
) {
  const { data, error } = await supabase.rpc('create_attendance_warnings', { p_items: items, p_key: key });
  if (error) throw new Error(/forbidden/.test(error.message) ? 'Сануулга илгээх эрхгүй байна.' : error.message);
  const ids = ((data || []) as { id: string }[]).map((r) => r.id);
  const { data: res, error: fnError } = await supabase.functions.invoke('attendance-warning-notify', { body: { ids, key } });
  if (fnError) throw new Error('Сануулга хадгалагдсан ч хүргэж чадсангүй: ' + fnError.message);
  return (res?.results || []) as { id: string; name: string; push?: string; email?: string }[];
}

/* ───────── Сануулгын хуудас ───────── */
export type WarningPage = {
  warning: { id: string; title: string; message: string; stats: Record<string, number>; period_from: string; period_to: string; created_at: string; created_by_name: string | null; employee_name: string | null };
  data: RawData & { employee: RawData['employees'][number] };
};

export async function fetchWarning(token: string): Promise<WarningPage | null> {
  const { data, error } = await supabase.rpc('get_attendance_warning', { p_token: token });
  if (error) throw error;
  return (data as WarningPage) || null;
}

/**
 * Ажилчдын гүйцэтгэл — БАГИЙН ӨДРИЙН үзүүлэлт.
 *
 * АСУУЛТ НЬ:
 *   · нийт хэдэн баг ажилласан бэ
 *   · өдөрт хэдэн айл хийсэн бэ
 *   · нийт хэр хугацаанд хийсэн бэ
 *   · 1 баг ӨДӨРТ хэдэн айл хийсэн бэ
 *
 * ХЭМЖИХ НЭГЖ НЬ «БАГ × ӨДӨР».
 *   Ажилтан тус бүрээр бодвол хосоороо явсан хоёр инженерийн ажил хоёр
 *   дахин тоологдоно. Тиймээс баг (хамт явсан хүмүүсийн НЭРИЙН БҮРДЭЛ)
 *   бүрийн нэг өдрийн ажлыг нэг мөр болгож нэгтгэнэ.
 *
 * ГУРВАН ЭХ СУРВАЛЖ:
 *   service_calls        — айл / байгууллага гэсэн ангилал ЭНД байна
 *                          (site_kind), хаасан цаг нь close_meta.closed_at.
 *   field_site_sessions  — ажлын байр дээр ХЭДЭН ЦАГ байсан (arrived_at →
 *                          departed_at). Жинхэнэ "ажилласан хугацаа".
 *   team_performance_entries — Excel-ээр гараар оруулсан мөр.
 *
 * ⚠️ admin-web/index.html дотор ЯГ ЭНЭ томьёог давхардуулж бичсэн
 *    (`===== Ажилчдын гүйцэтгэл =====` хэсэг). Тэр нь build-гүй, задгай
 *    HTML тул энэ модулийг import хийж чадахгүй. Томьёо өөрчлөх бол
 *    ХОЁУЛАНГ нь засна.
 */
import { supabase } from '../lib/supabase';
import { dayKey } from '../lib/workHours';

export const IMPORT_TABLE = 'team_performance_entries';

/** Дууссан гэж тооцох төлөв. Бусад төлөв нь "хийгээгүй" ажил. */
export const DONE_STATUS = 'Дууссан';

/** Дуудлага мужаас өмнө үүсээд мужид хаагдсан байж болно — ийм буфертэй татна. */
const CREATED_BUFFER_DAYS = 45;

/** Excel/CSV-ийн баганын дараалал — импорт ба экспорт ХОЁУЛАА үүнийг дагана. */
export const IMPORT_COLUMNS = [
  { key: 'work_date', label: 'Огноо', hint: 'YYYY-MM-DD' },
  { key: 'team_name', label: 'Баг', hint: 'Багийн нэр' },
  { key: 'members', label: 'Гишүүд', hint: 'Нэрсийг таслалаар' },
  { key: 'ail_count', label: 'Айл', hint: 'Тоо' },
  { key: 'baiguulga_count', label: 'Байгууллага', hint: 'Тоо' },
  { key: 'duration_minutes', label: 'Хугацаа (мин)', hint: 'Тоо' },
  { key: 'note', label: 'Тайлбар', hint: 'Заавал биш' },
];

export const IMPORT_HEADER = IMPORT_COLUMNS.map((c) => c.label);

// ---------------------------------------------------------------------------
// Багийн нэршил
// ---------------------------------------------------------------------------

function clean(v) {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Багийн ТҮЛХҮҮР — гишүүдийн нэрийн эрэмбэлсэн бүрдэл.
 *
 * "Болд + Дорж" ба "Дорж + Болд" нь НЭГ баг. Дуудлага дээр инженер/хамтрагч
 * ямар дарааллаар бичигдсэн нь хамаагүй байх ёстой.
 */
export function teamKeyFrom(names) {
  const uniq = [...new Set((names || []).map(clean).filter(Boolean).map((n) => n.toLowerCase()))];
  if (!uniq.length) return '—';
  return uniq.sort().join('|');
}

/** Дэлгэц дээр харагдах багийн нэр. */
export function teamLabelFrom(names) {
  const seen = new Map();
  (names || []).forEach((n) => {
    const c = clean(n);
    if (c && !seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c);
  });
  const list = [...seen.values()];
  return list.length ? list.join(' + ') : 'Тодорхойгүй';
}

/** "Болд, Дорж" / "Болд + Дорж" → ['Болд','Дорж'] */
export function splitMembers(text) {
  return String(text || '')
    .split(/[,;+/]/)
    .map(clean)
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Хугацаа
// ---------------------------------------------------------------------------

/** Дуудлага хаагдсан мөч. Байхгүй бол сүүлд шинэчилсэн мөч. */
export function callClosedAt(call) {
  return call?.close_meta?.closed_at || call?.updated_at || call?.created_at || null;
}

/**
 * Дуудлага үүссэнээс хаагдтал өнгөрсөн хугацаа (ms).
 *
 * Энэ нь ажлын байр дээр байсан хугацаа БИШ — хүлээлт орно. Тиймээс
 * ажлын байрны session байвал түүнийг илүүд үзнэ (`teamDayDurationMs`).
 */
export function callLeadMs(call) {
  const start = call?.created_at;
  const end = callClosedAt(call);
  if (!start || !end) return 0;
  const ms = new Date(end) - new Date(start);
  return ms > 0 ? ms : 0;
}

/** Ажлын байр дээр байсан хугацаа (ms). Яваагүй бол одоог хүртэл. */
export function sessionMs(session) {
  if (!session?.arrived_at) return 0;
  const end = session.departed_at
    ? new Date(session.departed_at)
    : session.status === 'on_site'
      ? new Date()
      : null;
  if (!end) return 0;
  const ms = end - new Date(session.arrived_at);
  return ms > 0 ? ms : 0;
}

/**
 * Баг × өдрийн "ажилласан хугацаа".
 *
 * Ажлын байрны бүртгэл (ирсэн/явсан) байвал ТЭР нь үнэн. Байхгүй бол
 * дуудлагын үүсэхээс хаагдтал хугацаагаар орлуулна — эс тэгвээс хугацаа
 * 0 харагдаж, тайлан утгагүй болно.
 */
export function teamDayDurationMs(row) {
  if (row.onSiteMs > 0) return row.onSiteMs;
  if (row.importedMs > 0) return row.importedMs;
  return row.leadMs;
}

/** Хугацааны эх сурвалжийг нэрлэнэ — тайлан дээр ил бичнэ. */
export function durationSourceLabel(row) {
  if (row.onSiteMs > 0) return 'Ажлын байр';
  if (row.importedMs > 0) return 'Импорт';
  if (row.leadMs > 0) return 'Дуудлагын хугацаа';
  return '—';
}

// ---------------------------------------------------------------------------
// Нэгтгэл
// ---------------------------------------------------------------------------

function blankRow(dayK, teamKey, members) {
  return {
    key: `${dayK}|${teamKey}`,
    dayKey: dayK,
    teamKey,
    members: [...members],
    teamLabel: teamLabelFrom(members),
    ail: 0,
    baiguulga: 0,
    calls: 0,
    sessions: 0,
    onSiteMs: 0,
    leadMs: 0,
    importedMs: 0,
    sources: [],
  };
}

function touchRow(map, dayK, members, source, teamKeyOverride) {
  const teamKey = teamKeyOverride || teamKeyFrom(members);
  const key = `${dayK}|${teamKey}`;
  if (!map[key]) map[key] = blankRow(dayK, teamKey, members);
  const row = map[key];
  // Нэр нь дараа нь бүрэн болж ирвэл (жишээ нь session дээр 3 дахь хүн)
  // жагсаалтыг баяжуулна.
  members.forEach((m) => {
    if (m && !row.members.some((x) => x.toLowerCase() === m.toLowerCase())) row.members.push(m);
  });
  row.teamLabel = teamLabelFrom(row.members);
  if (!row.sources.includes(source)) row.sources.push(source);
  return row;
}

/**
 * Гурван эх сурвалжийг «баг × өдөр» мөр болгож нэгтгэнэ.
 *
 * @param {{calls?: any[], sessions?: any[], imported?: any[], from?: string, to?: string}} input
 * @returns {any[]} өдөр буурахаар эрэмбэлсэн мөрүүд
 */
export function buildTeamDayRows({ calls = [], sessions = [], imported = [], from, to } = {}) {
  const map = {};
  const inRange = (dayK) => (!from || dayK >= from) && (!to || dayK <= to);

  calls.forEach((c) => {
    if (c?.status !== DONE_STATUS) return;
    const closed = callClosedAt(c);
    if (!closed) return;
    const dayK = dayKey(new Date(closed));
    if (!inRange(dayK)) return;
    const members = [c.engineer_name, c.partner_engineer_name].map(clean).filter(Boolean);
    if (!members.length) members.push('Тодорхойгүй');
    const row = touchRow(map, dayK, members, 'system');
    row.calls += 1;
    if ((c.site_kind || 'ail') === 'baiguulga') row.baiguulga += 1;
    else row.ail += 1;
    row.leadMs += callLeadMs(c);
  });

  sessions.forEach((s) => {
    if (!s?.arrived_at) return;
    const dayK = dayKey(new Date(s.arrived_at));
    if (!inRange(dayK)) return;
    const members = [
      s.driver_name,
      ...(Array.isArray(s.passengers) ? s.passengers.map((p) => p?.name) : []),
    ]
      .map(clean)
      .filter(Boolean);
    if (!members.length) members.push('Тодорхойгүй');
    const row = touchRow(map, dayK, members, 'system');
    row.sessions += 1;
    row.onSiteMs += sessionMs(s);
  });

  imported.forEach((e) => {
    const dayK = String(e?.work_date || '').slice(0, 10);
    if (!dayK || !inRange(dayK)) return;
    const members = splitMembers(e.members);
    const teamKey = members.length ? teamKeyFrom(members) : `import:${clean(e.team_name).toLowerCase()}`;
    const row = touchRow(map, dayK, members.length ? members : [clean(e.team_name)], 'import', teamKey);
    if (clean(e.team_name)) row.teamLabel = clean(e.team_name);
    row.ail += Number(e.ail_count) || 0;
    row.baiguulga += Number(e.baiguulga_count) || 0;
    row.importedMs += (Number(e.duration_minutes) || 0) * 60000;
  });

  return Object.values(map)
    .map((r) => ({ ...r, durationMs: teamDayDurationMs(r), durationSource: durationSourceLabel(r) }))
    .filter((r) => r.ail || r.baiguulga || r.sessions || r.durationMs)
    .sort((a, b) =>
      a.dayKey === b.dayKey ? a.teamLabel.localeCompare(b.teamLabel) : b.dayKey.localeCompare(a.dayKey)
    );
}

/** Асуултын хариу — нийт үзүүлэлт. */
export function summarize(rows) {
  const teams = new Set();
  const days = new Set();
  let ail = 0;
  let baiguulga = 0;
  let durationMs = 0;
  let sessions = 0;
  rows.forEach((r) => {
    teams.add(r.teamKey);
    days.add(r.dayKey);
    ail += r.ail;
    baiguulga += r.baiguulga;
    durationMs += r.durationMs;
    sessions += r.sessions;
  });
  const teamDays = rows.length;
  return {
    teams: teams.size,
    days: days.size,
    teamDays,
    ail,
    baiguulga,
    total: ail + baiguulga,
    sessions,
    durationMs,
    /** Нийт айл ÷ ажилласан өдөр — "өдөрт хэдэн айл" */
    ailPerDay: days.size ? ail / days.size : 0,
    /** Нийт айл ÷ (баг × өдөр) — "1 баг өдөрт хэдэн айл" */
    ailPerTeamDay: teamDays ? ail / teamDays : 0,
    /** 1 айлд ногдох дундаж хугацаа */
    msPerAil: ail ? durationMs / ail : 0,
  };
}

/** Багаар нэгтгэсэн хүснэгт. */
export function groupByTeam(rows) {
  const map = {};
  rows.forEach((r) => {
    if (!map[r.teamKey]) {
      map[r.teamKey] = {
        teamKey: r.teamKey,
        teamLabel: r.teamLabel,
        members: [...r.members],
        days: 0,
        ail: 0,
        baiguulga: 0,
        durationMs: 0,
        lastDay: r.dayKey,
      };
    }
    const t = map[r.teamKey];
    t.days += 1;
    t.ail += r.ail;
    t.baiguulga += r.baiguulga;
    t.durationMs += r.durationMs;
    if (r.dayKey > t.lastDay) t.lastDay = r.dayKey;
    if (r.teamLabel.length > t.teamLabel.length) t.teamLabel = r.teamLabel;
  });
  return Object.values(map)
    .map((t) => ({
      ...t,
      ailPerDay: t.days ? t.ail / t.days : 0,
      msPerAil: t.ail ? t.durationMs / t.ail : 0,
    }))
    .sort((a, b) => b.ail - a.ail || b.days - a.days);
}

export const MONTH_LABELS = [
  '1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар',
  '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар',
];

/** "2026-08-21" → сарын шошго. */
export function monthLabel(monthKey) {
  const m = Number(String(monthKey).slice(5, 7));
  return MONTH_LABELS[m - 1] || monthKey;
}

/**
 * Хугацааны нэгжээр нэгтгэнэ.
 *
 * @param {any[]} rows баг × өдрийн мөрүүд
 * @param {'day'|'month'} unit
 * @returns {any[]} шинэ → хуучин дараалалтай
 */
export function groupByPeriod(rows, unit = 'day') {
  const map = {};
  rows.forEach((r) => {
    const key = unit === 'month' ? r.dayKey.slice(0, 7) : r.dayKey;
    if (!map[key]) {
      map[key] = { key, teams: new Set(), days: new Set(), teamDays: 0, ail: 0, baiguulga: 0, durationMs: 0 };
    }
    const g = map[key];
    g.teams.add(r.teamKey);
    g.days.add(r.dayKey);
    // Мөр бүр нь НЭГ баг × НЭГ өдөр — тиймээс шууд тоолж болно.
    g.teamDays += 1;
    g.ail += r.ail;
    g.baiguulga += r.baiguulga;
    g.durationMs += r.durationMs;
  });
  return Object.values(map)
    .map((g) => ({
      key: g.key,
      label: unit === 'month' ? monthLabel(g.key) : g.key,
      teams: g.teams.size,
      days: g.days.size,
      teamDays: g.teamDays,
      ail: g.ail,
      baiguulga: g.baiguulga,
      durationMs: g.durationMs,
      /** Нэг баг ӨДӨРТ хэдэн айл — ажилласан баг×өдрийн тоонд хуваана. */
      ailPerTeam: g.teamDays ? g.ail / g.teamDays : 0,
      msPerAil: g.ail ? g.durationMs / g.ail : 0,
    }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

/** Өдрөөр нэгтгэсэн хүснэгт. */
export function groupByDay(rows) {
  return groupByPeriod(rows, 'day').map((g) => ({ ...g, dayKey: g.key }));
}

/** Сараар нэгтгэсэн хүснэгт (жилийн горимд хэрэглэнэ). */
export function groupByMonth(rows) {
  return groupByPeriod(rows, 'month').map((g) => ({ ...g, monthKey: g.key }));
}

// ---------------------------------------------------------------------------
// Огнооны муж
// ---------------------------------------------------------------------------

/**
 * Шүүлтийн горим — ӨДӨР · САР · ЖИЛ.
 *
 * Сонгосон горим нь ХОЁР зүйлийг зэрэг шийднэ:
 *   · аль хугацааны мужийг татах вэ,
 *   · график юугаар баганалагдах вэ (өдөр → баг, сар → өдөр, жил → сар).
 *
 * «Тулгуур» (anchor) нь горим бүрт өөр урттай: 2026-08-21 / 2026-08 / 2026.
 */
export const PERIOD_MODES = [
  { key: 'day', label: 'Өдөр' },
  { key: 'month', label: 'Сар' },
  { key: 'year', label: 'Жил' },
];

/** Тухайн горимын «одоо» цэг. */
export function currentAnchor(mode = 'month', date = new Date()) {
  const k = dayKey(date);
  if (mode === 'year') return k.slice(0, 4);
  if (mode === 'month') return k.slice(0, 7);
  return k;
}

/** Горим солиход тулгуурыг тухайн горимын урт руу тааруулна. */
export function normalizeAnchor(mode, anchor) {
  const a = String(anchor || '');
  const fallback = currentAnchor(mode);
  if (mode === 'year') return /^\d{4}/.test(a) ? a.slice(0, 4) : fallback;
  if (mode === 'month') return /^\d{4}-\d{2}/.test(a) ? a.slice(0, 7) : fallback;
  return /^\d{4}-\d{2}-\d{2}/.test(a) ? a.slice(0, 10) : fallback;
}

/** Өмнөх/дараах өдөр · сар · жил рүү шилжинэ. */
export function shiftAnchor(mode, anchor, delta) {
  const a = normalizeAnchor(mode, anchor);
  if (mode === 'year') return String(Number(a.slice(0, 4)) + delta);
  if (mode === 'month') {
    const y = Number(a.slice(0, 4));
    const m = Number(a.slice(5, 7)) - 1 + delta;
    const d = new Date(y, m, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const d = new Date(`${a}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
}

/** Горим + тулгуур → татах муж ба гарчиг. */
export function periodRange(mode = 'month', anchor) {
  const a = normalizeAnchor(mode, anchor);
  if (mode === 'year') {
    return { mode, anchor: a, from: `${a}-01-01`, to: `${a}-12-31`, label: `${a} он`, bucket: 'month' };
  }
  if (mode === 'month') {
    const y = Number(a.slice(0, 4));
    const m = Number(a.slice(5, 7));
    const last = new Date(y, m, 0).getDate();
    return {
      mode,
      anchor: a,
      from: `${a}-01`,
      to: `${a}-${String(last).padStart(2, '0')}`,
      label: `${y} оны ${monthLabel(`${a}-01`)}`,
      bucket: 'day',
    };
  }
  return { mode, anchor: a, from: a, to: a, label: a, bucket: 'team' };
}

/** Одоогийн хугацаан дээр байна уу — «дараах» товчийг хаахад. */
export function isAtLatestPeriod(mode, anchor) {
  return normalizeAnchor(mode, anchor) >= currentAnchor(mode);
}

function dayStartIso(dayK) {
  return new Date(`${dayK}T00:00:00`).toISOString();
}
function dayEndIso(dayK) {
  return new Date(`${dayK}T23:59:59.999`).toISOString();
}

// ---------------------------------------------------------------------------
// Өгөгдөл татах
// ---------------------------------------------------------------------------

/**
 * Мужид ногдох түүхий өгөгдлийг татна.
 *
 * Дуудлага нь МУЖААС ӨМНӨ үүсээд мужид хаагдсан байж болно. Тиймээс
 * `created_at`-ыг буфертэйгээр татаад, хаагдсан өдрөөр нь JS талд шүүнэ.
 */
export async function fetchTeamPerformanceRaw({ from, to }) {
  const createdFrom = new Date(`${from}T00:00:00`);
  createdFrom.setDate(createdFrom.getDate() - CREATED_BUFFER_DAYS);

  const [callsRes, sessionsRes, importRes] = await Promise.all([
    supabase
      .from('service_calls')
      .select('id,site_kind,status,engineer_name,partner_engineer_name,team_name,close_meta,created_at,updated_at')
      .gte('created_at', createdFrom.toISOString())
      .lte('created_at', dayEndIso(to))
      .limit(5000),
    supabase
      .from('field_site_sessions')
      .select('id,driver_name,passengers,arrived_at,departed_at,status')
      .gte('arrived_at', dayStartIso(from))
      .lte('arrived_at', dayEndIso(to))
      .limit(5000),
    supabase
      .from(IMPORT_TABLE)
      .select('*')
      .gte('work_date', from)
      .lte('work_date', to)
      .limit(5000),
  ]);

  if (callsRes.error) throw callsRes.error;
  if (sessionsRes.error) throw sessionsRes.error;

  return {
    calls: callsRes.data || [],
    sessions: sessionsRes.data || [],
    // Импортын хүснэгт хараахан үүсээгүй бол тайлан унахгүй — зүгээр хоосон.
    imported: importRes.error ? [] : importRes.data || [],
    importError: importRes.error ? importRes.error.message : null,
  };
}

/**
 * Бэлэн тайлан — дэлгэц шууд энэ нэг функцийг дуудна.
 *
 * @param {{from: string, to: string, mode?: 'day'|'month'|'year'}} params
 *        `mode` нь зөвхөн ГРАФИКИЙН баганыг сонгоно (тоо нь өөрчлөгдөхгүй).
 */
export async function buildTeamPerformance({ from, to, mode = 'month' }) {
  const raw = await fetchTeamPerformanceRaw({ from, to });
  const rows = buildTeamDayRows({ ...raw, from, to });
  const result = {
    from,
    to,
    mode,
    rows,
    summary: summarize(rows),
    teams: groupByTeam(rows),
    days: groupByDay(rows),
    months: groupByMonth(rows),
    importError: raw.importError,
  };
  result.chart = buildChartData(result, mode);
  return result;
}

// ---------------------------------------------------------------------------
// График
// ---------------------------------------------------------------------------

/** Графикт хэт олон багана орвол уншигдахгүй болно. */
const MAX_CHART_POINTS = 31;

export const CHART_COLORS = {
  ail: '#0099db',
  baiguulga: '#0b7a44',
  perTeam: '#6d4aa8',
  minutes: '#b45309',
};

/**
 * Графикийн багануудыг бэлдэнэ.
 *
 * Горим бүр өөр асуултад хариулна:
 *   өдөр — «энэ өдөр аль баг хэдэн айл хийв»
 *   сар  — «сарын дотор өдөр бүр хэд хийв»
 *   жил  — «жилийн дотор сар бүр хэд хийв»
 *
 * @returns {{kind: string, unitLabel: string, points: {label,ail,baiguulga,perTeam,minPerAil}[]}}
 */
export function buildChartData(result, mode = 'month') {
  if (mode === 'day') {
    const points = (result.teams || []).slice(0, 12).map((t) => ({
      label: t.teamLabel,
      ail: t.ail,
      baiguulga: t.baiguulga,
      perTeam: Math.round((t.ailPerDay || 0) * 10) / 10,
      minPerAil: Math.round((t.msPerAil || 0) / 60000),
    }));
    return { kind: 'team', unitLabel: 'Баг', points };
  }

  const groups = mode === 'year' ? result.months || [] : result.days || [];
  // Тайлангийн хүснэгт нь шинэ→хуучин, график нь ЗҮҮНЭЭС БАРУУН ТИЙШ
  // цаг хугацааны дарааллаар байх ёстой.
  const asc = [...groups].sort((a, b) => a.key.localeCompare(b.key)).slice(-MAX_CHART_POINTS);
  const points = asc.map((g) => ({
    label: mode === 'year' ? g.label : g.key.slice(8),
    fullLabel: g.key,
    ail: g.ail,
    baiguulga: g.baiguulga,
    perTeam: Math.round((g.ailPerTeam || 0) * 10) / 10,
    minPerAil: Math.round((g.msPerAil || 0) / 60000),
  }));
  return { kind: mode === 'year' ? 'month' : 'day', unitLabel: mode === 'year' ? 'Сар' : 'Өдөр', points };
}

// ---------------------------------------------------------------------------
// Excel / CSV — импорт
// ---------------------------------------------------------------------------

function headerIndexMap(headerCells) {
  const norm = (v) => clean(v).toLowerCase().replace(/\(.*?\)/g, '').trim();
  const cells = headerCells.map(norm);
  const find = (...aliases) => cells.findIndex((c) => aliases.some((a) => c === a || c.startsWith(a)));
  return {
    work_date: find('огноо', 'date', 'өдөр'),
    team_name: find('баг', 'team'),
    members: find('гишүүд', 'гишүүн', 'member'),
    ail_count: find('айл', 'ail'),
    baiguulga_count: find('байгууллага', 'baiguulga'),
    duration_minutes: find('хугацаа', 'минут', 'duration'),
    note: find('тайлбар', 'note'),
  };
}

/** "2026-08-21", "2026/8/21", "21.08.2026", Excel serial → "2026-08-21" */
export function normalizeDateCell(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return dayKey(value);
  const s = clean(value);
  // Excel-ийн серийн дугаар (1899-12-30-аас хойших өдөр)
  if (/^\d{5}$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000);
    return Number.isNaN(d.getTime()) ? null : dayKey(d);
  }
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : dayKey(d);
}

function numberCell(value) {
  const n = Number(
    String(value ?? '')
      .replace(/[^\d.,-]/g, '')
      .replace(',', '.')
  );
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/**
 * Excel/CSV-ийн мөрийн массивыг шалгаж, хадгалахад бэлэн болгоно.
 *
 * @param {any[][]} matrix эхний мөр нь толгой
 * @returns {{rows: any[], errors: string[], skipped: number}}
 */
export function parseImportMatrix(matrix) {
  const grid = (matrix || []).filter((r) => Array.isArray(r) && r.some((c) => clean(c)));
  if (!grid.length) return { rows: [], errors: ['Файл хоосон байна.'], skipped: 0 };

  const idx = headerIndexMap(grid[0]);
  if (idx.work_date < 0 || idx.team_name < 0) {
    return {
      rows: [],
      errors: [`Толгой мөр таарахгүй байна. Багана: ${IMPORT_HEADER.join(' · ')}`],
      skipped: 0,
    };
  }

  const errors = [];
  const byKey = {};
  let skipped = 0;

  grid.slice(1).forEach((cells, i) => {
    const lineNo = i + 2;
    const workDate = normalizeDateCell(cells[idx.work_date]);
    const teamName = clean(cells[idx.team_name]);
    if (!workDate && !teamName) return;
    if (!workDate) {
      errors.push(`${lineNo}-р мөр: огноо буруу (${clean(cells[idx.work_date]) || 'хоосон'})`);
      skipped += 1;
      return;
    }
    if (!teamName) {
      errors.push(`${lineNo}-р мөр: багийн нэр хоосон`);
      skipped += 1;
      return;
    }
    const row = {
      work_date: workDate,
      team_name: teamName,
      members: idx.members >= 0 ? clean(cells[idx.members]) || null : null,
      ail_count: idx.ail_count >= 0 ? numberCell(cells[idx.ail_count]) : 0,
      baiguulga_count: idx.baiguulga_count >= 0 ? numberCell(cells[idx.baiguulga_count]) : 0,
      duration_minutes: idx.duration_minutes >= 0 ? numberCell(cells[idx.duration_minutes]) : 0,
      note: idx.note >= 0 ? clean(cells[idx.note]) || null : null,
    };
    // Нэг файлд нэг өдөр·баг хоёр удаа байвал НЭМЖ нэгтгэнэ — үгүй бол
    // upsert дээр эхнийх нь чимээгүй алга болно.
    const key = `${row.work_date}|${row.team_name.toLowerCase()}`;
    if (byKey[key]) {
      byKey[key].ail_count += row.ail_count;
      byKey[key].baiguulga_count += row.baiguulga_count;
      byKey[key].duration_minutes += row.duration_minutes;
    } else {
      byKey[key] = row;
    }
  });

  const rows = Object.values(byKey).sort((a, b) => a.work_date.localeCompare(b.work_date));
  if (!rows.length && !errors.length) errors.push('Хадгалах мөр олдсонгүй.');
  return { rows, errors, skipped };
}

function uuid() {
  const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s()}${s()}-${s()}-4${s().slice(1)}-a${s().slice(1)}-${s()}${s()}${s()}`;
}

/**
 * Импортын мөрүүдийг хадгална.
 *
 * Нэг өдөр · нэг баг = нэг мөр (unique index). Дахин импортлоход
 * ХУУЧИН МӨР ДАРАГДАНА — давхардуулж нэмэхгүй.
 */
export async function saveImportedRows(rows, { userId, userName, batchName } = {}) {
  if (!rows?.length) return { inserted: 0, batchId: null };
  const batchId = uuid();
  const payload = rows.map((r) => ({
    ...r,
    batch_id: batchId,
    batch_name: batchName || null,
    created_by: userId || null,
    created_by_name: userName || null,
    updated_at: new Date().toISOString(),
  }));
  const { data, error } = await supabase
    .from(IMPORT_TABLE)
    .upsert(payload, { onConflict: 'work_date,team_name' })
    .select('id');
  if (error) throw error;
  return { inserted: data?.length ?? payload.length, batchId };
}

/** Буруу оруулсан багцыг бүхэлд нь буцаана. */
export async function deleteImportBatch(batchId) {
  const { error } = await supabase.from(IMPORT_TABLE).delete().eq('batch_id', batchId);
  if (error) throw error;
}

export async function fetchImportedEntries({ from, to } = {}) {
  let q = supabase.from(IMPORT_TABLE).select('*').order('work_date', { ascending: false }).limit(2000);
  if (from) q = q.gte('work_date', from);
  if (to) q = q.lte('work_date', to);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ---------------------------------------------------------------------------
// Excel / CSV — экспорт
// ---------------------------------------------------------------------------

const toMin = (ms) => Math.round(ms / 60000);
const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

/**
 * Тайланг хуудас (sheet) болгож бэлдэнэ. Мобайл ба admin-web ижил
 * бүтэцтэй файл гаргана — нэг тайланг хоёр газраас татсан ч ижил.
 */
export const CHART_SHEET = 'График өгөгдөл';
export const TEAM_SHEET = 'Багаар';

export function buildExportSheets(result) {
  const s = result.summary;
  const chart = result.chart || buildChartData(result, result.mode || 'month');
  return [
    {
      name: 'Нэгтгэл',
      rows: [
        ['Үзүүлэлт', 'Утга'],
        ['Хугацааны муж', `${result.from} — ${result.to}`],
        ['Нийт баг', s.teams],
        ['Ажилласан өдөр', s.days],
        ['Баг × өдөр', s.teamDays],
        ['Нийт айл', s.ail],
        ['Нийт байгууллага', s.baiguulga],
        ['Нийт ажил', s.total],
        ['Өдөрт дундаж айл', round1(s.ailPerDay)],
        ['1 баг өдөрт дундаж айл', round1(s.ailPerTeamDay)],
        ['Нийт хугацаа (мин)', toMin(s.durationMs)],
        ['Нийт хугацаа (цаг)', round1(s.durationMs / 3600000)],
        ['1 айлд ногдох дундаж (мин)', toMin(s.msPerAil)],
      ],
    },
    {
      name: TEAM_SHEET,
      rows: [
        [
          'Баг',
          'Гишүүд',
          'Ажилласан өдөр',
          'Айл',
          'Байгууллага',
          'Өдөрт дундаж айл',
          'Нийт хугацаа (мин)',
          '1 айлын дундаж (мин)',
          'Сүүлд ажилласан',
        ],
        ...result.teams.map((t) => [
          t.teamLabel,
          t.members.join(', '),
          t.days,
          t.ail,
          t.baiguulga,
          round1(t.ailPerDay),
          toMin(t.durationMs),
          toMin(t.msPerAil),
          t.lastDay,
        ]),
      ],
    },
    {
      name: 'Өдрөөр',
      rows: [
        ['Огноо', 'Идэвхтэй баг', 'Айл', 'Байгууллага', '1 баг өдөрт айл', 'Нийт хугацаа (мин)'],
        ...result.days.map((d) => [
          d.dayKey,
          d.teams,
          d.ail,
          d.baiguulga,
          round1(d.ailPerTeam),
          toMin(d.durationMs),
        ]),
      ],
    },
    {
      name: 'Баг-өдөр дэлгэрэнгүй',
      rows: [
        [
          'Огноо',
          'Баг',
          'Гишүүд',
          'Айл',
          'Байгууллага',
          'Дуудлага',
          'Ажлын байр (тоо)',
          'Хугацаа (мин)',
          'Хугацааны эх сурвалж',
        ],
        ...result.rows.map((r) => [
          r.dayKey,
          r.teamLabel,
          r.members.join(', '),
          r.ail,
          r.baiguulga,
          r.calls,
          r.sessions,
          toMin(r.durationMs),
          r.durationSource,
        ]),
      ],
    },
    {
      // ГРАФИКИЙН эх өгөгдөл. Excel доторх график ЯГ энэ хуудсан руу
      // заана — тоог нь засвал график шууд дагаж өөрчлөгдөнө.
      name: CHART_SHEET,
      rows: [
        [chart.unitLabel, 'Айл', 'Байгууллага', '1 баг өдөрт айл', '1 айлын дундаж (мин)'],
        ...chart.points.map((p) => [p.label, p.ail, p.baiguulga, p.perTeam, p.minPerAil]),
      ],
    },
    {
      // Импортын загвар — энэ хуудсыг бөглөөд буцааж импортлоно.
      name: 'Импорт загвар',
      rows: [
        IMPORT_HEADER,
        ...result.rows.map((r) => [
          r.dayKey,
          r.teamLabel,
          r.members.join(', '),
          r.ail,
          r.baiguulga,
          toMin(r.durationMs),
          '',
        ]),
      ],
    },
  ];
}

/**
 * Excel файлд суулгах ГРАФИКУУДЫН тодорхойлолт.
 *
 * `admin-web/xlsx-chart.js` энэ жагсаалтыг уншаад Excel-ийн жинхэнэ
 * график болгож хөрвүүлнэ. `sheet` нь дээрх хуудсуудын нэртэй, `col` нь
 * тэр хуудасны баганын дугаартай ЯГ таарах ёстой.
 */
export function buildExportCharts(result) {
  const chart = result.chart || buildChartData(result, result.mode || 'month');
  const unit = chart.unitLabel;
  return [
    {
      title: `${unit} тус бүрийн ажил — айл ба байгууллага`,
      type: 'bar',
      sheet: CHART_SHEET,
      catCol: 0,
      series: [
        { col: 1, name: 'Айл', color: '0099DB' },
        { col: 2, name: 'Байгууллага', color: '0B7A44' },
      ],
    },
    {
      title: '1 баг өдөрт хэдэн айл',
      type: 'line',
      sheet: CHART_SHEET,
      catCol: 0,
      series: [{ col: 3, name: '1 баг өдөрт айл', color: '6D4AA8' }],
    },
    {
      title: '1 айлд ногдох дундаж хугацаа (мин)',
      type: 'line',
      sheet: CHART_SHEET,
      catCol: 0,
      series: [{ col: 4, name: 'Минут', color: 'B45309' }],
    },
    {
      title: 'Багууд — нийт хийсэн ажил',
      type: 'bar',
      sheet: TEAM_SHEET,
      catCol: 0,
      series: [
        { col: 3, name: 'Айл', color: '0099DB' },
        { col: 4, name: 'Байгууллага', color: '0B7A44' },
      ],
    },
  ];
}

/** Хоосон импортын загвар — юу ч байхгүй үед татаж бөглөнө. */
export function buildTemplateMatrix() {
  return [
    IMPORT_HEADER,
    IMPORT_COLUMNS.map((c) => c.hint),
    [dayKey(new Date()), 'Баг 1', 'Болд, Дорж', 5, 1, 420, 'Жишээ мөр — устгаад бөглөнө үү'],
  ];
}

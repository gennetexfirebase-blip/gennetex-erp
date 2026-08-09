/**
 * AI Админ туслах — админд бүх ажилтныг хянах, ажил хуваарилах, Excel гаргахад тусална.
 * Өгөгдөл: ажилтан, үйлчилгээний дуудлага (SLA), ирц.
 * AI: Gemini (gennetexAiService.callGeminiText) ашиглана.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { callGeminiText } from './gennetexAiService';
import { fetchEmployees } from './authService';
import { fetchServiceCalls } from './serviceCallService';
import { countTodayCheckIns } from './attendanceService';
import { getSlaRemainingMs, isSlaExceeded, isSlaWarning, formatDateTime } from '../lib/callSla';
import { CALL_TYPES } from '../data/mockData';

function visitTypeLabel(key) {
  return CALL_TYPES.find((t) => t.key === key)?.label || 'Бусад';
}

const DONE_STATUSES = new Set(['Дууссан']);

function ageHours(iso) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 3600000));
}

/** Компанийн одоогийн төлөвийг цуглуулна (админ хяналт). */
export async function gatherAdminSnapshot() {
  const [staff, calls, todayCheckins] = await Promise.all([
    fetchEmployees().catch(() => []),
    fetchServiceCalls().catch(() => []),
    countTodayCheckIns().catch(() => 0),
  ]);

  const overdueCalls = [];
  const warningCalls = [];
  const byEngineer = {};

  let done = 0;
  let pending = 0;

  calls.forEach((c) => {
    const eng = (c.engineer || '').trim() || '—';
    if (!byEngineer[eng]) byEngineer[eng] = { name: eng, total: 0, done: 0, overdue: 0, active: 0 };
    const row = byEngineer[eng];
    row.total += 1;

    const isDone = DONE_STATUSES.has(c.status);
    if (isDone) {
      done += 1;
      row.done += 1;
    } else {
      pending += 1;
      row.active += 1;
    }

    if (!isDone && isSlaExceeded(c)) {
      row.overdue += 1;
      overdueCalls.push({
        customer: c.customer || '—',
        engineer: eng,
        status: c.status,
        created_at: c.created_at,
        ageHours: ageHours(c.created_at),
      });
    } else if (!isDone && isSlaWarning(c)) {
      warningCalls.push({
        customer: c.customer || '—',
        engineer: eng,
        status: c.status,
        remainingMs: getSlaRemainingMs(c),
      });
    }
  });

  const callsByEngineer = Object.values(byEngineer).sort((a, b) => b.overdue - a.overdue || b.total - a.total);
  overdueCalls.sort((a, b) => b.ageHours - a.ageHours);

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      employees: staff.length,
      todayCheckins,
      calls: calls.length,
      done,
      pending,
      overdue: overdueCalls.length,
      warning: warningCalls.length,
    },
    employees: staff.map((s) => ({ id: s.id, name: s.name || s.email || '—', role: s.role || 'employee' })),
    callsByEngineer,
    overdueCalls: overdueCalls.slice(0, 40),
    warningCalls: warningCalls.slice(0, 40),
  };
}

/** LLM-д өгөх богино контекст текст. */
export function snapshotToContextText(s) {
  if (!s) return '';
  const c = s.counts;
  const lines = [
    `Огноо: ${formatDateTime(s.generatedAt)}`,
    `Ажилтан: ${c.employees}, өнөөдөр ирсэн: ${c.todayCheckins}`,
    `Дуудлага: нийт ${c.calls}, дууссан ${c.done}, идэвхтэй ${c.pending}, SLA хэтэрсэн ${c.overdue}, анхаарах ${c.warning}`,
    '',
    'Инженер тус бүрийн дуудлага (нэр | нийт | дууссан | идэвхтэй | SLA хэтэрсэн):',
    ...s.callsByEngineer.map((e) => `- ${e.name} | ${e.total} | ${e.done} | ${e.active} | ${e.overdue}`),
  ];
  if (s.overdueCalls.length) {
    lines.push('', 'SLA хэтэрсэн дуудлагууд (харилцагч | инженер | төлөв | цаг):');
    s.overdueCalls.slice(0, 20).forEach((o) =>
      lines.push(`- ${o.customer} | ${o.engineer} | ${o.status} | ${o.ageHours}ц өмнө`)
    );
  }
  return lines.join('\n');
}

const ADMIN_SYSTEM = `Та бол Gennetex компанийн "AI Админ туслах". Админд бүх ажилтныг хянах, ажил (дуудлага/даалгавар) хуваарилах, SLA тогтоох, дүгнэлт гаргахад тусална.
Танд компанийн одоогийн төлөвийн өгөгдөл өгнө. Түүнд тулгуурлан ТОВЧ, ПРАКТИК, монгол хэлээр хариул.

Хэрэв админ ажил/даалгавар хуваарилахыг хүсвэл (жишээ: "Батад суурилуулалт өг, SLA 24 цаг") tasks массивт бүтэцлэж оруул.
Хэрэв зүгээр асуулт/дүгнэлт бол tasks-ыг хоосон [] буцаа.

ЗӨВХӨН дараах JSON буцаа (өөр текст үгүй):
{
  "answer": "админд зориулсан хариу / дүгнэлт (монголоор)",
  "tasks": [
    { "employee": "ажилтны нэр", "task": "хийх ажил", "sla": "жишээ: 24 цаг", "priority": "low|medium|high", "note": "нэмэлт тайлбар" }
  ]
}`;

/** Админы асуултад компанийн өгөгдөл дээр тулгуурлан хариулна. */
export async function askAiAdmin(question, snapshot, history = []) {
  const q = String(question || '').trim();
  if (!q) throw new Error('Асуулт хоосон байна');

  const ctx = snapshotToContextText(snapshot);
  const historyText = (history || [])
    .slice(-6)
    .map((m) => `${m.role === 'assistant' ? 'AI' : 'Админ'}: ${m.content}`)
    .join('\n');

  const userText = [
    '=== КОМПАНИЙН ОДООГИЙН ТӨЛӨВ ===',
    ctx,
    historyText ? `\n=== СҮҮЛИЙН ЯРИА ===\n${historyText}` : '',
    `\n=== АДМИНЫ АСУУЛТ ===\n${q}`,
  ].join('\n');

  const parsed = await callGeminiText(ADMIN_SYSTEM, userText, { json: true });
  if (parsed && typeof parsed === 'object') {
    return {
      answer: String(parsed.answer || '').trim() || 'Хариу хоосон байна.',
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks.filter((t) => t && (t.task || t.employee)) : [],
    };
  }
  return { answer: String(parsed || '').trim() || 'Хариу хоосон байна.', tasks: [] };
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function xlsDocument(title, sections) {
  const blocks = sections
    .map((sec) => {
      const head = sec.columns.map((c) => `<th>${esc(c)}</th>`).join('');
      const rows = sec.rows.length
        ? sec.rows
            .map((r) => `<tr>${r.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`)
            .join('')
        : `<tr><td colspan="${sec.columns.length}">Мэдээлэл алга</td></tr>`;
      return `<h3>${esc(sec.title)}</h3><table border="1"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table><br/>`;
    })
    .join('');
  return `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/>
<style>table{border-collapse:collapse}th{background:#e5edff;text-align:left;padding:4px 8px}td{padding:4px 8px}h3{font-family:sans-serif}</style>
</head><body><h2>${esc(title)}</h2>${blocks}</body></html>`;
}

async function writeAndShare(filename, content, mimeType) {
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
  const canShare = await Sharing.isAvailableAsync().catch(() => false);
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: filename });
  }
  return uri;
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Хяналтын бүрэн snapshot-ыг Excel болгож хуваалцана. */
export async function exportSnapshotExcel(snapshot) {
  const s = snapshot;
  const c = s.counts;
  const html = xlsDocument(`Gennetex — Хяналтын тайлан (${formatDateTime(s.generatedAt)})`, [
    {
      title: 'Ерөнхий үзүүлэлт',
      columns: ['Үзүүлэлт', 'Тоо'],
      rows: [
        ['Ажилтан', c.employees],
        ['Өнөөдөр ирсэн', c.todayCheckins],
        ['Нийт дуудлага', c.calls],
        ['Дууссан', c.done],
        ['Идэвхтэй', c.pending],
        ['SLA хэтэрсэн', c.overdue],
        ['Анхаарах (SLA ойрхон)', c.warning],
      ],
    },
    {
      title: 'Инженерийн гүйцэтгэл',
      columns: ['Инженер', 'Нийт', 'Дууссан', 'Идэвхтэй', 'SLA хэтэрсэн'],
      rows: s.callsByEngineer.map((e) => [e.name, e.total, e.done, e.active, e.overdue]),
    },
    {
      title: 'SLA хэтэрсэн дуудлага',
      columns: ['Харилцагч', 'Инженер', 'Төлөв', 'Хугацаа (цаг)'],
      rows: s.overdueCalls.map((o) => [o.customer, o.engineer, o.status, o.ageHours]),
    },
    {
      title: 'Ажилтны жагсаалт',
      columns: ['Нэр', 'Эрх'],
      rows: s.employees.map((e) => [e.name, e.role]),
    },
  ]);
  return writeAndShare(`gennetex_hyanalt_${stamp()}.xls`, html, 'application/vnd.ms-excel');
}

/**
 * Айлд очсон логийг Excel болгож татна.
 * 1-р хуудас: хүн бүрийн нэгтгэл (хэн хэдэн айлд очсон)
 * 2-р хуудас: дэлгэрэнгүй лог (хэн хэнийх рүү очсон)
 */
export async function exportVisitsExcel(visits) {
  const list = visits || [];
  const byPerson = {};
  list.forEach((v) => {
    const name = v.user_name || 'Тодорхойгүй';
    if (!byPerson[name]) byPerson[name] = { total: 0, places: new Set(), last: null };
    byPerson[name].total += 1;
    byPerson[name].places.add((v.customer || v.location_name || '—').trim());
    const t = v.arrived_at;
    if (t && (!byPerson[name].last || new Date(t) > new Date(byPerson[name].last))) {
      byPerson[name].last = t;
    }
  });
  const summaryRows = Object.entries(byPerson)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, s]) => [name, s.total, s.places.size, s.last ? formatDateTime(s.last) : '—']);
  const detailRows = list.map((v) => [
    v.customer || v.location_name || '—',
    v.user_name || '—',
    visitTypeLabel(v.call_type),
    v.problem || '',
    v.arrived_at ? formatDateTime(v.arrived_at) : '',
    v.face_verified ? 'Тийм' : 'Үгүй',
  ]);
  const html = xlsDocument(`Gennetex — Айлд очсон лог (${formatDateTime(new Date().toISOString())})`, [
    {
      title: 'Хүн бүрийн нэгтгэл',
      columns: ['Ажилтан', 'Нийт очсон удаа', 'Ялгаатай айл/газар', 'Сүүлд очсон'],
      rows: summaryRows,
    },
    {
      title: 'Дэлгэрэнгүй лог (хэн хэнийх рүү)',
      columns: ['Айл/Байршил', 'Ажилтан', 'Төрөл', 'Асуудал', 'Огноо', 'Царай'],
      rows: detailRows,
    },
  ]);
  return writeAndShare(`gennetex_ocson_log_${stamp()}.xls`, html, 'application/vnd.ms-excel');
}

/** AI-ийн санал болгосон ажлын хуваарийг Excel болгоно. */
export async function exportTasksExcel(tasks, title = 'Ажлын хуваарь') {
  const html = xlsDocument(`Gennetex — ${title} (${formatDateTime(new Date().toISOString())})`, [
    {
      title,
      columns: ['Ажилтан', 'Ажил / даалгавар', 'SLA', 'Чухал зэрэг', 'Тайлбар'],
      rows: (tasks || []).map((t) => [t.employee || '—', t.task || '—', t.sla || '—', t.priority || '—', t.note || '']),
    },
  ]);
  return writeAndShare(`gennetex_ajil_${stamp()}.xls`, html, 'application/vnd.ms-excel');
}

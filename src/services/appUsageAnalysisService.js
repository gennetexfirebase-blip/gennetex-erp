import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { callGeminiText, getGeminiKeyAsync } from './gennetexAiService';
import { fetchActivityLogs, actionLabel } from './activityLogService';
import { screenLabel } from './screenPresenceService';
import { dayKey } from '../lib/workHours';

const TABLE = 'ai_performance_reports';
const REPORT_TYPE = 'app_usage';
const MAX_AGE_HOURS = 24;

let autoRunning = false;

const USAGE_SYSTEM = `Та бол Gennetex ERP аппын ажилтны хэрэглээний AI шинжлэгч.
Өгөгдөл: бүх нэвтэрсэн ажилтны апп ашиглалт (дэлгэц, үйлдэл, идэвхтэй өдөр, сүүлийн ирц).
Монгол хэлээр, товч, практик дүгнэлт бич. Хэн сайн ашиглаж байгаа, хэн бага идэвхтэй, ямар модуль дутуу ашиглагдаж байгааг шинжил.

JSON хэлбэрээр буцаа:
{
  "summary": "Ерөнхий 2-4 өгүүлбэр",
  "employees": [{"name":"Нэр","usage_level":"high|medium|low|inactive","login_count":0,"active_days":0,"total_events":0,"top_screens":[],"patterns":[],"recommendation":"","risk_flags":[]}],
  "alerts": ["Админ анхаарах"],
  "module_insights": [{"module":"Модуль","detail":"Тайлбар"}]
}`;

function buildEmployeeRow(id, name, email, role, lastSeen) {
  return {
    user_id: id || null,
    name: name || 'Тодорхойгүй',
    email: email || null,
    role: role || 'employee',
    last_seen: lastSeen || null,
    logged_in: false,
    login_count: 0,
    total_events: 0,
    active_days: 0,
    screen_opens: 0,
    actions: {},
    top_screens: [],
    first_activity: null,
    last_activity: null,
    sample_details: [],
    usage_score: 0,
  };
}

export async function collectEmployeeUsageStats(from, to) {
  const [logs, profilesRes] = await Promise.all([
    fetchActivityLogs({ from, to, limit: 8000 }),
    supabase
      .from('profiles')
      .select('id,name,email,role,last_seen')
      .in('role', ['employee', 'admin', 'superadmin'])
      .order('name'),
  ]);

  const profiles = (profilesRes.data || []).filter((p) => p.id && (p.name || p.email));
  const byUser = {};
  const ensure = (id, name, email, role, lastSeen) => {
    const key = id || String(name || 'unknown').toLowerCase();
    if (!byUser[key]) byUser[key] = buildEmployeeRow(id, name, email, role, lastSeen);
    return byUser[key];
  };

  profiles.forEach((p) => ensure(p.id, p.name || p.email, p.email, p.role, p.last_seen));

  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const activeDaySets = {};

  (logs || []).forEach((log) => {
    const uid = log.user_id;
    if (!uid) return;
    const row = ensure(uid, log.user_name, null, 'employee', null);
    row.total_events += 1;
    row.logged_in = true;

    const action = log.action || 'other';
    row.actions[action] = (row.actions[action] || 0) + 1;
    if (action === 'login') row.login_count += 1;
    if (action === 'screen') row.screen_opens += 1;

    const at = log.created_at;
    if (!row.first_activity || at < row.first_activity) row.first_activity = at;
    if (!row.last_activity || at > row.last_activity) row.last_activity = at;

    const dk = dayKey(new Date(at));
    if (!activeDaySets[uid]) activeDaySets[uid] = new Set();
    activeDaySets[uid].add(dk);

    if (row.sample_details.length < 6) {
      row.sample_details.push({
        at,
        action,
        action_label: actionLabel(action),
        screen: log.screen,
        screen_label: log.screen ? screenLabel(log.screen) : null,
        detail: String(log.detail || '').slice(0, 120),
      });
    }
  });

  Object.values(byUser).forEach((row) => {
    if (!row.user_id) return;
    const prof = profiles.find((p) => p.id === row.user_id);
    if (prof?.last_seen) row.last_seen = prof.last_seen;

    const seenMs = row.last_seen ? new Date(row.last_seen).getTime() : 0;
    if (seenMs >= fromMs && seenMs <= toMs) row.logged_in = true;

    row.active_days = activeDaySets[row.user_id]?.size || 0;

    const screenCounts = {};
    (logs || []).forEach((log) => {
      if (log.user_id !== row.user_id || log.action !== 'screen' || !log.screen) return;
      screenCounts[log.screen] = (screenCounts[log.screen] || 0) + 1;
    });
    row.top_screens = Object.entries(screenCounts)
      .map(([screen, count]) => ({ screen, label: screenLabel(screen), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    row.usage_score = Math.min(
      100,
      row.active_days * 8 + row.total_events * 0.5 + row.login_count * 5 + (row.screen_opens > 0 ? 10 : 0)
    );
  });

  const employees = Object.values(byUser)
    .filter((e) => e.name !== 'Тодорхойгүй')
    .sort((a, b) => b.total_events - a.total_events || b.active_days - a.active_days);

  const loggedInCount = employees.filter((e) => e.logged_in).length;

  return {
    from,
    to,
    employees,
    total_events: logs.length,
    logged_in_count: loggedInCount,
    employee_count: employees.length,
  };
}

export function getEmployeeFromUsageStats(stats, userId, userName) {
  if (!stats?.employees?.length) return null;
  if (userId) {
    const hit = stats.employees.find((e) => e.user_id === userId);
    if (hit) return hit;
  }
  const n = String(userName || '')
    .trim()
    .toLowerCase();
  return stats.employees.find((e) => String(e.name || '').toLowerCase() === n) || null;
}

export function formatUsageEmployeeDetail(row) {
  if (!row) return 'Мэдээлэл алга.';
  const lines = [
    `👤 ${row.name}`,
    `Нэвтэрсэн: ${row.logged_in ? 'Тийм' : 'Үгүй'} · Нэвтрэлт: ${row.login_count} · Идэвхтэй өдөр: ${row.active_days}`,
    `Нийт үйлдэл: ${row.total_events} · Дэлгэц нээлт: ${row.screen_opens}`,
    row.last_seen ? `Сүүлийн ирц: ${new Date(row.last_seen).toLocaleString('mn-MN')}` : 'Сүүлийн ирц: —',
  ];
  if (row.top_screens?.length) {
    lines.push(`\nТоп дэлгэц: ${row.top_screens.map((s) => `${s.label}(${s.count})`).join(', ')}`);
  }
  if (row.actions && Object.keys(row.actions).length) {
    lines.push('\nҮйлдлүүд:');
    Object.entries(row.actions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([k, v]) => lines.push(`• ${actionLabel(k)}: ${v}`));
  }
  if (row.sample_details?.length) {
    lines.push('\nСүүлийн үйлдлүүд:');
    row.sample_details.forEach((s) => {
      lines.push(`• ${new Date(s.at).toLocaleString('mn-MN')} — ${s.action_label}${s.screen_label ? ` · ${s.screen_label}` : ''}`);
    });
  }
  return lines.join('\n');
}

function formatUsageAnalysisText(parsed, stats) {
  if (!parsed || typeof parsed === 'string') return String(parsed || '');
  const lines = [parsed.summary || ''];
  (parsed.employees || []).forEach((e) => {
    lines.push(
      `\n• ${e.name} [${e.usage_level || '—'}] — ${e.active_days ?? 0} өдөр, ${e.total_events ?? 0} үйлдэл, нэвтрэлт ${e.login_count ?? 0}`
    );
    if (e.top_screens?.length) lines.push(`  Дэлгэц: ${e.top_screens.join(', ')}`);
    if (e.patterns?.length) lines.push(`  Давтамж: ${e.patterns.join('; ')}`);
    if (e.risk_flags?.length) lines.push(`  ⚠️ ${e.risk_flags.join('; ')}`);
    if (e.recommendation) lines.push(`  Зөвлөмж: ${e.recommendation}`);
  });
  if (parsed.module_insights?.length) {
    lines.push('\nМодуль:');
    parsed.module_insights.forEach((m) => lines.push(`- ${m.module}: ${m.detail}`));
  }
  if (parsed.alerts?.length) {
    lines.push('\nАнхааруулга:');
    parsed.alerts.forEach((a) => lines.push(`- ${a}`));
  }
  lines.push(
    `\n(${stats.logged_in_count}/${stats.employee_count} ажилтан идэвхтэй, ${stats.total_events} үйлдэл)`
  );
  return lines.join('\n').trim();
}

function defaultUsageRange(days = 14) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString(), periodLabel: `сүүлийн ${days} хоног` };
}

export async function runAppUsageAnalysis({
  from,
  to,
  periodLabel,
  createdBy,
  createdByName,
} = {}) {
  const range = from && to ? { from, to, periodLabel } : defaultUsageRange();
  const stats = await collectEmployeeUsageStats(range.from, range.to);
  const payload = {
    period: range.periodLabel || `${range.from} — ${range.to}`,
    stats: {
      ...stats,
      employees: stats.employees?.map(({ sample_details, actions, ...rest }) => ({
        ...rest,
        actions_summary: actions,
      })),
    },
  };

  let parsed = null;
  let analysisText = '';
  try {
    parsed = await callGeminiText(USAGE_SYSTEM, JSON.stringify(payload, null, 2), { json: true });
    analysisText = formatUsageAnalysisText(parsed, stats);
  } catch (e) {
    analysisText = `AI шинжилгээ амжилтгүй: ${e.message}\n\nГараар статистик:\n${stats.employees
      .slice(0, 20)
      .map(
        (en) =>
          `${en.name}: ${en.logged_in ? 'нэвтэрсэн' : 'идэвхгүй'}, ${en.total_events} үйлдэл, ${en.active_days} өдөр`
      )
      .join('\n')}`;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      report_type: REPORT_TYPE,
      period_label: range.periodLabel || periodLabel || null,
      period_start: range.from,
      period_end: range.to,
      stats,
      analysis_text: analysisText,
      created_by: createdBy || null,
      created_by_name: createdByName || null,
    })
    .select()
    .single();
  if (error) {
    if (/ai_performance_reports/i.test(error.message)) {
      throw new Error('ai_performance_reports хүснэгт байхгүй. migration_feedback_performance.sql ажиллуулна уу.');
    }
    throw error;
  }
  return { report: data, parsed, stats };
}

export async function fetchAppUsageReports(limit = 20) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('report_type', REPORT_TYPE)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchLatestAppUsageReport() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('report_type', REPORT_TYPE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function runInstantAppUsageAnalysis(createdBy, createdByName) {
  const { report } = await runAppUsageAnalysis({ createdBy, createdByName });
  return report;
}

export async function ensureAppUsageReportIfNeeded(createdBy, createdByName, { force = false, maxAgeHours = MAX_AGE_HOURS } = {}) {
  if (!force) {
    const latest = await fetchLatestAppUsageReport();
    if (latest?.created_at) {
      const ageMs = Date.now() - new Date(latest.created_at).getTime();
      if (ageMs < maxAgeHours * 60 * 60 * 1000) return latest;
    }
  }
  return runInstantAppUsageAnalysis(createdBy, createdByName);
}

export async function runAutoAppUsageAnalysisIfNeeded(createdBy, createdByName, opts = {}) {
  if (!isSupabaseConfigured || autoRunning) return null;
  autoRunning = true;
  try {
    return await ensureAppUsageReportIfNeeded(createdBy, createdByName, opts);
  } finally {
    autoRunning = false;
  }
}

export async function fetchEmployeeUsageDetail(userId, userName, days = 14) {
  const to = new Date().toISOString();
  const from = new Date(Date.now() - days * 24 * 3600000).toISOString();
  const stats = await collectEmployeeUsageStats(from, to);
  const row = getEmployeeFromUsageStats(stats, userId, userName);
  return { row, text: formatUsageEmployeeDetail(row), stats };
}

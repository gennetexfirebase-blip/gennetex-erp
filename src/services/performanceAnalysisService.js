import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { callGeminiText, getGeminiKeyAsync } from './gennetexAiService';
import * as notifyApi from './notificationService';
import {
  collectFullEngineerStats,
  formatEngineerDetailText,
  formatEngineerDetailWithAi,
  getAiInsightForEngineer,
  getEngineerFromStats,
  notifyAnomalies,
} from './engineerPerformanceService';

const TABLE = 'ai_performance_reports';
const INSTANT_REPORT_MAX_AGE_HOURS = 24;

let autoAnalysisRunning = false;

const ANALYSIS_SYSTEM = `Та бол Gennetex компанийн ажилтны гүйцэтгэлийн шинжилгээ хийх AI туслах.
Өгөгдөл: инженерүүдийн дуудлага, SLA хэтрэлт, санал гомдол (нэр дурдсан).
Монгол хэлээр, товч, практик дүгнэлт бич.

JSON хэлбэрээр буцаа:
{
  "summary": "Ерөнхий 2-4 өгүүлбэр",
  "engineers": [
    {
      "name": "Нэр",
      "risk_level": "low|medium|high",
      "sla_exceeded_count": 0,
      "complaint_count": 0,
      "patterns": ["давтагдах асуудал жишээ: залхуу, удаан хариулдаг"],
      "recommendation": "Зөвлөмж"
    }
  ],
  "alerts": ["Админ анхаарах зүйлс"]
}`;

function monthLabel(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function lastMonthRange(ref = new Date()) {
  const start = new Date(ref.getFullYear(), ref.getMonth() - 1, 1, 0, 0, 0, 0);
  const end = new Date(ref.getFullYear(), ref.getMonth(), 0, 23, 59, 59, 999);
  return {
    from: start.toISOString(),
    to: end.toISOString(),
    periodLabel: monthLabel(start),
  };
}

function defaultInstantRange(days = 30) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString(), periodLabel: `сүүлийн ${days} хоног` };
}

export async function collectEngineerStats(from, to) {
  return collectFullEngineerStats(from, to);
}

function formatAnalysisText(parsed, stats) {
  if (!parsed || typeof parsed === 'string') return String(parsed || '');
  const lines = [parsed.summary || ''];
  (parsed.engineers || []).forEach((e) => {
    lines.push(
      `\n• ${e.name} [${e.risk_level || '—'}] — SLA: ${e.sla_exceeded_count ?? 0}, гомдол: ${e.complaint_count ?? 0}`
    );
    if (e.patterns?.length) lines.push(`  Давтамж: ${e.patterns.join('; ')}`);
    if (e.recommendation) lines.push(`  Зөвлөмж: ${e.recommendation}`);
  });
  if (parsed.suspicious_usage?.length) {
    lines.push('\n🔍 Магадгүй буруу хэрэглээ:');
    parsed.suspicious_usage.forEach((s) => lines.push(`- ${s.engineer} @ ${s.customer}: ${s.detail}`));
  }
  if (parsed.alerts?.length) {
    lines.push('\nАнхааруулга:');
    parsed.alerts.forEach((a) => lines.push(`- ${a}`));
  }
  lines.push(`\n(${stats.calls_count} дуудлага, ${stats.feedback_count} санал/гомдол)`);
  return lines.join('\n').trim();
}

export async function runPerformanceAnalysis({
  from,
  to,
  reportType = 'instant',
  periodLabel,
  createdBy,
  createdByName,
} = {}) {
  const range = from && to ? { from, to, periodLabel } : defaultInstantRange();
  const stats = await collectEngineerStats(range.from, range.to);
  const payload = {
    period: range.periodLabel || `${range.from} — ${range.to}`,
    stats: {
      ...stats,
      engineers: stats.engineers?.map(({ complaint_snippets, materials_withdrawn_items, materials_used_items, tools_withdrawn_items, ...rest }) => rest),
    },
    anomalies: stats.anomalies?.slice(0, 30),
  };

  let parsed = null;
  let analysisText = '';
  try {
    parsed = await callGeminiText(ANALYSIS_SYSTEM, JSON.stringify(payload, null, 2), { json: true });
    analysisText = formatAnalysisText(parsed, stats);
  } catch (e) {
    analysisText = `AI шинжилгээ амжилтгүй: ${e.message}\n\nГараар статистик:\n${stats.engineers
      .map(
        (en) =>
          `${en.name}: ${en.total_calls} дуудлага, SLA хэтрэлт ${en.sla_exceeded}, гомдол ${en.complaints_mentioned}`
      )
      .join('\n')}`;
  }

  if (stats.anomalies?.length) {
    try {
      await notifyAnomalies(stats.anomalies);
    } catch (err) {}
  }

  if (parsed?.engineers?.length) {
    stats.ai_insights = {};
    parsed.engineers.forEach((e) => {
      if (e?.name) stats.ai_insights[e.name] = e;
    });
  }
  if (parsed?.summary) stats.summary = parsed.summary;

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      report_type: reportType,
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

  if (reportType === 'monthly') {
    try {
      await notifyApi.notifyAdmins({
        title: `Сарын AI гүйцэтгэл — ${range.periodLabel || ''}`,
        body: (parsed?.summary || analysisText).slice(0, 180),
        data: { type: 'ai_performance_report', reportId: data.id },
        channelId: 'chat',
        priority: 'high',
      });
    } catch (e) {}
  }

  return { report: data, parsed, stats };
}

export async function fetchPerformanceReports(limit = 30) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .in('report_type', ['instant', 'monthly'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchLatestReport(type = null) {
  let q = supabase.from(TABLE).select('*').order('created_at', { ascending: false }).limit(1);
  if (type) q = q.eq('report_type', type);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchReportForPeriod(reportType, periodLabel) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('report_type', reportType)
    .eq('period_label', periodLabel)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Сарын 1–3-нд өмнөх сарын тайлан автоматаар */
export async function ensureMonthlyReportIfNeeded(createdBy, createdByName) {
  const day = new Date().getDate();
  if (day > 3) return null;
  const { from, to, periodLabel } = lastMonthRange();
  const existing = await fetchReportForPeriod('monthly', periodLabel);
  if (existing) return existing;
  const { report } = await runPerformanceAnalysis({
    from,
    to,
    reportType: 'monthly',
    periodLabel,
    createdBy,
    createdByName,
  });
  return report;
}

/** Шууд шинжилгээ — дэлгэц нээх бүрт шууд ажиллана */
export async function runInstantPerformanceAnalysis(createdBy, createdByName) {
  const { report } = await runPerformanceAnalysis({
    reportType: 'instant',
    createdBy,
    createdByName,
  });
  return report;
}

/** Шууд шинжилгээ — force=false бол 24 цагийн cooldown */
export async function ensureInstantReportIfNeeded(createdBy, createdByName, { maxAgeHours = INSTANT_REPORT_MAX_AGE_HOURS, force = false } = {}) {
  if (!force) {
    const latest = await fetchLatestReport('instant');
    if (latest?.created_at) {
      const ageMs = Date.now() - new Date(latest.created_at).getTime();
      if (ageMs < maxAgeHours * 60 * 60 * 1000) return latest;
    }
  }

  return runInstantPerformanceAnalysis(createdBy, createdByName);
}

/** Сарын + шууд шинжилгээг нэг удаа автоматаар ажиллуулна */
export async function runAutoPerformanceAnalysisIfNeeded(createdBy, createdByName, opts = {}) {
  if (!isSupabaseConfigured || autoAnalysisRunning) return null;
  autoAnalysisRunning = true;
  try {
    await ensureMonthlyReportIfNeeded(createdBy, createdByName);
    const instant = await ensureInstantReportIfNeeded(createdBy, createdByName, opts);
    return instant;
  } finally {
    autoAnalysisRunning = false;
  }
}

/** Gemini түлхүүр байгаа эсэх (env + апп дотор хадгалсан) */
export async function isPerformanceAiReady() {
  return Boolean(await getGeminiKeyAsync());
}

export async function fetchEngineerPerformanceDetail(engineerId, engineerName, days = 30) {
  const to = new Date().toISOString();
  const from = new Date(Date.now() - days * 24 * 3600000).toISOString();
  const stats = await collectFullEngineerStats(from, to);
  const row = getEngineerFromStats(stats, engineerId, engineerName);
  return {
    row,
    text: formatEngineerDetailText(row, stats.anomalies),
    stats,
  };
}

export { lastMonthRange, defaultInstantRange, monthLabel, INSTANT_REPORT_MAX_AGE_HOURS, formatEngineerDetailText, formatEngineerDetailWithAi, getAiInsightForEngineer, getEngineerFromStats };

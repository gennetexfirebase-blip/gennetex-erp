/**
 * SLA & KPI auto-report — өдөр / 7 хоног / сар.
 */
import { supabase } from '../lib/supabase';
import { getSlaRemainingMs, isSlaExceeded, SLA_HOURS } from '../lib/callSla';
import { isFlagOn } from '../lib/featureFlags';

function dayStart(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function periodRange(period = 'week') {
  const end = new Date();
  const start = dayStart();
  if (period === 'day') {
    // today
  } else if (period === 'month') {
    start.setDate(1);
  } else {
    // week
    start.setDate(start.getDate() - 6);
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

export function analyzeCallsKpi(calls = []) {
  const list = calls || [];
  const closed = list.filter((c) => c.status === 'Дууссан');
  const open = list.filter((c) => c.status !== 'Дууссан' && c.status !== 'Татгалзсан');
  const slaBreached = open.filter((c) => isSlaExceeded(c));
  const closedBreached = closed.filter((c) => {
    // closed after deadline
    if (!c.created_at || !c.updated_at) return false;
    const deadline = new Date(c.created_at).getTime() + SLA_HOURS * 3600000;
    return new Date(c.updated_at).getTime() > deadline;
  });

  const responseTimes = closed
    .map((c) => {
      const accepted = c.close_meta?.workflow?.accepted_at || c.updated_at;
      if (!c.created_at || !accepted) return null;
      return (new Date(accepted) - new Date(c.created_at)) / 60000;
    })
    .filter((n) => n != null && n >= 0);

  const closeTimes = closed
    .map((c) => {
      if (!c.created_at || !c.updated_at) return null;
      return (new Date(c.updated_at) - new Date(c.created_at)) / 3600000;
    })
    .filter((n) => n != null && n >= 0);

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  // revisit: same phone/address closed twice
  const keyCount = {};
  closed.forEach((c) => {
    const k = `${(c.phone || '').trim()}|${(c.address || '').trim()}`.toLowerCase();
    if (k === '|') return;
    keyCount[k] = (keyCount[k] || 0) + 1;
  });
  const revisits = Object.values(keyCount).filter((n) => n > 1).length;

  return {
    total: list.length,
    closed: closed.length,
    open: open.length,
    slaBreachedOpen: slaBreached.length,
    slaBreachedClosed: closedBreached.length,
    slaCompliancePct:
      closed.length + open.length
        ? Math.round(
            (1 - (slaBreached.length + closedBreached.length) / Math.max(list.length, 1)) * 1000
          ) / 10
        : 100,
    avgFirstResponseMin: Math.round(avg(responseTimes) * 10) / 10,
    avgCloseHours: Math.round(avg(closeTimes) * 10) / 10,
    revisitSites: revisits,
    byEngineer: groupByEngineer(list),
    byStatus: groupBy(list, 'status'),
  };
}

function groupBy(list, key) {
  const m = {};
  list.forEach((c) => {
    const k = c[key] || '—';
    m[k] = (m[k] || 0) + 1;
  });
  return m;
}

function groupByEngineer(list) {
  const m = {};
  list.forEach((c) => {
    const k = c.engineer || c.engineer_name || 'Оноогдоогүй';
    if (!m[k]) m[k] = { name: k, total: 0, closed: 0, open: 0, breached: 0 };
    m[k].total += 1;
    if (c.status === 'Дууссан') m[k].closed += 1;
    else if (c.status !== 'Татгалзсан') m[k].open += 1;
    if (isSlaExceeded(c)) m[k].breached += 1;
  });
  return Object.values(m).sort((a, b) => b.total - a.total);
}

export async function fetchSlaReport(period = 'week') {
  if (!isFlagOn('slaReports') || !supabase) {
    return { kpi: analyzeCallsKpi([]), calls: [], period };
  }
  const { start, end } = periodRange(period);
  const { data, error } = await supabase
    .from('service_calls')
    .select('*')
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  const calls = (data || []).map((r) => ({
    id: r.id,
    customer: r.customer,
    phone: r.phone,
    address: r.address,
    status: r.status,
    engineer: r.engineer_name,
    engineer_id: r.engineer_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
    scheduled_at: r.scheduled_at,
    sla_deadline: r.sla_deadline,
    close_meta: r.close_meta,
    type: r.call_type,
  }));
  return { kpi: analyzeCallsKpi(calls), calls, period, start, end };
}

export function formatSlaReportText(report) {
  const k = report?.kpi || {};
  return [
    `SLA тайлан (${report?.period || 'week'})`,
    `Нийт: ${k.total} · Хаасан: ${k.closed} · Нээлттэй: ${k.open}`,
    `SLA compliance: ${k.slaCompliancePct}%`,
    `SLA хэтэрсэн (нээлттэй): ${k.slaBreachedOpen}`,
    `Дундаж хариу (мин): ${k.avgFirstResponseMin}`,
    `Дундаж хаах (цаг): ${k.avgCloseHours}`,
    `Дахин очсон хаяг: ${k.revisitSites}`,
  ].join('\n');
}

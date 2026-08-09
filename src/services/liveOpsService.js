/**
 * Live ops dashboard data — map + open calls + online workers + SLA.
 */
import { supabase } from '../lib/supabase';
import { isSlaExceeded, isSlaWarning, getSlaRemainingMs, formatCountdown } from '../lib/callSla';
import { isFlagOn } from '../lib/featureFlags';
import * as tracking from './trackingService';

export async function fetchLiveOpsSnapshot() {
  if (!isFlagOn('liveOps')) {
    return { enabled: false, calls: [], workers: [], stats: {} };
  }

  let calls = [];
  let workers = [];

  if (supabase) {
    try {
      const { data } = await supabase
        .from('service_calls')
        .select('*')
        .not('status', 'in', '("Дууссан","Татгалзсан")')
        .order('created_at', { ascending: false })
        .limit(300);
      calls = (data || []).map((r) => ({
        id: r.id,
        customer: r.customer,
        phone: r.phone,
        address: r.address,
        status: r.status,
        engineer: r.engineer_name,
        engineer_id: r.engineer_id,
        latitude: r.latitude,
        longitude: r.longitude,
        type: r.call_type,
        created_at: r.created_at,
        scheduled_at: r.scheduled_at,
        sla_deadline: r.sla_deadline,
        problem: r.problem,
        slaMs: getSlaRemainingMs(r),
        slaExceeded: isSlaExceeded(r),
        slaWarning: isSlaWarning(r),
        slaLabel: formatCountdown(getSlaRemainingMs(r)),
      }));
    } catch {}
  }

  try {
    workers = await tracking.fetchWorkers();
  } catch {
    workers = [];
  }

  const fiveMin = Date.now() - 5 * 60 * 1000;
  const online = (workers || []).filter(
    (w) => w.latitude != null && w.last_seen && new Date(w.last_seen).getTime() > fiveMin
  );

  const unassigned = calls.filter((c) => !c.engineer_id && !c.engineer);
  const red = calls.filter((c) => c.slaExceeded);
  const yellow = calls.filter((c) => c.slaWarning && !c.slaExceeded);

  return {
    enabled: true,
    calls,
    workers: workers || [],
    onlineWorkers: online,
    stats: {
      openCalls: calls.length,
      unassigned: unassigned.length,
      slaRed: red.length,
      slaYellow: yellow.length,
      online: online.length,
      workers: (workers || []).length,
    },
    red,
    yellow,
    unassigned,
    at: new Date().toISOString(),
  };
}

/**
 * Smart Home / Today — өнөөдрийн нэгтгэсэн мэдээлэл.
 */
import { supabase } from '../lib/supabase';
import { isSlaExceeded, isSlaWarning, getSlaRemainingMs } from '../lib/callSla';
import { findLowStockItems } from './lowStockService';
import { isFlagOn } from '../lib/featureFlags';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchTodayBundle({ userId, isAdmin, name } = {}) {
  if (!isFlagOn('smartToday')) {
    return { enabled: false };
  }

  const day = todayKey();
  const result = {
    enabled: true,
    day,
    openCalls: [],
    myCalls: [],
    slaWarnings: [],
    checkInToday: false,
    shift: null,
    ohaabNeeded: false,
    lowStockCount: 0,
    meetingsToday: [],
    pendingOffline: 0,
  };

  if (!supabase || !userId) return result;

  try {
    // My open calls
    let q = supabase
      .from('service_calls')
      .select('*')
      .not('status', 'in', '("Дууссан","Татгалзсан")')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!isAdmin) {
      q = q.eq('engineer_id', userId);
    }
    const { data: calls } = await q;
    const mapped = (calls || []).map((r) => ({
      id: r.id,
      customer: r.customer,
      address: r.address,
      phone: r.phone,
      status: r.status,
      engineer: r.engineer_name,
      engineer_id: r.engineer_id,
      latitude: r.latitude,
      longitude: r.longitude,
      type: r.call_type,
      created_at: r.created_at,
      scheduled_at: r.scheduled_at,
      sla_deadline: r.sla_deadline,
      close_meta: r.close_meta,
      problem: r.problem,
    }));
    result.openCalls = isAdmin ? mapped : mapped.filter((c) => c.engineer_id === userId);
    result.myCalls = mapped.filter((c) => c.engineer_id === userId);
    result.slaWarnings = mapped.filter((c) => isSlaExceeded(c) || isSlaWarning(c));
  } catch {}

  try {
    const { data: att } = await supabase
      .from('attendance')
      .select('id, created_at, kind, type')
      .eq('user_id', userId)
      .gte('created_at', `${day}T00:00:00`)
      .limit(20);
    result.checkInToday = !!(att && att.length);
  } catch {
    try {
      const { data: att2 } = await supabase
        .from('attendance')
        .select('id')
        .eq('staff_id', userId)
        .gte('created_at', `${day}T00:00:00`)
        .limit(5);
      result.checkInToday = !!(att2 && att2.length);
    } catch {}
  }

  try {
    const { data: shifts } = await supabase
      .from('shifts')
      .select('*')
      .eq('user_id', userId)
      .eq('date', day)
      .limit(1);
    result.shift = shifts?.[0] || null;
  } catch {}

  try {
    const { data: meetings } = await supabase
      .from('meetings')
      .select('id, title, starts_at, status')
      .gte('starts_at', `${day}T00:00:00`)
      .lte('starts_at', `${day}T23:59:59`)
      .limit(20);
    result.meetingsToday = meetings || [];
  } catch {}

  if (isAdmin) {
    try {
      const { data: inv } = await supabase.from('inventory').select('id, name, quantity, min_stock, category');
      result.lowStockCount = findLowStockItems(inv || []).length;
    } catch {}
  }

  return result;
}

export function nearestCalls(calls, origin, limit = 5) {
  if (!origin?.latitude) return (calls || []).slice(0, limit);
  return [...(calls || [])]
    .filter((c) => c.latitude != null)
    .map((c) => {
      const dLat = (c.latitude - origin.latitude) * 111;
      const dLng = (c.longitude - origin.longitude) * 85;
      const km = Math.sqrt(dLat * dLat + dLng * dLng);
      return { ...c, distanceKm: Math.round(km * 10) / 10, slaMs: getSlaRemainingMs(c) };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

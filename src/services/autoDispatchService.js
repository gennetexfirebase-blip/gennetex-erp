/**
 * Auto-dispatch — ойр + free + skill match engineer-д call санал болгох.
 */
import { supabase } from '../lib/supabase';
import { distanceMeters } from '../lib/geo';
import { isFlagOn } from '../lib/featureFlags';
import * as serviceCallApi from './serviceCallService';
import * as notifyApi from './notificationService';

function safeDist(aLat, aLng, bLat, bLng) {
  if (aLat == null || bLat == null) return 9999;
  try {
    return distanceMeters({ latitude: aLat, longitude: aLng }, { latitude: bLat, longitude: bLng }) / 1000;
  } catch {
    return 9999;
  }
}

/**
 * @param {object} call — service call
 * @param {Array} workers — { id, name, latitude, longitude, last_seen, open_calls? }
 * @param {object} opts
 */
export function rankEngineersForCall(call, workers = [], opts = {}) {
  const maxOpen = opts.maxOpenCalls ?? 5;
  const now = Date.now();
  const onlineMs = opts.onlineMs ?? 10 * 60 * 1000;

  return (workers || [])
    .map((w) => {
      const open = Number(w.open_calls) || 0;
      const last = w.last_seen ? new Date(w.last_seen).getTime() : 0;
      const online = last && now - last < onlineMs;
      const dist =
        call?.latitude != null && w.latitude != null
          ? safeDist(call.latitude, call.longitude, w.latitude, w.longitude)
          : 50;
      // skill: call type match in w.skills array (optional)
      const skills = w.skills || [];
      const skillMatch = !skills.length || skills.includes(call?.type) || skills.includes('all') ? 1 : 0.5;
      // lower score = better
      const score =
        dist * 1.2 +
        open * 8 +
        (online ? 0 : 40) +
        (skillMatch < 1 ? 25 : 0);
      return {
        ...w,
        distKm: Math.round(dist * 10) / 10,
        open_calls: open,
        online,
        skillMatch,
        score: Math.round(score * 10) / 10,
      };
    })
    .filter((w) => (w.open_calls || 0) < maxOpen)
    .sort((a, b) => a.score - b.score);
}

export async function fetchOpenCallCounts() {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from('service_calls')
    .select('engineer_id, status')
    .not('status', 'in', '("Дууссан","Татгалзсан")');
  if (error) return {};
  const map = {};
  (data || []).forEach((r) => {
    if (!r.engineer_id) return;
    map[r.engineer_id] = (map[r.engineer_id] || 0) + 1;
  });
  return map;
}

/**
 * Санал болгох — оноохгүй (preview)
 */
export async function suggestDispatch(call, workers) {
  if (!isFlagOn('autoDispatch')) return [];
  const counts = await fetchOpenCallCounts();
  const enriched = (workers || []).map((w) => ({
    ...w,
    open_calls: counts[w.id] || w.open_calls || 0,
  }));
  return rankEngineersForCall(call, enriched);
}

/**
 * Хамгийн тохиромжтой инженерт оноох
 */
export async function autoAssignCall(callId, call, workers, { dryRun = false } = {}) {
  const ranked = await suggestDispatch(call, workers);
  const best = ranked[0];
  if (!best) return { assigned: false, reason: 'no_engineer' };
  if (dryRun) return { assigned: false, dryRun: true, suggestion: best, ranked };

  const updated = await serviceCallApi.updateServiceCall(callId, {
    engineer_id: best.id,
    engineer_name: best.name,
    status: call.status === 'Хүлээгдэж буй' ? 'Хүлээгдэж буй' : call.status,
  });

  try {
    await notifyApi.notifyUsers([best.id], {
      title: 'Автомат оноолт — шинэ дуудлага',
      body: `${call.customer || ''}${call.address ? ` · ${call.address}` : ''}`,
      data: { type: 'service_call', callId },
      channelId: 'chat',
    });
  } catch {}

  return { assigned: true, engineer: best, call: updated, ranked };
}

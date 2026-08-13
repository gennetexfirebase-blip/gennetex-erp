import { supabase } from '../lib/supabase';
import { callEdge } from '../lib/edgeFunction';
import { uniqueChannel } from '../lib/realtimeChannel';
import { getDeviceId } from './deviceTokenService';

/**
 * Дуудлагын үйлчилгээ — аюулгүй хувилбар.
 *
 * ХУУЧИН `callService.js`-ЭЭС ЯЛГАА:
 *   Тэр нь `caller_id`-г КЛИЕНТЭЭС илгээдэг байсан тул хэн ч өөр хүний
 *   нэрээр дуудлага үүсгэж чаддаг байв. Энэ нь `call_start` RPC ашиглана —
 *   тэнд `caller_id = auth.uid()` гэж СЕРВЕР өөрөө тодорхойлно.
 *
 *   Мөн бүх төлөвийн шилжилт `call_transition` дээр шалгагдана: хэн
 *   хариулж болох, хэн цуцалж болох, дууссан дуудлагыг дахин өөрчлөхгүй.
 */

/** Дуудлагын төлөвийн машин — санамсаргүй boolean-ууд ашиглахгүй. */
export const CALL_STATE = {
  IDLE: 'IDLE',
  INITIATING: 'INITIATING',
  RINGING: 'RINGING',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  DECLINED: 'DECLINED',
  BUSY: 'BUSY',
  MISSED: 'MISSED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
  ENDED: 'ENDED',
};

/** Дуудлага дууссан төлөвүүд — эдгээрээс цааш шилжихгүй. */
const TERMINAL = new Set([
  'declined', 'busy', 'missed', 'cancelled', 'failed', 'ended', 'unreachable',
]);

export function isTerminal(status) {
  return TERMINAL.has(status);
}

/** Серверийн статусыг UI-ийн төлөв рүү хөрвүүлнэ. */
export function toUiState(status) {
  switch (status) {
    case 'initiated':   return CALL_STATE.INITIATING;
    case 'ringing':     return CALL_STATE.RINGING;
    case 'accepted':    return CALL_STATE.CONNECTING;
    case 'declined':    return CALL_STATE.DECLINED;
    case 'busy':        return CALL_STATE.BUSY;
    case 'missed':      return CALL_STATE.MISSED;
    case 'cancelled':   return CALL_STATE.CANCELLED;
    case 'unreachable':
    case 'failed':      return CALL_STATE.FAILED;
    case 'ended':       return CALL_STATE.ENDED;
    default:            return CALL_STATE.IDLE;
  }
}

/** Хэрэглэгчид харуулах монгол текст. */
export const CALL_TEXT = {
  [CALL_STATE.INITIATING]: 'Залгаж байна...',
  [CALL_STATE.RINGING]: 'Дуудаж байна...',
  [CALL_STATE.CONNECTING]: 'Холбогдож байна...',
  [CALL_STATE.CONNECTED]: 'Холбогдлоо',
  [CALL_STATE.DECLINED]: 'Дуудлагаас татгалзлаа',
  [CALL_STATE.BUSY]: 'Хэрэглэгч завгүй байна',
  [CALL_STATE.MISSED]: 'Дуудлагад хариулсангүй',
  [CALL_STATE.CANCELLED]: 'Дуудлага цуцлагдлаа',
  [CALL_STATE.FAILED]: 'Хэрэглэгчтэй холбогдох боломжгүй байна',
  [CALL_STATE.ENDED]: 'Дуудлага дууслаа',
};

function mapError(message = '') {
  const m = String(message || '');
  if (/callee_busy/.test(m)) return 'Хэрэглэгч завгүй байна.';
  if (/cannot_call_self/.test(m)) return 'Өөр рүүгээ залгах боломжгүй.';
  if (/callee_not_found/.test(m)) return 'Хэрэглэгч олдсонгүй.';
  if (/not_authenticated/.test(m)) return 'Дахин нэвтэрнэ үү.';
  if (/only_callee_can_accept/.test(m)) return 'Зөвхөн хүлээн авагч хариулна.';
  if (/only_caller_can_cancel/.test(m)) return 'Зөвхөн дуудагч цуцална.';
  if (/invalid_type/.test(m)) return 'Дуудлагын төрөл буруу.';
  return m || 'Дуудлагад алдаа гарлаа.';
}

// ---------------------------------------------------------------------------
// Дуудлага эхлүүлэх
// ---------------------------------------------------------------------------

/**
 * Дуудлага эхлүүлнэ.
 *
 * Хоёр алхам:
 *   1. `call_start` — сервер дээр мөр үүснэ (caller_id найдвартай)
 *   2. `call-notify` — хүлээн авагчийн БҮХ идэвхтэй төхөөрөмж рүү push
 *
 * @param {string} calleeId
 * @param {'audio'|'video'} type
 */
export async function startCall(calleeId, type = 'audio') {
  const { data, error } = await supabase.rpc('call_start', {
    p_callee_id: calleeId,
    p_type: type,
  });
  if (error) throw new Error(mapError(error.message));

  const call = Array.isArray(data) ? data[0] : data;
  if (!call?.id) throw new Error('Дуудлага үүсгэж чадсангүй.');

  // Push илгээх — амжилтгүй болсон ч дуудлага үүссэн тул алдааг зөөлөн авна.
  // Хүлээн авагч апп нээлттэй байвал realtime-аар мэдэх боломжтой.
  try {
    const { data: notify } = await callEdge('call-notify', { callId: call.id });
    return { call, notify };
  } catch (e) {
    return { call, notify: { ok: false, error: e.message } };
  }
}

// ---------------------------------------------------------------------------
// Төлөв солих
// ---------------------------------------------------------------------------

async function transition(callId, status, reason) {
  const deviceId = await getDeviceId().catch(() => null);
  const { data, error } = await supabase.rpc('call_transition', {
    p_call_id: callId,
    p_status: status,
    p_device_id: deviceId,
    p_reason: reason || null,
  });
  if (error) throw new Error(mapError(error.message));
  return Array.isArray(data) ? data[0] : data;
}

export const markRinging   = (id) => transition(id, 'ringing');
export const acceptCall    = (id) => transition(id, 'accepted');
export const declineCall   = (id) => transition(id, 'declined');
export const cancelCall    = (id) => transition(id, 'cancelled');
export const endCall       = (id) => transition(id, 'ended');
export const failCall      = (id, reason) => transition(id, 'failed', reason);

// ---------------------------------------------------------------------------
// Сонсох
// ---------------------------------------------------------------------------

/**
 * Над руу ирж буй дуудлагыг сонсоно.
 *
 * Push нь төхөөрөмжийг сэрээх үүрэгтэй. Апп нээлттэй байхад realtime нь
 * илүү хурдан бөгөөд найдвартай тул хоёуланг нь ашиглана.
 */
export function subscribeIncoming(userId, onCall) {
  if (!userId) return () => {};
  const channel = uniqueChannel(`incoming-calls-${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'calls', filter: `callee_id=eq.${userId}` },
      (payload) => onCall(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/**
 * Нэг дуудлагын төлөв өөрчлөгдөхийг сонсоно.
 *
 * Хоёр талд хэрэгтэй:
 *   • дуудагч — хариулсан/татгалзсаныг мэдэх
 *   • хүлээн авагч — дуудагч цуцалсныг мэдэж дуугаралт зогсоох
 *
 * Мөн ОЛОН ТӨХӨӨРӨМЖ: нэг дээр хариулбал бусад нь эндээс мэдэж
 * дуугаралтаа зогсооно.
 */
export function subscribeCall(callId, onUpdate) {
  if (!callId) return () => {};
  const channel = uniqueChannel(`call-updates-${callId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callId}` },
      (payload) => onUpdate(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/**
 * Нөгөө талын нэр, зураг.
 *
 * `calls` хүснэгтэд нэр давхардуулан хадгалдаггүй — профайл дээр нэр
 * солигдвол дуудлагын түүх хуучин нэрээ барьж үлдэх ёсгүй.
 */
export async function fetchPeer(userId) {
  const fallback = { id: userId, name: 'Ажилтан', avatar: null };
  if (!userId) return fallback;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_url')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return fallback;
  return { id: data.id, name: data.name || 'Ажилтан', avatar: data.avatar_url || null };
}

/** Дуудлагын одоогийн төлөвийг татна — апп background-аас сэргэхэд. */
export async function fetchCall(callId) {
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .eq('id', callId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Түүх
// ---------------------------------------------------------------------------

export async function fetchHistory(limit = 100) {
  const { data, error } = await supabase.rpc('call_history', { p_limit: limit });
  if (error) throw error;
  return data || [];
}

/** Түүхийн мөрийг харуулах текст. */
export function historyLabel(row) {
  if (row.status === 'missed') return 'Аваагүй дуудлага';
  if (row.status === 'declined') return 'Татгалзсан';
  if (row.status === 'cancelled') return 'Цуцлагдсан';
  if (row.status === 'busy') return 'Завгүй байсан';
  if (row.status === 'unreachable') return 'Холбогдоогүй';
  if (row.duration_seconds != null) {
    const m = Math.floor(row.duration_seconds / 60);
    const s = row.duration_seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return 'Дууссан';
}

/** Аваагүй дуудлагын тоо — жагсаалтад тэмдэг харуулахад. */
export async function countMissed(userId) {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .eq('callee_id', userId)
    .eq('status', 'missed');
  if (error) return 0;
  return count || 0;
}

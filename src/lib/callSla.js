/** SLA — дуудлага үүссэнээс 24 цаг */
import { getCallStatusKey, getCallStatusMeta } from './callStatusColors';
import { isCallRescheduled } from './callPermissions';

export const SLA_HOURS = 24;

export function getSlaDeadline(call) {
  if (call?.sla_deadline) return new Date(call.sla_deadline);
  const base = call?.scheduled_at || call?.created_at || Date.now();
  const created = new Date(base);
  return new Date(created.getTime() + SLA_HOURS * 60 * 60 * 1000);
}

export function getSlaRemainingMs(call) {
  if (!call || call.status === 'Дууссан') return null;
  if (call.status === 'Татгалзсан') return null;
  if (call.status === 'Дахимдах' || isCallRescheduled(call)) return null;
  if (call.status === 'Шилжүүлсэн' && call.close_meta?.transfer?.type === 'Cancel') return null;
  return getSlaDeadline(call).getTime() - Date.now();
}

export function isSlaExceeded(call) {
  const rem = getSlaRemainingMs(call);
  return rem != null && rem <= 0;
}

export function isSlaWarning(call, warnHours = 4) {
  const rem = getSlaRemainingMs(call);
  if (rem == null || rem <= 0) return false;
  return rem <= warnHours * 60 * 60 * 1000;
}

export function formatCountdown(ms) {
  if (ms == null) return '—';
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const s = Math.floor((abs % 60000) / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const str = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return ms < 0 ? `-${str.slice(1)}` : str;
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day} ${h}:${mi}`;
}

export function formatSlaDeadline(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}:${mo}:${day} ${h}:${mi}:${s}`;
}

export function callDisplayId(call) {
  const raw = String(call?.id || '').replace(/-/g, '');
  return `SO${raw.slice(0, 8).toUpperCase()}`;
}

/** Дахimдах — scheduled өдөр эхлэхээс (00:00) өмнө өнөөдрийн жагсаалтад үлдэнэ */
export function isPendingReschedule(call) {
  if (!call?.scheduled_at) return false;
  if (call.close_meta?.transfer?.reassigned_at) return false;
  if (call.status !== 'Дахимдах' && !isCallRescheduled(call)) return false;
  const today = dateKey(new Date());
  const scheduledDay = dateKey(call.scheduled_at);
  return today < scheduledDay;
}

export function callEffectiveDate(call) {
  if (isPendingReschedule(call)) {
    return call.close_meta?.transfer?.at || call.updated_at || call.created_at;
  }
  return call?.scheduled_at || call?.created_at;
}

export function callTimeLabel(call) {
  if (isPendingReschedule(call) && call.scheduled_at) {
    const d = new Date(call.scheduled_at);
    const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `→${t}`;
  }
  const d = new Date(callEffectiveDate(call) || Date.now());
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function rescheduleTargetLabel(call) {
  if (!call?.scheduled_at) return '';
  return formatDateTime(call.scheduled_at);
}

export function slaAccentColor(call) {
  const key = getCallStatusKey(call);
  if (key === 'done' || key === 'cancel' || key === 'dahimdah' || key === 'progress') {
    return getCallStatusMeta(call).color;
  }
  if (isSlaExceeded(call)) return '#e53935';
  if (isSlaWarning(call)) return '#fbc02d';
  return '#9ccc65';
}

export function slaBadgeColor(call) {
  const key = getCallStatusKey(call);
  if (key === 'done' || key === 'cancel' || key === 'dahimdah' || key === 'progress') {
    return getCallStatusMeta(call).color;
  }
  if (isSlaExceeded(call)) return '#e53935';
  if (isSlaWarning(call)) return '#fbc02d';
  return '#9ccc65';
}

export function callListDate(call) {
  return callEffectiveDate(call);
}

export function dateKey(d) {
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isSameDay(a, b) {
  return dateKey(a) === dateKey(b);
}

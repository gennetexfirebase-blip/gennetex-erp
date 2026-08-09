import { supabase } from '../lib/supabase';
import * as notifyApi from './notificationService';
import * as activityApi from './activityLogService';
import { dayKey } from '../lib/workHours';

const TABLE = 'leave_requests';

export const LEAVE_KINDS = [
  { key: 'coloo', label: 'Чөлөө' },
  { key: 'amralt', label: 'Амралт' },
  { key: 'other', label: 'Бусад' },
];

export const LEAVE_STATUSES = {
  pending: 'Хүлээгдэж буй',
  approved: 'Зөвшөөрсөн',
  rejected: 'Татгалзсан',
};

export function kindLabel(kind) {
  return LEAVE_KINDS.find((k) => k.key === kind)?.label || kind || 'Чөлөө';
}

export function statusLabel(status) {
  return LEAVE_STATUSES[status] || status || '—';
}

function normalizeDate(v) {
  const s = String(v || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

export function formatLeaveRange(row) {
  if (!row?.date_from) return '—';
  if (row.date_to && row.date_to !== row.date_from) {
    return `${row.date_from} – ${row.date_to}`;
  }
  return row.date_from;
}

export function countLeaveDays(row) {
  if (!row?.date_from) return 0;
  const start = new Date(`${row.date_from}T12:00:00`);
  const end = new Date(`${(row.date_to || row.date_from)}T12:00:00`);
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

export async function submitLeaveRequest({ userId, userName, dateFrom, dateTo, reason, kind = 'coloo' }) {
  const from = normalizeDate(dateFrom);
  const to = normalizeDate(dateTo || dateFrom);
  if (!from || !to) throw new Error('Огноо YYYY-MM-DD хэлбэрээр оруулна уу.');
  if (to < from) throw new Error('Дуусах огноо эхлэхээс өмнө байж болохгүй.');

  const row = {
    user_id: userId || null,
    user_name: userName || 'Ажилтан',
    date_from: from,
    date_to: to,
    reason: String(reason || '').trim() || null,
    kind: kind || 'coloo',
    status: 'pending',
  };

  const { data, error } = await supabase.from(TABLE).insert(row).select().single();
  if (error) {
    if (/leave_requests/i.test(error.message)) {
      throw new Error('leave_requests хүснэгт байхгүй. migration_leave_requests.sql ажиллуулна уу.');
    }
    throw error;
  }

  try {
    await notifyApi.notifyLeaveRequestToAdmins({
      userName: row.user_name,
      dateRange: formatLeaveRange(row),
      reason: row.reason,
      requestId: data.id,
    });
  } catch (e) {}

  activityApi.logActivity({
    userId,
    userName,
    action: 'leave_request',
    screen: 'MyShift',
    detail: `Чөлөө хүсэлт: ${formatLeaveRange(row)}`,
  });

  return data;
}

export async function fetchMyLeaveRequests(userId, limit = 30) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchPendingLeaveRequests(limit = 50) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchLeaveRequestsInRange(fromDate, toDate, limit = 500) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .lte('date_from', toDate)
    .gte('date_to', fromDate)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function updateLeaveRequestStatus(id, status, { reviewedBy, reviewedByName, reviewNote } = {}) {
  const patch = {
    status,
    reviewed_by: reviewedBy || null,
    reviewed_by_name: reviewedByName || null,
    review_note: reviewNote ? String(reviewNote).trim() : null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).select().single();
  if (error) throw error;

  if (data?.user_id) {
    try {
      await notifyApi.notifyUsers([data.user_id], {
        title: status === 'approved' ? 'Чөлөө зөвшөөрөгдлөө' : 'Чөлөө татгалзлаа',
        body:
          status === 'approved'
            ? `${formatLeaveRange(data)} — ${kindLabel(data.kind)}`
            : `${formatLeaveRange(data)}${reviewNote ? `: ${reviewNote}` : ''}`,
        data: { type: 'leave_request_decision', requestId: data.id, status },
        channelId: 'chat',
        priority: 'high',
      });
    } catch (e) {}
  }

  return data;
}

/** Зөвшөөрсөн чөлөөний өдрүүд — userId -> Set(dateKey) */
export function buildApprovedLeaveDaysMap(requests, fromIso, toIso) {
  const map = {};
  const today = dayKey(new Date());
  const days = [];
  const start = new Date(fromIso);
  start.setHours(0, 0, 0, 0);
  const end = new Date(toIso);
  end.setHours(0, 0, 0, 0);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dk = dayKey(d);
    if (dk > today) break;
    days.push(dk);
  }

  (requests || []).forEach((req) => {
    if (req.status !== 'approved' || !req.user_id) return;
    const to = req.date_to || req.date_from;
    days.forEach((dk) => {
      if (dk >= req.date_from && dk <= to) {
        if (!map[req.user_id]) map[req.user_id] = new Set();
        map[req.user_id].add(dk);
      }
    });
  });
  return map;
}

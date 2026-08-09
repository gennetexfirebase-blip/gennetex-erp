import { supabase } from '../lib/supabase';

/**
 * Ажилтны үйлдлийг автоматаар бүртгэнэ (алдааг чимээгүй алгасна).
 * action: screen | tap | location | face_enroll | attendance | inventory | visit | site_work | service_call | other
 */
export async function logActivity({
  userId,
  userName,
  action,
  screen = null,
  detail = null,
  latitude = null,
  longitude = null,
}) {
  if (!userId || !action) return;
  try {
    await supabase.from('activity_logs').insert({
      user_id: userId,
      user_name: userName || null,
      action: String(action).slice(0, 80),
      screen: screen ? String(screen).slice(0, 120) : null,
      detail: detail ? String(detail).slice(0, 500) : null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    });
  } catch (e) {}
}

export async function fetchActivityLogs({ limit = 1000, from = null, to = null } = {}) {
  let q = supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (from) q = q.gte('created_at', from);
  if (to) q = q.lte('created_at', to);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export function actionLabel(action) {
  const map = {
    screen: 'Дэлгэц нээсэн',
    tap: 'Даралт',
    location: 'Байршил',
    face_enroll: 'Царай бүртгэл',
    attendance: 'Ирц',
    inventory: 'Бараа/багаж',
    visit: 'Айлд очсон',
    site_work: 'Ажлын байр',
    service_call: 'Дуудлага',
    login: 'Нэвтрэлт',
    leave_request: 'Чөлөө хүсэлт',
    feedback: 'Санал гомдол',
    other: 'Бусад',
  };
  return map[action] || action || '—';
}

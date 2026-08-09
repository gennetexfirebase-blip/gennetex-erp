import { supabase } from '../lib/supabase';

export const DEFAULT_NOTIFICATION_SETTINGS = {
  push_enabled: true,
  messages_enabled: true,
  orders_enabled: true,
  payments_enabled: true,
  tasks_enabled: true,
  system_enabled: true,
};

export async function fetchNotifications(userId, limit = 100) {
  if (!userId || !supabase) return [];
  const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchUnreadCount(userId) {
  if (!userId || !supabase) return 0;
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false);
  if (error) return 0;
  return count || 0;
}

export async function markNotificationRead(id, userId) {
  if (!id || !userId) return;
  const { error } = await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId) {
  if (!userId) return;
  const { error } = await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', userId).eq('is_read', false);
  if (error) throw error;
}

export async function fetchNotificationSettings(userId) {
  if (!userId || !supabase) return DEFAULT_NOTIFICATION_SETTINGS;
  const { data, error } = await supabase.from('notification_settings').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return { ...DEFAULT_NOTIFICATION_SETTINGS, ...(data || {}) };
}

export async function saveNotificationSettings(userId, patch) {
  if (!userId || !supabase) return;
  const { data, error } = await supabase.from('notification_settings').upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).select().single();
  if (error) throw error;
  return data;
}

export function subscribeNotifications(userId, onChange) {
  if (!userId || !supabase) return () => {};
  const channel = supabase.channel(`notifications-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, onChange).subscribe();
  return () => supabase.removeChannel(channel);
}

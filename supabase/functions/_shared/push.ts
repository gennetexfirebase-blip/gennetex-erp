import { cert, getApps, initializeApp } from 'npm:firebase-admin@14.2.0/app';
import { getMessaging } from 'npm:firebase-admin@14.2.0/messaging';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

export type NotificationType =
  | 'new_order' | 'order_status' | 'message' | 'chat' | 'task' | 'task_deadline'
  | 'payment_success' | 'payment_failed' | 'admin' | 'system' | 'urgent' | string;

export interface PushNotification {
  title: string;
  body: string;
  type: NotificationType;
  screen?: string;
  entityId?: string;
  data?: Record<string, string>;
  channelId?: string;
  sound?: string;
}

export type PushAudience =
  | { kind: 'user'; userId: string }
  | { kind: 'users'; userIds: string[] }
  | { kind: 'all' }
  | { kind: 'role'; role: string };

interface PushResult { recipients: number; tokens: number; sent: number; failed: number; invalidTokensRemoved: number; }

function adminKey() {
  const modern = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (modern) {
    try { return JSON.parse(modern).default as string; } catch { /* legacy fallback */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}

export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = adminKey();
  if (!url || !key) throw new Error('Supabase server secrets are missing');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function firebaseMessaging() {
  if (!getApps().length) {
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID');
    const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
    const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) throw new Error('Firebase service account secrets are missing');
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getMessaging();
}

function settingColumn(type: string) {
  if (/message|chat/i.test(type)) return 'messages_enabled';
  if (/order/i.test(type)) return 'orders_enabled';
  if (/payment/i.test(type)) return 'payments_enabled';
  if (/task|deadline/i.test(type)) return 'tasks_enabled';
  return 'system_enabled';
}

function stringData(notification: PushNotification) {
  const merged: Record<string, unknown> = {
    ...(notification.data || {}),
    type: notification.type,
    ...(notification.screen ? { screen: notification.screen } : {}),
    ...(notification.entityId ? { entityId: notification.entityId } : {}),
  };
  return Object.fromEntries(Object.entries(merged).filter(([, value]) => value != null).map(([key, value]) => [key, String(value)]));
}

async function resolveUsers(db: SupabaseClient, audience: PushAudience): Promise<string[]> {
  if (audience.kind === 'user') return audience.userId ? [audience.userId] : [];
  if (audience.kind === 'users') return [...new Set((audience.userIds || []).filter(Boolean))];
  let query = db.from('profiles').select('id');
  if (audience.kind === 'role') {
    query = audience.role === 'admin' ? query.in('role', ['admin', 'superadmin']) : query.eq('role', audience.role);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row: { id: string }) => row.id);
}

async function filterPreferences(db: SupabaseClient, userIds: string[], type: string) {
  if (!userIds.length) return [];
  const column = settingColumn(type);
  const { data, error } = await db.from('notification_settings').select(`user_id,push_enabled,${column}`).in('user_id', userIds);
  if (error) throw error;
  const settings = new Map((data || []).map((row: Record<string, unknown>) => [String(row.user_id), row]));
  return userIds.filter((id) => {
    const row = settings.get(id) as Record<string, unknown> | undefined;
    return !row || (row.push_enabled !== false && row[column] !== false);
  });
}

export async function sendPushAudience(db: SupabaseClient, audience: PushAudience, notification: PushNotification): Promise<PushResult> {
  const allUsers = await resolveUsers(db, audience);
  if (!allUsers.length) return { recipients: 0, tokens: 0, sent: 0, failed: 0, invalidTokensRemoved: 0 };

  // Notification Center history is independent from the user's remote-push
  // preference. Turning push off must not hide business notifications.
  const historyRows = allUsers.map((userId) => ({
    user_id: userId,
    title: notification.title,
    body: notification.body,
    type: notification.type,
    data: stringData(notification),
  }));
  const { error: historyError } = await db.from('notifications').insert(historyRows);
  if (historyError) throw historyError;

  const recipientIds = await filterPreferences(db, allUsers, notification.type);
  if (!recipientIds.length) return { recipients: allUsers.length, tokens: 0, sent: 0, failed: 0, invalidTokensRemoved: 0 };

  const { data: tokenRows, error: tokenError } = await db.from('push_tokens').select('token').in('user_id', recipientIds).eq('active', true);
  if (tokenError) throw tokenError;
  const tokens = [...new Set((tokenRows || []).map((row: { token: string }) => row.token).filter(Boolean))];
  if (!tokens.length) return { recipients: allUsers.length, tokens: 0, sent: 0, failed: 0, invalidTokensRemoved: 0 };

  const messaging = firebaseMessaging();
  const invalid = new Set<string>();
  let sent = 0;
  let failed = 0;
  const data = stringData(notification);
  for (let offset = 0; offset < tokens.length; offset += 500) {
    const chunk = tokens.slice(offset, offset + 500);
    const result = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: { title: notification.title, body: notification.body },
      data,
      android: {
        priority: notification.channelId === 'urgent' ? 'high' : 'high',
        notification: { channelId: notification.channelId || 'default', sound: notification.sound || 'default', icon: 'notification_icon' },
      },
      apns: { payload: { aps: { sound: notification.sound || 'default', badge: 1, contentAvailable: true } } },
    });
    sent += result.successCount;
    failed += result.failureCount;
    result.responses.forEach((response, index) => {
      const code = response.error?.code || '';
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') invalid.add(chunk[index]);
    });
  }
  if (invalid.size) await db.from('push_tokens').delete().in('token', [...invalid]);
  return { recipients: allUsers.length, tokens: tokens.length, sent, failed, invalidTokensRemoved: invalid.size };
}

export const sendPushToUser = (db: SupabaseClient, userId: string, notification: PushNotification) => sendPushAudience(db, { kind: 'user', userId }, notification);
export const sendPushToUsers = (db: SupabaseClient, userIds: string[], notification: PushNotification) => sendPushAudience(db, { kind: 'users', userIds }, notification);
export const sendPushToAll = (db: SupabaseClient, notification: PushNotification) => sendPushAudience(db, { kind: 'all' }, notification);
export const sendPushToRole = (db: SupabaseClient, role: string, notification: PushNotification) => sendPushAudience(db, { kind: 'role', role }, notification);

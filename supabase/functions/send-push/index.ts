import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import { createAdminClient, sendPushAudience, type PushAudience, type PushNotification } from '../_shared/push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const authorization = req.headers.get('Authorization') || '';
    const token = authorization.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Authentication required' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default || '',
      { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } },
    );
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: 'Invalid session' }, 401);

    const body = await req.json() as { audience?: PushAudience; notification?: PushNotification };
    const audience = body.audience;
    const notification = body.notification;
    if (!audience || !notification?.title?.trim() || !notification?.body?.trim() || !notification?.type) {
      return json({ error: 'audience, title, body and type are required' }, 400);
    }

    const db = createAdminClient();
    const { data: caller } = await db.from('profiles').select('role').eq('id', authData.user.id).maybeSingle();
    const isAdmin = caller?.role === 'admin' || caller?.role === 'superadmin';
    if ((audience.kind === 'all' || audience.kind === 'role') && !isAdmin) return json({ error: 'Admin access required' }, 403);
    if (audience.kind === 'users' && (!Array.isArray(audience.userIds) || audience.userIds.length > 100)) return json({ error: 'Maximum 100 users per client request' }, 400);

    const result = await sendPushAudience(db, audience, {
      ...notification,
      title: notification.title.trim().slice(0, 160),
      body: notification.body.trim().slice(0, 1000),
      type: String(notification.type).slice(0, 80),
    });
    return json({ ok: true, ...result });
  } catch (error) {
    console.error('[send-push]', error);
    return json({ error: error instanceof Error ? error.message : 'Push send failed' }, 500);
  }
});

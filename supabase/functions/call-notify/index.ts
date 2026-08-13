import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

/**
 * Дуудлагын push илгээгч.
 *
 * ЯАГААД EDGE FUNCTION ДЭЭР:
 *   Push илгээхийн тулд ХҮЛЭЭН АВАГЧИЙН token хэрэгтэй. Хэрэв клиент өөрөө
 *   уншиж чаддаг байвал хэн ч бусдын token цуглуулж, дурын push илгээх
 *   боломжтой болно. Тиймээс `device_tokens`-ийн RLS нь зөвхөн ӨӨРИЙН
 *   мөрийг уншихыг зөвшөөрдөг бөгөөд бусдынхыг энд, service role-оор л
 *   уншина.
 *
 * ХАМГААЛАЛТ:
 *   • Дуудагчийг JWT-ээс тодорхойлно — биеэс ирсэн ID-д итгэхгүй
 *   • Тухайн дуудлагын caller мөн эсэхийг шалгана
 *   • Дуудлага `initiated` төлөвт байгаа эсэхийг шалгана (давхардал хаана)
 *
 * ДУУДАХ:
 *   POST { callId }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Дуудлага хүчинтэй байх хугацаа — үүнээс хойш push утгагүй. */
const CALL_TTL_SECONDS = 45;

type DeviceRow = {
  id: string;
  platform: string;
  fcm_token: string | null;
  voip_token: string | null;
  device_id: string | null;
};

/**
 * Expo push — Expo-гоор бүтээгдсэн клиентэд.
 * FCM түлхүүр шаардахгүй тул эхний ээлжинд энэ ажиллана.
 */
async function sendExpoPush(tokens: string[], payload: Record<string, unknown>) {
  const expoTokens = tokens.filter((t) => t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken'));
  if (!expoTokens.length) return { sent: 0, skipped: tokens.length };

  const messages = expoTokens.map((to) => ({
    to,
    title: payload.title,
    body: payload.body,
    sound: 'incoming_call.wav',
    priority: 'high',
    channelId: 'calls',
    // Дуудлагын дэлгэц сэргээхэд шаардлагатай өгөгдөл
    data: payload.data,
    // Хугацаа хэтэрсэн push хүргэх нь утгагүй — хоцорсон дуудлага гарахаас сэргийлнэ
    ttl: CALL_TTL_SECONDS,
  }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const out = await res.json().catch(() => ({}));
  return { sent: expoTokens.length, response: out };
}

/**
 * FCM v1 — Android дээр CallStyle/full-screen дуудлага гаргахад
 * data-only, high-priority мессеж шаардлагатай.
 *
 * PENDING EXTERNAL CONFIG: FIREBASE_SERVICE_ACCOUNT нэмэгдсэн үед идэвхжинэ.
 */
async function sendFcmDataMessage(tokens: string[], data: Record<string, string>) {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!raw) return { sent: 0, reason: 'FIREBASE_SERVICE_ACCOUNT тохируулаагүй' };
  const fcmTokens = tokens.filter((t) => !t.startsWith('Expo'));
  if (!fcmTokens.length) return { sent: 0, reason: 'FCM token алга' };

  try {
    const sa = JSON.parse(raw);
    const token = await getGoogleAccessToken(sa);
    let sent = 0;
    for (const to of fcmTokens) {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              token: to,
              // data-only: Android дээр аппыг сэрээж, өөрсдөө UI гаргана
              data,
              android: { priority: 'HIGH', ttl: `${CALL_TTL_SECONDS}s` },
              apns: {
                headers: { 'apns-priority': '10', 'apns-expiration': '0' },
                payload: { aps: { 'content-available': 1 } },
              },
            },
          }),
        }
      );
      if (res.ok) sent += 1;
    }
    return { sent };
  } catch (e) {
    return { sent: 0, reason: String((e as Error)?.message || e) };
  }
}

/** Google service account → OAuth access token (JWT bearer flow). */
async function getGoogleAccessToken(sa: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsigned = `${b64(header)}.${b64(claim)}`;

  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const j = await res.json();
  if (!j.access_token) throw new Error('Google token авч чадсангүй');
  return j.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'not_authenticated' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'not_authenticated' }, 401);

    const body = await req.json().catch(() => ({}));
    const callId = body?.callId;
    if (!callId) return json({ error: 'missing_call_id' }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    // --- Дуудлагыг шалгах ---
    const { data: call, error: callError } = await admin
      .from('calls')
      .select('id, caller_id, callee_id, type, status, created_at')
      .eq('id', callId)
      .maybeSingle();
    if (callError) return json({ error: callError.message }, 500);
    if (!call) return json({ error: 'call_not_found' }, 404);

    // Зөвхөн дуудагч өөрөө push илгээнэ
    if (call.caller_id !== user.id) return json({ error: 'forbidden' }, 403);

    // Аль хэдийн дуудагдсан/дууссан бол давхар илгээхгүй
    if (call.status !== 'initiated') {
      return json({ ok: true, skipped: true, status: call.status });
    }

    // Хугацаа хэтэрсэн бол утгагүй
    const ageMs = Date.now() - new Date(call.created_at).getTime();
    if (ageMs > CALL_TTL_SECONDS * 1000) {
      await admin.rpc('call_expire_stale', { p_seconds: CALL_TTL_SECONDS });
      return json({ ok: false, reason: 'expired' });
    }

    // --- Дуудагчийн нэр ---
    const { data: caller } = await admin
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', call.caller_id)
      .maybeSingle();
    const callerName = caller?.name || 'Ажилтан';

    // --- Хүлээн авагчийн БҮХ идэвхтэй төхөөрөмж ---
    const { data: devices } = await admin
      .from('device_tokens')
      .select('id, platform, fcm_token, voip_token, device_id')
      .eq('user_id', call.callee_id)
      .eq('is_active', true);

    const list = (devices || []) as DeviceRow[];
    if (!list.length) {
      await admin
        .from('calls')
        .update({ status: 'unreachable', ended_at: new Date().toISOString(), failure_reason: 'no_active_device' })
        .eq('id', callId);
      return json({ ok: false, reason: 'unreachable', message: 'Хэрэглэгчтэй холбогдох боломжгүй байна' });
    }

    const isVideo = call.type === 'video';
    const payloadData = {
      type: 'incoming_call',
      callId: String(call.id),
      callerId: String(call.caller_id),
      callerName,
      callerAvatar: caller?.avatar_url || '',
      callType: call.type,
    };

    const fcmTokens = list.map((d) => d.fcm_token).filter(Boolean) as string[];
    const voipTokens = list.map((d) => d.voip_token).filter(Boolean) as string[];

    // Бүх идэвхтэй төхөөрөмж рүү зэрэг илгээнэ — аль нэг нь хариулбал
    // бусад нь `calls` realtime-аар мэдэж дуугаралтаа зогсооно.
    const expo = await sendExpoPush(fcmTokens, {
      title: `${callerName} залгаж байна`,
      body: isVideo ? 'Видео дуудлага' : 'Дуут дуудлага',
      data: payloadData,
    });
    const fcm = await sendFcmDataMessage(fcmTokens, payloadData);

    // --- Төлөвийг ringing болгоно ---
    await admin
      .from('calls')
      .update({ status: 'ringing', ringing_at: new Date().toISOString() })
      .eq('id', callId)
      .eq('status', 'initiated');

    return json({
      ok: true,
      devices: list.length,
      expo,
      fcm,
      // PENDING EXTERNAL CONFIG: Apple VoIP сертификат нэмэгдсэн үед PushKit
      voip: voipTokens.length
        ? { pending: true, tokens: voipTokens.length, reason: 'APNs VoIP сертификат тохируулаагүй' }
        : { pending: false, tokens: 0 },
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

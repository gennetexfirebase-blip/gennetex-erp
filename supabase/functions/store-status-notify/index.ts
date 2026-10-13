/**
 * App Store-ын хувилбарын төлөв өөрчлөгдөхөд Telegram руу мэдэгдэнэ
 * (шалгалтад орсон, баталгаажсан, татгалзсан, App Store-д гарсан).
 *
 * pg_cron 15 минут тутам дуудна (20261012120000_store_status_watch.sql).
 * Сүүлд мэдэгдсэн төлөвийг `store_status_watch`-д хадгалж, зөвхөн
 * ӨӨРЧЛӨЛТИЙГ илгээнэ — давхар мэдэгдэл явахгүй.
 *
 * Secrets: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY, ASC_APP_ID,
 *          TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, STORE_WATCH_SECRET
 * Deploy:  npx supabase functions deploy store-status-notify --no-verify-jwt
 */
import { createAdminClient } from '../_shared/push.ts';

const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// App Store Connect-ийн төлөв → монгол тайлбар.
const STATES: Record<string, string> = {
  PREPARE_FOR_SUBMISSION: '📝 Илгээхэд бэлтгэж байна',
  WAITING_FOR_REVIEW: '⏳ Apple-ийн шалгалт хүлээж байна',
  IN_REVIEW: '🔍 Apple шалгаж байна',
  PENDING_DEVELOPER_RELEASE: '✅ Баталгаажлаа! App Store Connect дээр «Release» дарна уу',
  PENDING_APPLE_RELEASE: '✅ Баталгаажлаа, Apple гаргахад бэлтгэж байна',
  PROCESSING_FOR_APP_STORE: '⚙️ App Store-д гаргахаар боловсруулж байна',
  READY_FOR_DISTRIBUTION: '🎉 App Store-д гарлаа!',
  READY_FOR_SALE: '🎉 App Store-д гарлаа!',
  REJECTED: '❌ Apple татгалзлаа. App Store Connect → App Review хэсгээс шалтгааныг харна уу',
  METADATA_REJECTED: '❌ Тайлбар/зураг татгалзагдлаа. App Store Connect-оос шалтгааныг харна уу',
  INVALID_BINARY: '❌ Build хүчингүй гэж буцаагдлаа',
  DEVELOPER_REJECTED: '↩️ Шалгалтаас буцааж татсан',
  DEVELOPER_REMOVED_FROM_SALE: '⛔ Борлуулалтаас хассан',
  REMOVED_FROM_SALE: '⛔ App Store-оос хасагдсан',
};

function pemToDer(pem: string) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const b64url = (data: Uint8Array | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function ascToken(keyId: string, issuer: string, pem: string) {
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(pem), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const data = `${b64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }))}.${b64url(JSON.stringify({ iss: issuer, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' }))}`;
  // WebCrypto ECDSA нь r||s (IEEE P1363) хэлбэрээр буцаадаг — JWT-д яг тохирно.
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(data)));
  return `${data}.${b64url(sig)}`;
}

async function telegram(token: string, chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  return res.ok && (await res.json()).ok;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('STORE_WATCH_SECRET') || '';
  if (!secret || req.headers.get('x-watch-secret') !== secret) return reply({ ok: false, error: 'forbidden' }, 403);

  const env = (k: string) => Deno.env.get(k) || '';
  const [keyId, issuer, pem, appId, botToken, chatId] =
    ['ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_PRIVATE_KEY', 'ASC_APP_ID', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'].map(env);
  if (!keyId || !issuer || !pem || !appId || !botToken || !chatId) return reply({ ok: false, error: 'not_configured' }, 503);

  const token = await ascToken(keyId, issuer, pem.replace(/\\n/g, '\n'));
  const res = await fetch(
    `https://api.appstoreconnect.apple.com/v1/apps/${appId}/appStoreVersions?fields[appStoreVersions]=versionString,appStoreState&limit=3`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return reply({ ok: false, error: `asc_${res.status}` }, 502);
  const versions = ((await res.json()).data || []) as { id: string; attributes: { versionString: string; appStoreState: string } }[];

  const db = createAdminClient();
  const sent: string[] = [];
  for (const v of versions) {
    const key = `appstore:${v.attributes.versionString}`;
    const state = v.attributes.appStoreState;
    const { data: prev } = await db.from('store_status_watch').select('value').eq('key', key).maybeSingle();
    if (prev?.value === state) continue;
    // Эхний удаа (prev алга) зөвхөн хадгална — одоогийн төлөвийг «шинэ» гэж мэдэгдэхгүй.
    if (prev) {
      const label = STATES[state] || state;
      const ok = await telegram(botToken, chatId, `📱 Gennetex ERP · App Store ${v.attributes.versionString}\n${label}`);
      if (!ok) continue; // дараагийн удаа дахин оролдоно
      sent.push(`${key}=${state}`);
    }
    await db.from('store_status_watch').upsert({ key, value: state, updated_at: new Date().toISOString() });
  }
  return reply({ ok: true, versions: versions.map((v) => `${v.attributes.versionString}:${v.attributes.appStoreState}`), sent });
});

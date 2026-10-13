/**
 * Ирцийн WIDGET-ийн сервер (iPhone / Android нүүр дэлгэцийн widget).
 *
 * Widget нь аппын session-гүй тул `attendance_widget_tokens`-ийн token-оор
 * танигдана (20261012100000_attendance_widget_tokens.sql). Энэ функц нь
 * ЗӨВХӨН дараах гурван үйлдэл хийнэ:
 *   - status    — өнөөдрийн ирсэн/явсан цаг, ээлж, байршлын нэр
 *   - check_in  — ажлын цэгийн бүсэд байвал «Ирлээ»
 *   - check_out — ажлын цэгийн бүсэд байвал «Явлаа»
 *
 * ⚠️ Бүсээс гадуур / GPS алга бол бүртгэхгүй — `reason` буцааж widget нь
 *    аппыг нээнэ (тэнд зайнаас бүртгүүлэх, selfie зэрэг бүрэн урсгал бий).
 *    Ингэснээр widget нь хамгаалалтыг тойрох зам болохгүй.
 *
 * Deploy: npx supabase functions deploy widget-attendance --no-verify-jwt
 */
import { createAdminClient, sendPushAudience } from '../_shared/push.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Content-Type': 'application/json',
};
const reply = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers });

const UB_OFFSET_MS = 8 * 3600_000;
// Аппын байршлын tracker-ийн сүүлийн цэгийг ашиглах дээд хугацаа.
const FRESH_LOCATION_MS = 3 * 60_000;

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)));
}

const hhmm = (value: unknown, fallback: string) => {
  const s = String(value ?? '').slice(0, 5);
  return /^\d{2}:\d{2}$/.test(s) ? s : fallback;
};

const ubTime = (iso: string) => new Date(new Date(iso).getTime() + UB_OFFSET_MS).toISOString().slice(11, 16);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply({ ok: false, error: 'method_not_allowed' }, 405);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* хоосон */ }
  const token = String(body.token || '');
  const action = String(body.action || 'status');
  if (!/^[0-9a-f]{64}$/.test(token)) return reply({ ok: false, error: 'invalid_token' }, 401);
  if (!['status', 'check_in', 'check_out'].includes(action)) return reply({ ok: false, error: 'invalid_action' }, 400);

  const db = createAdminClient();
  const { data: tok } = await db.from('attendance_widget_tokens')
    .select('id,user_id').eq('token_hash', await sha256Hex(token)).is('revoked_at', null).maybeSingle();
  if (!tok) return reply({ ok: false, error: 'invalid_token' }, 401);
  const uid = String(tok.user_id);
  await db.from('attendance_widget_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tok.id);

  const { data: profile } = await db.from('profiles').select('name,role').eq('id', uid).maybeSingle();
  const name = String(profile?.name || 'Ажилтан');

  // Улаанбаатарын өнөөдөр.
  const day = new Date(Date.now() + UB_OFFSET_MS).toISOString().slice(0, 10);
  const dayStart = new Date(`${day}T00:00:00+08:00`).toISOString();
  const dayEnd = new Date(new Date(dayStart).getTime() + 86400_000).toISOString();

  const loadState = async () => {
    const [{ data: rows }, { data: shift }, { data: settings }] = await Promise.all([
      db.from('attendance').select('id,type,status,created_at,location_name')
        .eq('staff_id', uid).gte('created_at', dayStart).lt('created_at', dayEnd)
        .neq('status', 'rejected').order('created_at', { ascending: true }),
      db.from('employee_shifts').select('start_time,end_time,attendance_locations(name)')
        .eq('user_id', uid).eq('shift_date', day).maybeSingle(),
      db.from('company_settings').select('work_start_time').eq('singleton', true).maybeSingle(),
    ]);
    const list = rows || [];
    const checkIn = list.find((r) => r.type === 'check_in');
    const checkOut = checkIn ? [...list].reverse().find((r) => r.type === 'check_out' && r.created_at >= checkIn.created_at) : null;
    const shiftLoc = (shift as { attendance_locations?: { name?: string } } | null)?.attendance_locations?.name;
    return {
      name,
      status: checkOut ? 'done' : checkIn ? 'working' : 'none',
      checkInAt: checkIn?.created_at || null,
      checkOutAt: checkOut?.created_at || null,
      pending: !!(checkIn?.status === 'pending' || checkOut?.status === 'pending'),
      shiftStart: hhmm(shift?.start_time, hhmm(settings?.work_start_time, '09:00')),
      shiftEnd: hhmm(shift?.end_time, '18:00'),
      locationName: checkIn?.location_name || shiftLoc || null,
      serverTime: new Date().toISOString(),
    };
  };

  const state = await loadState();
  if (action === 'status') return reply({ ok: true, state });

  if (action === 'check_in' && state.status !== 'none') return reply({ ok: false, reason: 'already', state });
  if (action === 'check_out' && state.status === 'none') return reply({ ok: false, reason: 'not_checked_in', state });
  if (action === 'check_out' && state.status === 'done') return reply({ ok: false, reason: 'already', state });

  // Байршил: widget-ийн GPS, эсвэл аппын tracker-ийн шинэхэн цэг.
  let lat = Number(body.latitude);
  let lng = Number(body.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const { data: cur } = await db.from('current_locations').select('latitude,longitude,timestamp')
      .eq('employee_id', uid).maybeSingle();
    if (cur && Date.now() - Number(cur.timestamp) <= FRESH_LOCATION_MS) {
      lat = Number(cur.latitude);
      lng = Number(cur.longitude);
    }
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return reply({ ok: false, reason: 'no_location', state });

  const { data: locations } = await db.from('attendance_locations').select('name,latitude,longitude,radius_m').eq('active', true);
  let best: { name: string; radius: number } | null = null;
  let min = Infinity;
  for (const l of locations || []) {
    const d = distanceMeters({ lat, lng }, { lat: Number(l.latitude), lng: Number(l.longitude) });
    if (d < min) { min = d; best = { name: String(l.name || ''), radius: Number(l.radius_m) || 200 }; }
  }
  if (!best || min > best.radius) {
    return reply({ ok: false, reason: 'outside', distance: Number.isFinite(min) ? Math.round(min) : null, state });
  }

  const { data: row, error } = await db.from('attendance').insert({
    staff_id: uid,
    staff_name: name,
    type: action,
    latitude: lat,
    longitude: lng,
    status: 'approved',
    is_remote: false,
    distance_m: Math.round(min),
    note: 'Widget-ээс',
    location_name: best.name,
  }).select('created_at').single();
  if (error) return reply({ ok: false, error: 'insert_failed', state }, 500);

  // Аппаар бүртгэсэнтэй адил админд мэдэгдэнэ. Алдаа нь ирцийг зогсоохгүй.
  try {
    await sendPushAudience(db, { kind: 'role', role: 'admin' }, {
      title: `Ажилтан ${action === 'check_out' ? 'явлаа' : 'ирлээ'}`,
      body: `${name} · ${ubTime(row.created_at)}\n${best.name}`,
      type: 'attendance_logged',
      screen: 'Attendance',
    });
  } catch { /* мэдэгдэлгүй ч ирц бүртгэгдсэн */ }

  return reply({ ok: true, state: await loadState() });
});

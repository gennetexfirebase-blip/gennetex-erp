import { supabase } from '../lib/supabase';
import { uniqueChannel } from '../lib/realtimeChannel';
import { withoutSampleByName, withoutSampleVisits } from '../lib/sampleNames';
import { filterVisibleProfiles } from '../lib/roles';

// Ажилтны одоогийн байршлыг profiles дээр шинэчлэх (админ хардаг)
export async function updateMyLocation(userId, { latitude, longitude }) {
  const { error } = await supabase
    .from('profiles')
    .update({ latitude, longitude, last_seen: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

// Байршлын лог нэмэх (түүх)
export async function logLocation({ userId, userName, latitude, longitude, speed }) {
  const { error } = await supabase.from('location_logs').insert({
    user_id: userId,
    user_name: userName,
    latitude,
    longitude,
    speed: speed ?? null,
  });
  if (error) throw error;
}

// Айлд очсон лог
export async function logVisit({
  userId,
  userName,
  callId,
  customer,
  problem,
  callType,
  latitude,
  longitude,
  photoUrl,
  faceVerified,
  locationName,
}) {
  const { error } = await supabase.from('visit_logs').insert({
    user_id: userId,
    user_name: userName,
    call_id: callId,
    customer,
    problem: problem ?? null,
    call_type: callType ?? null,
    latitude,
    longitude,
    photo_url: photoUrl ?? null,
    face_verified: faceVerified ?? false,
    location_name: locationName ?? customer ?? null,
  });
  if (error) throw error;
}

/**
 * Админ: ажилчдын одоогийн байршил (зурагтай).
 *
 * Хэлтэстэй удирдагч (ахлах) ЗӨВХӨН өөрийн хэлтсийнхнийг харна —
 * тиймээс харагчийн болон ажилтнуудын `department_id`-г уншиж,
 * `filterVisibleProfiles`-д бүтэн профайл дамжуулна.
 */
export async function fetchWorkers() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let viewer = null;
  if (user) {
    const { data: p } = await supabase
      .from('profiles')
      .select('id, role, department_id')
      .eq('id', user.id)
      .maybeSingle();
    viewer = p || null;
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role, avatar_url, latitude, longitude, last_seen, department_id')
    .order('name', { ascending: true });
  if (error) throw error;
  return filterVisibleProfiles(withoutSampleByName(data || []), viewer);
}

export async function fetchVisitLogs(limit = 50) {
  const { data, error } = await supabase
    .from('visit_logs')
    .select('*')
    .order('arrived_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return withoutSampleVisits(data || []);
}

export function subscribeWorkers(onChange) {
  const channel = uniqueChannel('workers-loc')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => onChange())
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/**
 * Нэг ажилтны ТУХАЙН ӨДРИЙН бүх байршил — замнал зурах, Excel-д гаргах.
 *
 * ⚠️ Апп хаалттай үед offline queue-д хуримтлагдаад дараа нь илгээгдсэн
 *    цэгүүд ч энд орно (`location_logs`-д бичигддэг тул) — тиймээс энэ
 *    нь тасалдалтай хугацааг ч дүүрэн харуулна.
 *
 * @param {string} userId
 * @param {string} [dateISO] `YYYY-MM-DD` (өгөхгүй бол өнөөдөр). Орон
 *   нутгийн өдрөөр шүүнэ — ажилтан "өнөөдөр хаана явсан" гэдгийг
 *   утасныхаа цагаар ойлгодог.
 * @returns {Promise<Array<{ latitude, longitude, speed, recorded_at }>>}
 */
export async function fetchDayTrack(userId, dateISO) {
  if (!userId) return [];

  const base = dateISO ? new Date(dateISO + 'T00:00:00') : new Date();
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('location_logs')
    .select('latitude, longitude, speed, recorded_at')
    .eq('user_id', userId)
    .gte('recorded_at', start.toISOString())
    .lte('recorded_at', end.toISOString())
    // Замнал он цагийн дарааллаар зурагдана — эс бөгөөс шугам эргэлдэнэ.
    .order('recorded_at', { ascending: true })
    .limit(5000);
  if (error) throw error;
  return (data || []).filter((p) => p.latitude != null && p.longitude != null);
}

import { supabase } from '../lib/supabase';
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

// Админ: бүх ажилчдын одоогийн байршил (зурагтай)
export async function fetchWorkers() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let viewerRole = null;
  if (user) {
    const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    viewerRole = p?.role || null;
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role, avatar_url, latitude, longitude, last_seen')
    .order('name', { ascending: true });
  if (error) throw error;
  return filterVisibleProfiles(withoutSampleByName(data || []), viewerRole);
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
  const channel = supabase
    .channel('workers-loc')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => onChange())
    .subscribe();
  return () => supabase.removeChannel(channel);
}

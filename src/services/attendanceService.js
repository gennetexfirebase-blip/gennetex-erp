import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import * as notifyApi from './notificationService';
import { distanceMeters } from '../lib/geo';

const TABLE = 'attendance';
const BUCKET = 'attendance';

// Селфи зургийг Supabase Storage-д байршуулж, нийтийн URL буцаана
export async function uploadSelfie(uri, staffId) {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const path = `${staffId || 'anon'}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Профайл зургийг avatars bucket-д байршуулж, нийтийн URL буцаана
export async function uploadAvatar(uri, userId) {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const path = `${userId || 'anon'}/avatar_${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

export function nearestAttendanceLocation(loc, locations = []) {
  if (!locations.length || loc.latitude == null) {
    return { within: false, name: null, distance: null, location: null };
  }
  let min = Infinity;
  let best = null;
  locations.forEach((l) => {
    const d = distanceMeters(loc, { latitude: l.latitude, longitude: l.longitude });
    if (d < min) {
      min = d;
      best = l;
    }
  });
  const within = best ? min <= (best.radius_m || 200) : false;
  return {
    within,
    name: within ? best.name : null,
    distance: isFinite(min) ? Math.round(min) : null,
    location: best,
  };
}

export async function insertAttendance(record) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      staff_id: record.staffId || null,
      staff_name: record.staffName,
      type: record.type || 'check_in',
      photo_url: record.photoUrl || null,
      latitude: record.latitude ?? null,
      longitude: record.longitude ?? null,
      status: record.status || 'approved',
      is_remote: record.isRemote || false,
      distance_m: record.distanceM ?? null,
      note: record.note || null,
      location_name: record.locationName || null,
    })
    .select()
    .single();
  if (error) throw error;
  if (data.status === 'pending'&& data.is_remote) {
    try {
      await notifyApi.notifyRemoteAttendance({
        staffName: record.staffName,
        note: record.note,
      });
    } catch (e) {}
  } else if (data.type === 'check_in'&& data.is_remote) {
    try {
      await notifyApi.notifyOffSiteCheckIn({
        staffName: record.staffName,
        locationName: record.locationName,
        distanceM: record.distance_m,
      });
    } catch (e) {}
  }
  return data;
}

// ---- Ирц бүртгэх байршил (geofence) ----
export async function fetchAttendanceLocations() {
  const { data, error } = await supabase
    .from('attendance_locations')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function insertAttendanceLocation(loc) {
  const { data, error } = await supabase
    .from('attendance_locations')
    .insert({
      name: loc.name,
      latitude: loc.latitude,
      longitude: loc.longitude,
      radius_m: loc.radius_m || 200,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAttendanceLocation(id) {
  const { error } = await supabase.from('attendance_locations').delete().eq('id', id);
  if (error) throw error;
}

// ---- Зайнаас бүртгүүлэх хүсэлт (admin зөвшөөрөл) ----
export async function fetchPendingAttendance() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function setAttendanceStatus(id, status) {
  const { error } = await supabase.from(TABLE).update({ status }).eq('id', id);
  if (error) throw error;
}

// Өнөөдрийн ирцийн (check_in) тоо
export async function countTodayCheckIns() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('type', 'check_in')
    .gte('created_at', start.toISOString());
  if (error) throw error;
  return count || 0;
}

export async function fetchAttendance(limit = 50) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

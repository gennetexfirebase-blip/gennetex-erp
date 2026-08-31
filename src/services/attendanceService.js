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
  /**
   * БҮХ ирцийг админд мэдэгдэнэ.
   *
   * ⚠️ Өмнө нь зөвхөн ЗАЙНААС бүртгүүлсэн нь очдог байсан тул ажлын
   *    байран дээрээ ирсэн/явсан ажилтан админд огт харагдахгүй байв.
   *    Одоо бүх бүртгэл очиж, зайнаас ирсэн нь "баталгаажуулна уу"
   *    гэсэн тод үйлдэлтэй ялгарна.
   *
   * ⚠️ Энэ нь СЕРВИСИЙН давхаргад байх ёстой: ирц үүсгэдэг дөрвөн
   *    урсгал (хурдан бүртгэл, царай таних, зайнаас, засвар) бүгд
   *    энэ функцээр дамждаг. Дэлгэцээс дуудвал зарим урсгал орхигдоно.
   *
   * Мэдэгдэл явуулж чадаагүй нь ирцийг ЗОГСООХГҮЙ.
   */
  try {
    const at = new Date(data.created_at || Date.now());
    const p = (n) => String(n).padStart(2, '0');
    await notifyApi.notifyAttendanceToAdmins({
      staffName: record.staffName,
      type: data.type,
      timeText: `${p(at.getHours())}:${p(at.getMinutes())}`,
      locationName: record.locationName,
      // Зайнаас бүртгүүлсэн буюу зөвшөөрөл хүлээж буй нь ялгарна.
      isRemote: !!data.is_remote || data.status === 'pending',
      // Дуудагчид `distanceM` (camelCase) өгдөг — хоёуланг дэмжинэ.
      distanceM: record.distanceM ?? record.distance_m,
    });
  } catch (e) {
    /* мэдэгдэлгүй ч ирц бүртгэгдсэн */
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

export async function updateAttendanceLocation(id, patch) {
  const { data, error } = await supabase
    .from('attendance_locations')
    .update({
      name: patch.name,
      latitude: patch.latitude,
      longitude: patch.longitude,
      radius_m: patch.radius_m,
    })
    .eq('id', id)
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

/**
 * Ирц зөвшөөрөх / татгалзах.
 *
 * ⚠️ Шууд UPDATE хийхээ больсон — RLS нь одоо зөвхөн хөгжүүлэгчид
 * зөвшөөрдөг. Шийдвэр `admin_decide_attendance` RPC-ээр гарна: тэр нь
 * эрхийн шатлалыг шалгаад (админ өөр админыг батлахгүй) аудит бичнэ.
 */
export async function setAttendanceStatus(id, status) {
  const { data, error } = await supabase.rpc('admin_decide_attendance', {
    p_attendance_id: id,
    p_status: status,
  });
  if (error) {
    if (String(error.message || '').includes('forbidden_target')) {
      throw new Error('Өөртэйгөө тэнцүү буюу дээш эрхтэй хүний ирцийг зөвшөөрөх боломжгүй. Хөгжүүлэгчид хандана уу.');
    }
    throw error;
  }
  return data;
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

/**
 * Нэг ажилтны тухайн өдрийн ирцийн БҮХ мөр (байршилтай нь).
 *
 * `fetch_department_attendance_today` RPC нь зөвхөн нэгтгэсэн цагийг
 * буцаадаг бөгөөд lat/lng агуулдаггүй. Тиймээс газрын зураг дээр
 * "хэзээ, хаанаас" бүртгүүлснийг харуулахад энэ функцээр тусад нь авна.
 */
export async function fetchEmployeeDayAttendance(employeeId, date) {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('staff_id', employeeId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchAttendanceInRange(fromIso, toIso, limit = 1000) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// ---- Нэгдсэн тооцоолол (server-side, нэг эх сурвалж) ----
export async function fetchAttendanceSummary(employeeId, start, end) {
  const { data, error } = await supabase.rpc('fetch_attendance_summary', {
    p_employee_id: employeeId,
    p_start: start,
    p_end: end,
  });
  if (error) throw error;
  return data || [];
}

/** RPC хараахан суулгаагүй (migration ажиллуулаагүй) эсэхийг таних. */
export function isMissingRpc(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    error?.code === 'PGRST202' ||
    msg.includes('could not find the function') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
}

/**
 * Тухайн өдрийн бүх ажилтны ирэц.
 *
 * Үндсэн зам нь `fetch_department_attendance_today` RPC (сервер тал дээр
 * хоцролт/эрт явалтыг НЭГ эх сурвалжаас тооцдог). Гэвч migration хараахан
 * ажиллаагүй байхад дэлгэц ХООСОН харагдаж, "ажилчид ороогүй байна" гэж
 * ойлгогдох тул тэр тохиолдолд `profiles` + `attendance`-аас клиент талдаа
 * жагсаалтыг угсарч, ядаж хэн ирсэн/яваагүйг харуулна.
 */
export async function fetchDepartmentAttendanceToday(departmentId = null, date = null) {
  const params = { p_department_id: departmentId };
  if (date) params.p_date = date;
  const { data, error } = await supabase.rpc('fetch_department_attendance_today', params);
  if (!error) return data || [];
  if (!isMissingRpc(error)) throw error;
  return fallbackDayRows(departmentId, date);
}

async function fallbackDayRows(departmentId, date) {
  const day = date || new Date().toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(`${day}T23:59:59.999`);

  // Эрхээр шүүхгүй — систем админ/хөгжүүлэгчийн ирц ч бусад админд харагдана.
  let profileQuery = supabase
    .from('profiles')
    .select('id, name, avatar_url, department_id, role')
    .order('name', { ascending: true });
  if (departmentId) profileQuery = profileQuery.eq('department_id', departmentId);

  const [{ data: people, error: pErr }, { data: rows, error: aErr }] = await Promise.all([
    profileQuery,
    supabase
      .from(TABLE)
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString()),
  ]);
  if (pErr) throw pErr;
  if (aErr) throw aErr;

  const valid = (rows || []).filter((r) => r.status !== 'rejected');

  // Профайл + ИРЦТЭЙ хүн бүрийн нэгдэл. Зөвхөн `profiles`-оос гаргавал
  // тэнд ороогүй хүн ирцээ бүртгүүлсэн ч жагсаалтаас алга болно.
  const merged = [...(people || [])];
  const known = new Set(merged.map((p) => String(p.id)));
  valid.forEach((r) => {
    const id = String(r.staff_id || '');
    if (id && !known.has(id)) {
      known.add(id);
      merged.push({ id, name: r.staff_name || 'Ажилтан', avatar_url: null, department_id: null });
    }
  });

  return merged.map((p) => {
    const mine = valid.filter((r) => String(r.staff_id) === String(p.id));
    const inRow = mine.find((r) => r.type === 'check_in') || null;
    const outRow = mine.find((r) => r.type === 'check_out') || null;
    const workedMinutes =
      inRow && outRow
        ? Math.round((new Date(outRow.created_at) - new Date(inRow.created_at)) / 60000)
        : null;
    return {
      employee_id: p.id,
      employee_name: p.name,
      avatar_url: p.avatar_url,
      department_id: p.department_id,
      department_name: null,
      shift_start: null,
      shift_end: null,
      check_in_at: inRow?.created_at || null,
      check_out_at: outRow?.created_at || null,
      is_remote: mine.some((r) => r.is_remote),
      // Хуваарь мэдэхгүй тул хоцролтыг ТААМАГЛАХГҮЙ — 0 гэж үзнэ.
      late_minutes: 0,
      early_leave_minutes: 0,
      worked_minutes: workedMinutes,
      status: inRow ? 'on_time' : 'not_scheduled',
    };
  });
}

// ---- Wi-Fi-ээр ирц баталгаажуулах тохиргоо ----
export async function fetchAttendanceWifi() {
  const { data, error } = await supabase
    .from('attendance_wifi')
    .select('*, attendance_locations(name)')
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((w) => ({ ...w, location_name: w.attendance_locations?.name || null }));
}

export async function insertAttendanceWifi({ name, ssid, bssid, locationId, description, createdBy }) {
  const { data, error } = await supabase
    .from('attendance_wifi')
    .insert({
      name,
      ssid,
      bssid: bssid || null,
      location_id: locationId || null,
      description: description || null,
      created_by: createdBy || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAttendanceWifi(id) {
  const { error } = await supabase.from('attendance_wifi').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchWifiEmployeeIds(wifiId) {
  const { data, error } = await supabase
    .from('attendance_wifi_employees')
    .select('employee_id')
    .eq('wifi_id', wifiId);
  if (error) throw error;
  return (data || []).map((r) => r.employee_id);
}

export async function setWifiEmployees(wifiId, employeeIds) {
  await supabase.from('attendance_wifi_employees').delete().eq('wifi_id', wifiId);
  const rows = (employeeIds || []).map((employee_id) => ({ wifi_id: wifiId, employee_id }));
  if (!rows.length) return [];
  const { data, error } = await supabase.from('attendance_wifi_employees').insert(rows).select();
  if (error) throw error;
  return data || [];
}

// ---- Геофенс байршил → ажилтан оноолт ----
export async function fetchLocationEmployeeIds(locationId) {
  const { data, error } = await supabase
    .from('attendance_location_employees')
    .select('employee_id')
    .eq('location_id', locationId);
  if (error) throw error;
  return (data || []).map((r) => r.employee_id);
}

export async function setLocationEmployees(locationId, employeeIds) {
  await supabase.from('attendance_location_employees').delete().eq('location_id', locationId);
  const rows = (employeeIds || []).map((employee_id) => ({ location_id: locationId, employee_id }));
  if (!rows.length) return [];
  const { data, error } = await supabase.from('attendance_location_employees').insert(rows).select();
  if (error) throw error;
  return data || [];
}

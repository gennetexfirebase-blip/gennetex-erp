import { supabase } from '../lib/supabase';
import { dayKey } from '../lib/workHours';

const SHIFTS = 'employee_shifts';
const BREAK_SCHEDULES = 'employee_break_schedules';

export function isShiftTableMissing(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    msg.includes('employee_shifts') ||
    msg.includes('employee_break_schedules') ||
    msg.includes('work_breaks') ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    error?.code === 'PGRST205'
  );
}

export const MIGRATION_HINT =
  'Supabase SQL Editor дээр supabase/migration_rest_days.sql ажиллуулна уу. Дараа нь Settings → API → Reload schema.';

export async function fetchShiftsForDate(date = dayKey()) {
  const { data, error } = await supabase
    .from(SHIFTS)
    .select('*, attendance_locations(name)')
    .eq('shift_date', date)
    .order('start_time', { ascending: true });
  if (error) throw error;
  return (data || []).map((s) => ({
    ...s,
    location_name: s.attendance_locations?.name || s.location_name || null,
  }));
}

export async function fetchMyShift(userId, date = dayKey()) {
  const { data, error } = await supabase
    .from(SHIFTS)
    .select('*, attendance_locations(name)')
    .eq('user_id', userId)
    .eq('shift_date', date)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, location_name: data.attendance_locations?.name || null };
}

export async function upsertShift({ userId, userName, shiftDate, startTime, endTime, locationId, note, createdBy }) {
  const { data: existing } = await supabase
    .from(SHIFTS)
    .select('id')
    .eq('user_id', userId)
    .eq('shift_date', shiftDate)
    .maybeSingle();

  const row = {
    user_id: userId,
    user_name: userName,
    shift_date: shiftDate,
    start_time: startTime,
    end_time: endTime,
    location_id: locationId || null,
    note: note || null,
    created_by: createdBy || null,
  };

  if (existing?.id) {
    const { data, error } = await supabase.from(SHIFTS).update(row).eq('id', existing.id).select().single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.from(SHIFTS).insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deleteShift(id) {
  const { error } = await supabase.from(SHIFTS).delete().eq('id', id);
  if (error) throw error;
}

export async function fetchBreakScheduleForUser(userId) {
  const { data, error } = await supabase
    .from(BREAK_SCHEDULES)
    .select('*')
    .eq('user_id', userId)
    .order('day_of_week', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchAllBreakSchedules() {
  const { data, error } = await supabase
    .from(BREAK_SCHEDULES)
    .select('*')
    .order('user_name', { ascending: true })
    .order('day_of_week', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveRestDays({ userId, userName, restDays, createdBy }) {
  await supabase.from(BREAK_SCHEDULES).delete().eq('user_id', userId);

  const rows = (restDays || [])
    .filter((d) => d.is_rest)
    .map((d) => ({
      user_id: userId,
      user_name: userName,
      day_of_week: d.day_of_week,
      created_by: createdBy || null,
    }));

  if (!rows.length) return [];

  const { data, error } = await supabase.from(BREAK_SCHEDULES).insert(rows).select();
  if (error) throw error;
  return data || [];
}

// Хуучин нэр — зөвхөн rest day хадгална
export const saveBreakSchedule = saveRestDays;

export async function fetchMyShiftsInRange(userId, fromDate, toDate) {
  const { data, error } = await supabase
    .from(SHIFTS)
    .select('*, attendance_locations(name)')
    .eq('user_id', userId)
    .gte('shift_date', fromDate)
    .lte('shift_date', toDate)
    .order('shift_date', { ascending: true });
  if (error) throw error;
  return (data || []).map((s) => ({
    ...s,
    location_name: s.attendance_locations?.name || s.location_name || null,
  }));
}

export function weekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setHours(0, 0, 0, 0);
  mon.setDate(d.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { from: dayKey(mon), to: dayKey(sun) };
}

export async function fetchAttendanceForUserRange(userId, fromDate, toDate) {
  const start = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T23:59:59.999`);
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('staff_id', userId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchAttendanceForUserDay(userId, date = dayKey()) {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('staff_id', userId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

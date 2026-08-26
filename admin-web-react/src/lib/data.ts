import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Бодит өгөгдлийн давхарга.
 *
 * ⚠️ Mock өгөгдөл ХЭРЭГЛЭХГҮЙ — бүх тоо Supabase-ээс ирнэ. Хүснэгт/RPC
 * байхгүй үед хоосон массив буцааж, дэлгэц дээр "хоосон төлөв" харагдана
 * (хуурамч тоо харуулснаас дээр).
 */

export type Employee = {
  record_id: string;
  user_id: string | null;
  name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  role: string | null;
  registered: boolean;
  avatar_url: string | null;
  department_id: string | null;
  department_name: string | null;
};

export type AttendanceRow = {
  employee_id: string;
  employee_name: string | null;
  avatar_url: string | null;
  department_id: string | null;
  department_name: string | null;
  shift_start: string | null;
  shift_end: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  is_remote: boolean;
  late_minutes: number | null;
  early_leave_minutes: number | null;
  worked_minutes: number | null;
  status: string;
};

function isMissing(error: unknown) {
  const msg = String((error as { message?: string })?.message || error || '').toLowerCase();
  return (
    msg.includes('could not find the function') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
}

/** Ерөнхий async төлөв — loading/error/data. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setError('Supabase тохируулаагүй байна.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await fn());
    } catch (e) {
      setError((e as Error)?.message || 'Өгөгдөл ачаалж чадсангүй');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, reload: run };
}

export async function fetchEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase.rpc('admin_list_authorized_users');
  if (error) throw error;
  return (data || []) as Employee[];
}

export async function fetchDepartments() {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function fetchAttendanceToday(
  date: string,
  departmentId: string | null = null
): Promise<AttendanceRow[]> {
  const { data, error } = await supabase.rpc('fetch_department_attendance_today', {
    p_department_id: departmentId,
    p_date: date,
  });
  if (!error) return (data || []) as AttendanceRow[];
  if (!isMissing(error)) throw error;
  return [];
}

export async function fetchAttendanceRequests(status: string | null = 'pending') {
  let q = supabase
    .from('attendance_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status && status !== 'all') q = q.eq('status', status);
  const { data, error } = await q;
  if (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  return data || [];
}

export async function decideAttendanceRequest(
  id: string,
  decision: 'approved' | 'rejected',
  reason: string | null = null
) {
  const { data, error } = await supabase.rpc('admin_decide_attendance_request', {
    p_request_id: id,
    p_decision: decision,
    p_rejection_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function fetchAttendanceLocations() {
  const { data, error } = await supabase
    .from('attendance_locations')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchShiftsForMonth(year: number, month: number) {
  const from = new Date(year, month, 1).toISOString().slice(0, 10);
  const to = new Date(year, month + 1, 0).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('employee_shifts')
    .select('*, attendance_locations(name)')
    .gte('shift_date', from)
    .lte('shift_date', to)
    .order('shift_date');
  if (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  return data || [];
}

export async function fetchRecentAttendance(limit = 200) {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

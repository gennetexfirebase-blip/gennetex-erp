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
  /** Зайнаас бүртгүүлсэн бөгөөд админы зөвшөөрөл хүлээж буй эсэх. */
  is_pending?: boolean;
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

/**
 * Тухайн өдрийн бүх ажилтны ирц.
 *
 * Үндсэн зам нь `fetch_department_attendance_today` RPC. Гэвч migration
 * хараахан ажиллуулаагүй байхад RPC олдохгүй бөгөөд өмнө нь хоосон
 * массив буцаадаг байсан тул дэлгэц ХООСОН харагдаж, шалтгаан нь
 * ойлгомжгүй байв. Одоо `profiles` + `attendance`-аас клиент талдаа
 * жагсаалтыг угсарч, ядаж хэн ирсэн/ирээгүйг харуулна.
 */
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
  return fallbackAttendance(date, departmentId);
}

async function fallbackAttendance(
  date: string,
  departmentId: string | null
): Promise<AttendanceRow[]> {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);

  // Эрхээр шүүхгүй — систем админ/хөгжүүлэгчийн ирц ч харагдана.
  let people = supabase
    .from('profiles')
    .select('id, name, avatar_url, department_id, role')
    .order('name');
  if (departmentId) people = people.eq('department_id', departmentId);

  const [{ data: profiles, error: pErr }, { data: rows, error: aErr }] = await Promise.all([
    people,
    supabase
      .from('attendance')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString()),
  ]);
  if (pErr) throw pErr;
  if (aErr) throw aErr;

  const valid = (rows || []).filter((r) => r.status !== 'rejected');

  // Профайлын жагсаалт + ИРЦТЭЙ хүн бүрийн нэгдэл.
  // Зөвхөн `profiles`-оос гаргавал тэнд ороогүй (эсвэл хэлтсийн шүүлтэд
  // тохирохгүй) хүн ирцээ бүртгүүлсэн ч алга болно.
  const byId = new Map<string, { id: string; name: string | null; avatar_url: string | null; department_id: string | null }>();
  (profiles || []).forEach((p) =>
    byId.set(String(p.id), {
      id: String(p.id),
      name: p.name,
      avatar_url: p.avatar_url,
      department_id: p.department_id,
    })
  );
  valid.forEach((r) => {
    const id = String(r.staff_id || '');
    if (id && !byId.has(id)) {
      byId.set(id, { id, name: r.staff_name || 'Ажилтан', avatar_url: null, department_id: null });
    }
  });

  return Array.from(byId.values()).map((p) => {
    const mine = valid.filter((r) => String(r.staff_id) === p.id);
    const inRow = mine.find((r) => r.type === 'check_in') || null;
    const outRow = mine.find((r) => r.type === 'check_out') || null;
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
      // Хуваарь мэдэхгүй тул хоцролтыг ТААМАГЛАХГҮЙ.
      late_minutes: 0,
      early_leave_minutes: 0,
      worked_minutes:
        inRow && outRow
          ? Math.round(
              (new Date(outRow.created_at).getTime() - new Date(inRow.created_at).getTime()) / 60000
            )
          : null,
      status: inRow ? 'on_time' : 'not_scheduled',
    } as AttendanceRow;
  });
}

/**
 * Нэг ажилтны тухайн өдрийн ирцийн БҮХ мөр (байршилтай нь).
 *
 * Жагсаалтын RPC нь зөвхөн нэгтгэсэн цагийг буцаадаг тул газрын зураг
 * дээр харуулах lat/lng-ийг эндээс тусад нь авна.
 */
export async function fetchEmployeeDayAttendance(employeeId: string, date: string) {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('staff_id', employeeId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at');
  if (error) throw error;
  return data || [];
}

/** Migration ажиллуулаагүйг тодорхой хэлэх алдаа. */
export class MigrationMissingError extends Error {
  constructor(what: string) {
    super(
      `"${what}" хүснэгт/функц Supabase дээр байхгүй байна. ` +
        'supabase/migrations доторх шинэ migration-уудыг ажиллуулна уу ' +
        '(supabase db push эсвэл SQL Editor).'
    );
    this.name = 'MigrationMissingError';
  }
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
    // Чимээгүй хоосон буцаахгүй — хэрэглэгч "хүсэлт алга" гэж
    // буруу ойлгохоос сэргийлж шалтгааныг нь хэлнэ.
    if (isMissing(error)) throw new MigrationMissingError('attendance_requests');
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

export type StockMovement = {
  id: string;
  created_at: string;
  item_name: string | null;
  unit: string | null;
  quantity: number;
  movement_type: string;
  /** Хүлээн авсан ажилтан */
  user_name: string | null;
  /** Олгосон админ (2026-08-27-нд нэмэгдсэн — хуучин мөрүүд хоосон) */
  issued_by_name: string | null;
};

/** Багаж/бараа олголтын хөдөлгөөн — хугацааны мужаар. */
export async function fetchStockMovements(from: string, to: string): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*')
    .gte('created_at', `${from}T00:00:00`)
    .lte('created_at', `${to}T23:59:59.999`)
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data || []) as StockMovement[];
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

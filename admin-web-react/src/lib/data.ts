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

export type EmployeeTraining = {
  id: string;
  employee_email: string;
  employee_id: string | null;
  training_name: string;
  status: 'required' | 'completed';
  due_date: string | null;
  completed_at: string | null;
  note: string | null;
  assigned_at: string;
};

export type CompanySettings = {
  singleton: boolean;
  work_start_time: string;
  late_grace_minutes: number;
  default_min_stock: number;
  reminder_days: number[];
  low_stock_alert_enabled: boolean;
  training_alert_enabled: boolean;
  vehicle_alert_enabled: boolean;
  updated_at?: string;
};

export type OperationalAlert = {
  alert_type: 'low_stock' | 'training' | 'vehicle_inspection' | 'vehicle_insurance';
  severity: 'danger' | 'warning';
  title: string;
  detail: string;
  due_date: string | null;
  entity_id: string;
  days_remaining: number | null;
};

export type NotificationCampaign = {
  id: string;
  title: string;
  body: string;
  audience_kind: 'all' | 'department' | 'users';
  audience_ids: string[];
  priority: 'default' | 'high';
  sent_by: string | null;
  sent_by_name: string | null;
  recipient_count: number;
  created_at: string;
};

export type PushDelivery = {
  ok: boolean;
  recipients: number;
  tokens: number;
  sent: number;
  failed: number;
  invalidTokensRemoved?: number;
};

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  singleton: true,
  work_start_time: '09:00:00',
  late_grace_minutes: 0,
  default_min_stock: 5,
  reminder_days: [30, 7, 1],
  low_stock_alert_enabled: true,
  training_alert_enabled: true,
  vehicle_alert_enabled: true,
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

function lateMinutesAfterStart(iso: string | null, settings = DEFAULT_COMPANY_SETTINGS) {
  if (!iso) return 0;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ulaanbaatar',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  const [startHour, startMinute] = String(settings.work_start_time || '09:00').split(':').map(Number);
  const difference = hour * 60 + minute - (startHour * 60 + startMinute);
  return difference >= Number(settings.late_grace_minutes || 0) + 1 ? difference : 0;
}

export function companyWorkStartLabel(settings: CompanySettings) {
  return String(settings.work_start_time || '09:00').slice(0, 5);
}

export function companyLateFromLabel(settings: CompanySettings) {
  const [hour, minute] = companyWorkStartLabel(settings).split(':').map(Number);
  const total = hour * 60 + minute + Number(settings.late_grace_minutes || 0) + 1;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function formatAttendanceMinutes(minutes: number | null | undefined) {
  const totalMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  if (totalMinutes < 60) return `${totalMinutes} минут`;
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  return remainingMinutes > 0
    ? `${hours} цаг ${remainingMinutes} минут`
    : `${hours} цаг`;
}

export async function fetchCompanySettings(): Promise<CompanySettings> {
  const { data, error } = await supabase.rpc('get_company_settings');
  if (error) throw error;
  return { ...DEFAULT_COMPANY_SETTINGS, ...(data || {}) } as CompanySettings;
}

export async function saveCompanySettings(settings: CompanySettings): Promise<CompanySettings> {
  const { data, error } = await supabase.rpc('update_company_settings', {
    p_work_start_time: companyWorkStartLabel(settings),
    p_late_grace_minutes: Number(settings.late_grace_minutes),
    p_default_min_stock: Number(settings.default_min_stock),
    p_reminder_days: settings.reminder_days,
    p_low_stock_alert_enabled: settings.low_stock_alert_enabled,
    p_training_alert_enabled: settings.training_alert_enabled,
    p_vehicle_alert_enabled: settings.vehicle_alert_enabled,
  });
  if (error) throw error;
  return { ...DEFAULT_COMPANY_SETTINGS, ...(data || {}) } as CompanySettings;
}

export async function fetchOperationalAlerts(): Promise<OperationalAlert[]> {
  const { data, error } = await supabase.rpc('get_operational_alerts');
  if (error) throw error;
  return (data || []) as OperationalAlert[];
}

export async function fetchNotificationCampaigns(limit = 50): Promise<NotificationCampaign[]> {
  const { data, error } = await supabase
    .from('notification_campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as NotificationCampaign[];
}

export async function sendNotificationToAll(input: {
  title: string;
  body: string;
  priority: 'default' | 'high';
  sentByName?: string | null;
}): Promise<{ campaign: NotificationCampaign; delivery: PushDelivery }> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) throw new Error('Гарчиг болон мэдэгдлийн текстийг оруулна уу.');

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw authError || new Error('Нэвтрэх эрх дууссан байна.');

  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true });

  const { data: campaign, error: insertError } = await supabase
    .from('notification_campaigns')
    .insert({
      title,
      body,
      audience_kind: 'all',
      audience_ids: [],
      priority: input.priority,
      sent_by: auth.user.id,
      sent_by_name: input.sentByName?.trim() || auth.user.email || null,
      recipient_count: count || 0,
    })
    .select()
    .single();
  if (insertError) throw insertError;

  const { data: delivery, error: pushError } = await supabase.functions.invoke('send-push', {
    body: {
      audience: { kind: 'all' },
      notification: {
        title,
        body,
        type: 'admin',
        screen: 'NotificationCenter',
        entityId: campaign.id,
        channelId: 'general_v2',
        data: {
          type: 'admin',
          screen: 'NotificationCenter',
          entityId: campaign.id,
        },
      },
    },
  });
  if (pushError) throw pushError;
  if (!delivery?.ok) throw new Error(delivery?.error || 'Push мэдэгдэл илгээж чадсангүй.');

  return {
    campaign: campaign as NotificationCampaign,
    delivery: delivery as PushDelivery,
  };
}

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

/** The RPC enforces role, employee permission and department scope on the server. */
export async function createEmployee(input: {
  email: string;
  name: string;
  last_name?: string;
  position?: string;
  phone?: string;
  address?: string;
  department_id?: string | null;
  role?: string;
}) {
  const { data, error } = await supabase.rpc('admin_authorize_gmail', {
    p_email: input.email.trim().toLowerCase(),
    p_name: input.name.trim(),
    p_last_name: input.last_name?.trim() || null,
    p_position: input.position?.trim() || null,
    p_phone: input.phone?.trim() || null,
    p_address: input.address?.trim() || null,
    p_department_id: input.department_id || null,
    p_role: input.role || 'employee',
  });
  if (error) throw error;
  return data;
}

export async function fetchEmployeeTrainings(email: string): Promise<EmployeeTraining[]> {
  const { data, error } = await supabase
    .from('employee_training_assignments')
    .select('*')
    .eq('employee_email', email.trim().toLowerCase())
    .order('status', { ascending: false })
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data || []) as EmployeeTraining[];
}

export async function fetchAllEmployeeTrainings(): Promise<EmployeeTraining[]> {
  const { data, error } = await supabase
    .from('employee_training_assignments')
    .select('*')
    .order('assigned_at', { ascending: false });
  if (error) throw error;
  return (data || []) as EmployeeTraining[];
}

export async function createEmployeeTraining(input: {
  employee: Employee;
  training_name: string;
  due_date?: string | null;
  note?: string | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('employee_training_assignments')
    .insert({
      employee_email: input.employee.email?.trim().toLowerCase(),
      employee_id: input.employee.registered ? input.employee.user_id : null,
      training_name: input.training_name.trim(),
      due_date: input.due_date || null,
      note: input.note?.trim() || null,
      assigned_by: auth.user?.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as EmployeeTraining;
}

export async function setEmployeeTrainingCompleted(id: string, completed: boolean) {
  const { error } = await supabase
    .from('employee_training_assignments')
    .update({
      status: completed ? 'completed' : 'required',
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteEmployeeTraining(id: string) {
  const { error } = await supabase.from('employee_training_assignments').delete().eq('id', id);
  if (error) throw error;
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
  const settings = await fetchCompanySettings().catch(() => DEFAULT_COMPANY_SETTINGS);
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
    const lateMinutes = lateMinutesAfterStart(inRow?.created_at || null, settings);
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
      late_minutes: lateMinutes,
      early_leave_minutes: 0,
      worked_minutes:
        inRow && outRow
          ? Math.round(
              (new Date(outRow.created_at).getTime() - new Date(inRow.created_at).getTime()) / 60000
            )
          : null,
      status: inRow ? (lateMinutes > 0 ? 'late' : 'on_time') : 'not_scheduled',
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

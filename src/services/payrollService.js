import { supabase } from '../lib/supabase';
import { uniqueChannel } from '../lib/realtimeChannel';

/**
 * Цалингийн үйлчилгээ.
 *
 * ЭРХИЙН ТУХАЙ: цалин бол эмзэг мэдээлэл. Хамгаалалт нь SQL талын RLS-д
 * байгаа (migration_payroll.sql) — ажилтан ЗӨВХӨН өөрийн мөрийг, админ
 * бүгдийг харна. Энд шалгахгүй, серверийн шийдвэрийг эцсийн үнэн гэж үзнэ.
 */

const RATES = 'payroll_rates';
const HOURS = 'work_hour_entries';
const REQUESTS = 'leave_requests';

export const OVERTIME_KIND = 'overtime';

// ---------------------------------------------------------------------------
// Цалингийн хувь хэмжээ
// ---------------------------------------------------------------------------

/** Ажилтны одоогийн ханш (хамгийн сүүлд хүчин төгөлдөр болсон). */
export async function fetchCurrentRate(userId) {
  const { data, error } = await supabase
    .from(RATES)
    .select('*')
    .eq('user_id', userId)
    .lte('effective_from', new Date().toISOString().slice(0, 10))
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/** Бүх ажилтны одоогийн ханш — админы жагсаалтад. */
export async function fetchAllCurrentRates() {
  const { data, error } = await supabase
    .from(RATES)
    .select('*')
    .lte('effective_from', new Date().toISOString().slice(0, 10))
    .order('effective_from', { ascending: false });
  if (error) throw error;
  // Ажилтан бүрийн хамгийн сүүлийнхийг үлдээнэ
  const latest = new Map();
  for (const row of data || []) {
    if (!latest.has(row.user_id)) latest.set(row.user_id, row);
  }
  return [...latest.values()];
}

/** Ханшийн түүх — хэзээ хэдэн төгрөг байсныг харах. */
export async function fetchRateHistory(userId) {
  const { data, error } = await supabase
    .from(RATES)
    .select('*')
    .eq('user_id', userId)
    .order('effective_from', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Шинэ ханш тогтоох.
 *
 * Хуучныг ЗАСАХГҮЙ, шинэ мөр нэмнэ. Ингэснээр өнгөрсөн сарын тайлан нь
 * тухайн үеийн ханшаараа тооцогдсон хэвээр үлдэнэ.
 */
export async function setRate({
  userId,
  userName,
  dailyRate,
  overtimeMultiplier = 1.5,
  standardHours = 8,
  effectiveFrom,
  note,
  createdBy,
  createdByName,
}) {
  const rate = Number(dailyRate);
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error('Өдрийн цалин 0-ээс их тоо байх ёстой.');
  }
  const mult = Number(overtimeMultiplier);
  if (!Number.isFinite(mult) || mult < 1) {
    throw new Error('Илүү цагийн коэффициент 1-ээс багагүй байх ёстой.');
  }
  const hours = Number(standardHours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
    throw new Error('Өдрийн жишиг цаг 1-24 хооронд байх ёстой.');
  }

  const from = effectiveFrom || new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from(RATES)
    .upsert(
      {
        user_id: userId,
        user_name: userName || null,
        daily_rate: rate,
        overtime_multiplier: mult,
        standard_hours: hours,
        effective_from: from,
        note: note || null,
        created_by: createdBy || null,
        created_by_name: createdByName || null,
      },
      { onConflict: 'user_id,effective_from' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Ажилласан цаг
// ---------------------------------------------------------------------------

export async function fetchHours({ userId, from, to }) {
  let q = supabase.from(HOURS).select('*').order('work_date', { ascending: false });
  if (userId) q = q.eq('user_id', userId);
  if (from) q = q.gte('work_date', from);
  if (to) q = q.lte('work_date', to);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/**
 * Өдрийн цагийг бичих/шинэчлэх.
 * Нэг ажилтанд нэг өдөр нэг мөр — давхардвал шинэчилнэ.
 */
export async function upsertHours({
  userId,
  userName,
  workDate,
  regularHours = 0,
  overtimeHours = 0,
  note,
  sourceRequestId,
  createdBy,
  createdByName,
}) {
  const reg = Number(regularHours) || 0;
  const ot = Number(overtimeHours) || 0;
  if (reg < 0 || reg > 24) throw new Error('Үндсэн цаг 0-24 хооронд байх ёстой.');
  if (ot < 0 || ot > 24) throw new Error('Илүү цаг 0-24 хооронд байх ёстой.');
  if (reg + ot > 24) throw new Error('Нийт цаг 24-өөс хэтэрч болохгүй.');

  const { data, error } = await supabase
    .from(HOURS)
    .upsert(
      {
        user_id: userId,
        user_name: userName || null,
        work_date: workDate,
        regular_hours: reg,
        overtime_hours: ot,
        note: note || null,
        source_request_id: sourceRequestId || null,
        created_by: createdBy || null,
        created_by_name: createdByName || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,work_date' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteHours(id) {
  const { error } = await supabase.from(HOURS).delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Илүү цагийн хүсэлт  (leave_requests, kind = 'overtime')
// ---------------------------------------------------------------------------

/** Ажилтан илүү цагийн хүсэлт илгээнэ. */
export async function requestOvertime({ userId, userName, workDate, hours, reason }) {
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0 || h > 24) {
    throw new Error('Илүү цаг 0-ээс их, 24-өөс бага байх ёстой.');
  }
  if (!reason?.trim()) throw new Error('Шалтгаанаа бичнэ үү.');

  const { data, error } = await supabase
    .from(REQUESTS)
    .insert({
      user_id: userId,
      user_name: userName || null,
      kind: OVERTIME_KIND,
      // Илүү цаг нэг өдөрт хамаарна — эхлэл/төгсгөл ижил
      date_from: workDate,
      date_to: workDate,
      hours: h,
      reason: reason.trim(),
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Илүү цагийн хүсэлтүүд. `userId` өгвөл зөвхөн тухайн хүнийх. */
export async function fetchOvertimeRequests({ userId, status } = {}) {
  let q = supabase
    .from(REQUESTS)
    .select('*')
    .eq('kind', OVERTIME_KIND)
    .order('created_at', { ascending: false });
  if (userId) q = q.eq('user_id', userId);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function countPendingOvertime() {
  const { count, error } = await supabase
    .from(REQUESTS)
    .select('id', { count: 'exact', head: true })
    .eq('kind', OVERTIME_KIND)
    .eq('status', 'pending');
  if (error) throw error;
  return count || 0;
}

/**
 * Админ илүү цагийн хүсэлтийг шийднэ.
 * Зөвшөөрвөл тухайн өдрийн цагийн бичилтэд АВТОМАТААР нэмнэ — админ
 * дахин гараар бичих шаардлагагүй.
 */
export async function reviewOvertime({
  requestId,
  approve,
  reviewerId,
  reviewerName,
  note,
}) {
  const { data: req, error: readErr } = await supabase
    .from(REQUESTS)
    .select('*')
    .eq('id', requestId)
    .single();
  if (readErr) throw readErr;

  const { data, error } = await supabase
    .from(REQUESTS)
    .update({
      status: approve ? 'approved' : 'rejected',
      reviewed_by: reviewerId || null,
      reviewed_by_name: reviewerName || null,
      review_note: note || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select()
    .single();
  if (error) throw error;

  if (approve) {
    // Аль хэдийн байгаа өдрийн бичилт дээр нэмнэ, дарж бичихгүй
    const existing = await fetchHours({
      userId: req.user_id,
      from: req.date_from,
      to: req.date_from,
    });
    const prev = existing[0];
    await upsertHours({
      userId: req.user_id,
      userName: req.user_name,
      workDate: req.date_from,
      regularHours: prev?.regular_hours ?? 0,
      overtimeHours: (Number(prev?.overtime_hours) || 0) + Number(req.hours || 0),
      note: prev?.note || null,
      sourceRequestId: req.id,
      createdBy: reviewerId,
      createdByName: reviewerName,
    });
  }

  return data;
}

export function subscribeOvertimeRequests(onChange) {
  const channel = uniqueChannel('overtime-requests')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: REQUESTS, filter: `kind=eq.${OVERTIME_KIND}` },
      onChange
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---------------------------------------------------------------------------
// Тооцоо
// ---------------------------------------------------------------------------

/**
 * Хугацааны цалингийн нэгтгэл.
 * Тооцоог SQL талд хийнэ — өдөр бүрийг тухайн үеийн ханшаар тооцно.
 */
export async function fetchSummary({ userId, from, to }) {
  const { data, error } = await supabase.rpc('payroll_summary', {
    p_user_id: userId,
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (
    row || {
      user_id: userId,
      days_worked: 0,
      regular_hours: 0,
      overtime_hours: 0,
      regular_pay: 0,
      overtime_pay: 0,
      total_pay: 0,
    }
  );
}

/** Сарын эхэн/сүүлийн огноог өгнө. */
export function monthRange(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    from: `${y}-${pad(m + 1)}-01`,
    to: new Date(y, m + 1, 0).toISOString().slice(0, 10),
  };
}

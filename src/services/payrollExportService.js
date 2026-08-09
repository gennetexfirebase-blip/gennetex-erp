/**
 * Payroll-ready export — ирц + shift + leave → CSV.
 */
import { supabase } from '../lib/supabase';
import { isFlagOn } from '../lib/featureFlags';

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows, columns) {
  const header = columns.map((c) => csvEscape(c.label)).join(',');
  const lines = rows.map((r) => columns.map((c) => csvEscape(c.get(r))).join(','));
  return [header, ...lines].join('\n');
}

function dateOnly(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

function hoursBetween(a, b) {
  if (!a || !b) return 0;
  const ms = new Date(b) - new Date(a);
  if (ms < 0) return 0;
  return Math.round((ms / 3600000) * 100) / 100;
}

/**
 * @param {{ from: string, to: string }} range ISO dates
 */
export async function buildPayrollRows({ from, to } = {}) {
  if (!isFlagOn('payrollExport') || !supabase) return [];

  const fromIso = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const toIso = to || new Date().toISOString();

  const [profilesRes, attRes, leaveRes] = await Promise.all([
    supabase.from('profiles').select('id, name, email, role, phone').neq('role', 'superadmin'),
    supabase
      .from('attendance')
      .select('*')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: true })
      .limit(5000),
    supabase
      .from('leave_requests')
      .select('*')
      .gte('start_date', fromIso.slice(0, 10))
      .lte('end_date', toIso.slice(0, 10))
      .limit(1000)
      .then((r) => r)
      .catch(() => ({ data: [] })),
  ]);

  const profiles = profilesRes.data || [];
  const attendance = attRes.data || [];
  const leaves = leaveRes.data || [];

  // Group attendance by user+day — check-in / check-out pairs
  const byUserDay = {};
  attendance.forEach((a) => {
    const uid = a.user_id || a.staff_id;
    if (!uid) return;
    const day = dateOnly(a.created_at || a.check_in_at);
    const key = `${uid}|${day}`;
    if (!byUserDay[key]) byUserDay[key] = { userId: uid, day, ins: [], outs: [], rows: [] };
    byUserDay[key].rows.push(a);
    const kind = (a.kind || a.type || '').toLowerCase();
    if (kind.includes('out') || kind === 'check_out') byUserDay[key].outs.push(a);
    else byUserDay[key].ins.push(a);
  });

  const leaveByUser = {};
  leaves.forEach((l) => {
    const uid = l.user_id;
    if (!uid) return;
    if (!leaveByUser[uid]) leaveByUser[uid] = [];
    leaveByUser[uid].push(l);
  });

  const rows = [];
  for (const p of profiles) {
    const days = Object.values(byUserDay).filter((d) => d.userId === p.id);
    let workDays = 0;
    let totalHours = 0;
    let overtimeHours = 0;
    days.forEach((d) => {
      workDays += 1;
      const cin = d.ins[0]?.created_at || d.ins[0]?.check_in_at || d.rows[0]?.created_at;
      const cout =
        d.outs[d.outs.length - 1]?.created_at ||
        d.outs[d.outs.length - 1]?.check_out_at ||
        (d.rows.length > 1 ? d.rows[d.rows.length - 1].created_at : null);
      const h = hoursBetween(cin, cout || cin);
      // if only check-in, count 8h default work day estimate
      const dayH = cout ? h : 8;
      totalHours += dayH;
      if (dayH > 8) overtimeHours += dayH - 8;
    });

    const userLeaves = leaveByUser[p.id] || [];
    const leaveDays = userLeaves
      .filter((l) => (l.status || '').toLowerCase() === 'approved' || l.status === 'Зөвшөөрсөн')
      .reduce((s, l) => {
        const a = new Date(l.start_date);
        const b = new Date(l.end_date || l.start_date);
        const diff = Math.max(1, Math.round((b - a) / 86400000) + 1);
        return s + diff;
      }, 0);

    rows.push({
      employee_id: p.id,
      name: p.name || '',
      email: p.email || '',
      phone: p.phone || '',
      role: p.role || 'employee',
      work_days: workDays,
      total_hours: Math.round(totalHours * 100) / 100,
      regular_hours: Math.round(Math.min(totalHours, workDays * 8) * 100) / 100,
      overtime_hours: Math.round(overtimeHours * 100) / 100,
      leave_days: leaveDays,
      period_from: dateOnly(fromIso),
      period_to: dateOnly(toIso),
    });
  }

  return rows.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'mn'));
}

export async function exportPayrollCsv(range) {
  const rows = await buildPayrollRows(range);
  const columns = [
    { label: 'Нэр', get: (r) => r.name },
    { label: 'Имэйл', get: (r) => r.email },
    { label: 'Утас', get: (r) => r.phone },
    { label: 'Эрх', get: (r) => r.role },
    { label: 'Ажилласан өдөр', get: (r) => r.work_days },
    { label: 'Нийт цаг', get: (r) => r.total_hours },
    { label: 'Үндсэн цаг', get: (r) => r.regular_hours },
    { label: 'Илүү цаг', get: (r) => r.overtime_hours },
    { label: 'Чөлөө (өдөр)', get: (r) => r.leave_days },
    { label: 'Эхлэл', get: (r) => r.period_from },
    { label: 'Төгсгөл', get: (r) => r.period_to },
  ];
  return { csv: toCsv(rows, columns), rows };
}

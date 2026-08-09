import { supabase } from '../lib/supabase';
import * as notifyApi from './notificationService';
import { fetchEmployeeProfiles } from './feedbackService';
import { MOVEMENT_TYPES, movementDelta } from '../lib/stockBalance';
import { isoWeekday } from '../lib/breakSchedule';
import { dayKey, calculateDayWork } from '../lib/workHours';
import { buildApprovedLeaveDaysMap } from './leaveRequestService';

function normName(v) {
  return String(v || '')
    .trim()
    .toLowerCase();
}

let superadminIdsCache = null;
let superadminNamesCache = null;

export async function fetchSuperadminProfileMeta() {
  if (superadminIdsCache) {
    return { ids: superadminIdsCache, names: superadminNamesCache };
  }
  const { data } = await supabase.from('profiles').select('id,name,email').eq('role', 'superadmin');
  const rows = data || [];
  superadminIdsCache = new Set(rows.map((r) => r.id).filter(Boolean));
  superadminNamesCache = new Set(
    rows.flatMap((r) => [r.name, r.email].filter(Boolean)).map((n) => normName(n))
  );
  return { ids: superadminIdsCache, names: superadminNamesCache };
}

export function isHiddenPerformanceUser(id, name, hidden = { ids: new Set(), names: new Set() }) {
  if (id && hidden.ids?.has(id)) return true;
  const n = normName(name);
  return n && hidden.names?.has(n);
}

export function stripHiddenFromPerformanceStats(stats, hidden) {
  if (!stats) return stats;
  const ids = hidden?.ids || new Set();
  const engineers = (stats.engineers || []).filter((e) => !isHiddenPerformanceUser(e.engineer_id, e.name, hidden));
  const anomalies = (stats.anomalies || []).filter(
    (a) =>
      !isHiddenPerformanceUser(a.closer_id, a.closer_name, hidden) &&
      !isHiddenPerformanceUser(a.taker_id, a.taker_name, hidden) &&
      !(a.assigned_ids || []).some((uid) => ids.has(uid))
  );
  const aiInsights = { ...(stats.ai_insights || {}) };
  Object.keys(aiInsights).forEach((key) => {
    if (isHiddenPerformanceUser(null, key, hidden)) delete aiInsights[key];
  });
  return { ...stats, engineers, anomalies, ai_insights: aiInsights };
}

function isLeaveNote(note) {
  return /чөлө|амралт|leave|coloo|off/i.test(String(note || ''));
}

function daysInRange(fromIso, toIso) {
  const out = [];
  const today = dayKey(new Date());
  const start = new Date(fromIso);
  start.setHours(0, 0, 0, 0);
  const end = new Date(toIso);
  end.setHours(0, 0, 0, 0);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dk = dayKey(d);
    if (dk > today) break;
    out.push(dk);
  }
  return out;
}

function buildRestScheduleMap(breakRows) {
  const map = {};
  (breakRows || []).forEach((r) => {
    if (!r.user_id) return;
    if (!map[r.user_id]) map[r.user_id] = new Set();
    map[r.user_id].add(r.day_of_week);
  });
  return map;
}

function buildShiftMap(shifts) {
  const map = {};
  (shifts || []).forEach((s) => {
    if (!s.user_id || !s.shift_date) return;
    if (!map[s.user_id]) map[s.user_id] = {};
    map[s.user_id][s.shift_date] = s;
  });
  return map;
}

function buildAttendanceMap(attendance) {
  const map = {};
  (attendance || []).forEach((a) => {
    const uid = a.staff_id;
    if (!uid) return;
    if ((a.status || 'approved') !== 'approved') return;
    if (!map[uid]) map[uid] = { checkInDays: new Set(), records: [] };
    map[uid].records.push(a);
    if (a.type === 'check_in') {
      map[uid].checkInDays.add(dayKey(new Date(a.created_at)));
    }
  });
  return map;
}

function applyAttendanceStats(row, userId, from, to, restMap, shiftMap, attMap, leaveDaysMap = {}) {
  const days = daysInRange(from, to);
  const restDays = restMap[userId] || null;
  const hasRestConfig = restDays && restDays.size > 0;
  const userShifts = shiftMap[userId] || {};
  const att = attMap[userId] || { checkInDays: new Set(), records: [] };
  const checkInDays = att.checkInDays;
  const approvedLeave = leaveDaysMap[userId] || new Set();

  let daysWorked = 0;
  let daysLeave = 0;
  let daysAbsent = 0;
  let totalWorkMs = 0;

  days.forEach((dk) => {
    const date = new Date(`${dk}T12:00:00`);
    const weekday = isoWeekday(date);
    const isWeeklyRest = hasRestConfig && restDays.has(weekday);
    const shift = userShifts[dk];
    const isExplicitLeave = shift && isLeaveNote(shift.note);

    if (checkInDays.has(dk)) {
      daysWorked += 1;
      totalWorkMs += calculateDayWork({ attendance: att.records, dateKey: dk }).netMs;
      return;
    }

    if (approvedLeave.has(dk)) {
      daysLeave += 1;
      return;
    }

    if (isWeeklyRest || isExplicitLeave) {
      daysLeave += 1;
      return;
    }

    const expectedWork =
      !!shift || (hasRestConfig && !isWeeklyRest) || (!hasRestConfig && weekday <= 5);

    if (expectedWork) daysAbsent += 1;
  });

  row.days_worked = daysWorked;
  row.days_absent = daysAbsent;
  row.days_leave = daysLeave;
  row.total_work_hours = Math.round((totalWorkMs / 3600000) * 10) / 10;
}

function callAssigneeIds(call) {
  return [call?.engineer_id, call?.partner_engineer_id].filter(Boolean);
}

function isAssignedToCall(userId, call) {
  if (!userId || !call) return false;
  return callAssigneeIds(call).includes(userId);
}

export async function fetchInventoryMap() {
  const { data, error } = await supabase.from('inventory').select('id, name, category, unit');
  if (error) return {};
  const map = {};
  (data || []).forEach((r) => {
    map[r.id] = r;
  });
  return map;
}

function countMovementItems(movements, userId, category, inventoryById) {
  let lines = 0;
  let qty = 0;
  const items = {};
  (movements || []).forEach((m) => {
    if (m.user_id !== userId) return;
    const cat = inventoryById[m.item_id]?.category || m.category || 'material';
    if (category === 'tool' && cat !== 'tool') return;
    if (category === 'material' && cat === 'tool') return;
    const type = m.movement_type || MOVEMENT_TYPES.WITHDRAW;
    if (type !== MOVEMENT_TYPES.WITHDRAW && movementDelta(m) <= 0) return;
    if (type === MOVEMENT_TYPES.WITHDRAW || (!m.movement_type && Number(m.quantity) > 0)) {
      const q = Math.abs(Number(m.quantity) || 0);
      lines += 1;
      qty += q;
      const key = m.item_id || m.item_name;
      if (!items[key]) items[key] = { name: m.item_name, unit: m.unit, qty: 0 };
      items[key].qty += q;
    }
  });
  return { lines, qty, items: Object.values(items).sort((a, b) => b.qty - a.qty) };
}

function materialsFromCloseMeta(call) {
  const mats = call?.close_meta?.materials;
  if (!Array.isArray(mats) || !mats.length) return [];
  return mats.map((m) => ({
    name: m.name,
    qty: m.qty,
    unit: m.unit || 'ширхэг',
  }));
}

export function buildEngineerRow(id, name) {
  return {
    engineer_id: id || null,
    name: name || 'Тодорхойгүй',
    total_calls: 0,
    ail_calls: 0,
    baiguulga_calls: 0,
    partner_calls: 0,
    done_calls: 0,
    sla_exceeded: 0,
    complaints_mentioned: 0,
    gomdol_mentioned: 0,
    sanal_mentioned: 0,
    complaint_snippets: [],
    gomdol_snippets: [],
    sanal_snippets: [],
    materials_withdrawn: 0,
    materials_withdrawn_qty: 0,
    tools_withdrawn: 0,
    tools_withdrawn_qty: 0,
    materials_used_at_calls: 0,
    materials_used_items: [],
    call_closes: 0,
    suspicious_flags: [],
    days_worked: 0,
    days_absent: 0,
    days_leave: 0,
    total_work_hours: 0,
  };
}

export function detectAnomalies({ calls, movements, inventoryById, employees }) {
  const anomalies = [];
  const nameById = {};
  (employees || []).forEach((e) => {
    if (e.id) nameById[e.id] = e.name || e.email;
  });

  (calls || []).forEach((call) => {
    const mats = materialsFromCloseMeta(call);
    if (!mats.length) return;
    const closerId = call.close_meta?.closed_by_id || null;
    const closerName = call.close_meta?.closed_by || call.engineer_name || '—';
    const assigned = callAssigneeIds(call);
    if (!closerId || !assigned.length) return;
    if (isAssignedToCall(closerId, call)) return;

    const assignedNames = [
      call.engineer_name,
      call.partner_engineer_name,
    ]
      .filter(Boolean)
      .join(', ');

    anomalies.push({
      type: 'call_materials_wrong_engineer',
      call_id: call.id,
      customer: call.customer,
      address: call.address,
      site_kind: call.site_kind,
      closer_id: closerId,
      closer_name: closerName,
      assigned_ids: assigned,
      assigned_names: assignedNames,
      materials: mats,
      at: call.close_meta?.closed_at || call.updated_at,
      message: `${closerName} нь ${call.customer || 'айл'} дээр ${assignedNames}-ийн дuудлага дээр бараа (${mats.map((m) => `${m.name}×${m.qty}`).join(', ')}) бүртгэсэн.`,
    });
  });

  const openCalls = (calls || []).filter(
    (c) => c.status === 'Явж байгаа' || c.status === 'Хүлээгдэж буй'
  );

  (movements || []).forEach((m) => {
    const type = m.movement_type || MOVEMENT_TYPES.WITHDRAW;
    if (type !== MOVEMENT_TYPES.WITHDRAW && (!type && Number(m.quantity) <= 0)) return;
    if (type !== MOVEMENT_TYPES.WITHDRAW && movementDelta(m) <= 0) return;
    const takerId = m.user_id;
    if (!takerId) return;

    openCalls.forEach((call) => {
      if (isAssignedToCall(takerId, call)) return;
      const assigned = callAssigneeIds(call);
      if (!assigned.length) return;
      const cat = inventoryById[m.item_id]?.category || 'material';
      anomalies.push({
        type: 'stock_withdraw_not_assigned',
        call_id: call.id,
        customer: call.customer,
        taker_id: takerId,
        taker_name: m.user_name || nameById[takerId] || '—',
        assigned_ids: assigned,
        assigned_names: [call.engineer_name, call.partner_engineer_name].filter(Boolean).join(', '),
        item_name: m.item_name,
        qty: Math.abs(Number(m.quantity) || 0),
        unit: m.unit,
        category: cat,
        at: m.created_at,
        message: `${m.user_name || 'Ажилтан'} «${m.item_name}» (${Math.abs(Number(m.quantity) || 0)} ${m.unit || ''}) авлаа — «${call.customer || 'айл'}» дээр ${[call.engineer_name, call.partner_engineer_name].filter(Boolean).join(', ')} оноогдсон.`,
      });
      return;
    });
  });

  return anomalies;
}

export async function collectFullEngineerStats(from, to) {
  const fromDate = dayKey(new Date(from));
  const toDate = dayKey(new Date(to));
  const [callsRes, feedbackRes, movRes, invMap, employees, attRes, breakRes, shiftRes, leaveRes] = await Promise.all([
    supabase.from('service_calls').select('*').gte('created_at', from).lte('created_at', to).limit(800),
    supabase
      .from('employee_feedback')
      .select('*')
      .gte('created_at', from)
      .lte('created_at', to)
      .limit(400),
    supabase
      .from('stock_movements')
      .select('*')
      .gte('created_at', from)
      .lte('created_at', to)
      .limit(1500),
    fetchInventoryMap(),
    fetchEmployeeProfiles().catch(() => []),
    supabase.from('attendance').select('*').gte('created_at', from).lte('created_at', to).limit(3000),
    supabase.from('employee_break_schedules').select('user_id,day_of_week'),
    supabase
      .from('employee_shifts')
      .select('user_id,shift_date,note')
      .gte('shift_date', fromDate)
      .lte('shift_date', toDate)
      .limit(2000),
    supabase
      .from('leave_requests')
      .select('*')
      .lte('date_from', toDate)
      .gte('date_to', fromDate)
      .limit(500),
  ]);

  if (callsRes.error) throw callsRes.error;
  const calls = callsRes.data || [];
  const feedback = feedbackRes.error ? [] : feedbackRes.data || [];
  const movements = movRes.error ? [] : movRes.data || [];
  const inventoryById = invMap || {};
  const attendance = attRes.error ? [] : attRes.data || [];
  const restMap = buildRestScheduleMap(breakRes.error ? [] : breakRes.data);
  const shiftMap = buildShiftMap(shiftRes.error ? [] : shiftRes.data);
  const attMap = buildAttendanceMap(attendance);
  const leaveDaysMap = buildApprovedLeaveDaysMap(
    leaveRes.error ? [] : leaveRes.data,
    from,
    to
  );

  const byEngineer = {};
  const ensure = (id, name) => {
    const key = id || normName(name) || 'unknown';
    if (!byEngineer[key]) byEngineer[key] = buildEngineerRow(id, name);
    return byEngineer[key];
  };

  employees.forEach((e) => ensure(e.id, e.name || e.email));

  calls.forEach((c) => {
    const addCall = (id, name, asPartner = false) => {
      if (!id && !name) return;
      const row = ensure(id, name);
      row.total_calls += 1;
      if (asPartner) row.partner_calls += 1;
      if (c.site_kind === 'baiguulga') row.baiguulga_calls += 1;
      else row.ail_calls += 1;
      if (c.status === 'Дууссан') row.done_calls += 1;
      if (c.sla_alert_at) row.sla_exceeded += 1;

      const mats = materialsFromCloseMeta(c);
      const closerId = c.close_meta?.closed_by_id;
      if (mats.length && (closerId === id || (!closerId && c.engineer_id === id))) {
        row.materials_used_at_calls += 1;
        row.call_closes += 1;
        mats.forEach((m) => {
          const ex = row.materials_used_items.find((x) => x.name === m.name);
          if (ex) ex.qty += m.qty;
          else row.materials_used_items.push({ ...m });
        });
      }
    };
    addCall(c.engineer_id, c.engineer_name, false);
    if (c.partner_engineer_id && c.partner_engineer_id !== c.engineer_id) {
      addCall(c.partner_engineer_id, c.partner_engineer_name, true);
    }
  });

  feedback.forEach((f) => {
    const names = f.mentioned_employee_names || [];
    const ids = f.mentioned_employee_ids || [];
    if (!names.length && !ids.length) return;
    const isSanal = f.kind === 'sanal';
    names.forEach((name, i) => {
      const id = ids[i] || null;
      const row = ensure(id, name);
      if (isSanal) {
        row.sanal_mentioned += 1;
        if (row.sanal_snippets.length < 8) {
          row.sanal_snippets.push({
            from: f.user_name,
            kind: f.kind,
            text: String(f.body || '').slice(0, 200),
            at: f.created_at,
          });
        }
      } else {
        row.complaints_mentioned += 1;
        row.gomdol_mentioned += 1;
        if (row.gomdol_snippets.length < 8) {
          row.gomdol_snippets.push({
            from: f.user_name,
            kind: f.kind,
            text: String(f.body || '').slice(0, 200),
            at: f.created_at,
          });
        }
      }
      if (row.complaint_snippets.length < 8) {
        row.complaint_snippets.push({
          from: f.user_name,
          kind: f.kind,
          text: String(f.body || '').slice(0, 200),
          at: f.created_at,
        });
      }
    });
  });

  Object.values(byEngineer).forEach((row) => {
    if (!row.engineer_id) return;
    const mat = countMovementItems(movements, row.engineer_id, 'material', inventoryById);
    const tool = countMovementItems(movements, row.engineer_id, 'tool', inventoryById);
    row.materials_withdrawn = mat.lines;
    row.materials_withdrawn_qty = mat.qty;
    row.materials_withdrawn_items = mat.items.slice(0, 15);
    row.tools_withdrawn = tool.lines;
    row.tools_withdrawn_qty = tool.qty;
    row.tools_withdrawn_items = tool.items.slice(0, 15);
    applyAttendanceStats(row, row.engineer_id, from, to, restMap, shiftMap, attMap, leaveDaysMap);
  });

  const anomalies = detectAnomalies({ calls, movements, inventoryById, employees });

  anomalies.forEach((a) => {
    [a.closer_id, a.taker_id, ...(a.assigned_ids || [])].filter(Boolean).forEach((uid) => {
      const row = Object.values(byEngineer).find((r) => r.engineer_id === uid);
      if (row && !row.suspicious_flags.includes(a.type)) {
        row.suspicious_flags.push(a.type);
      }
    });
  });

  const hidden = await fetchSuperadminProfileMeta();
  const raw = {
    from,
    to,
    engineers: Object.values(byEngineer).sort(
      (a, b) => b.ail_calls - a.ail_calls || b.complaints_mentioned - a.complaints_mentioned
    ),
    feedback_count: feedback.length,
    calls_count: calls.length,
    movements_count: movements.length,
    attendance_count: attendance.length,
    anomalies,
    inventoryById,
  };
  return stripHiddenFromPerformanceStats(raw, hidden);
}

export function getEngineerFromStats(stats, engineerId, engineerName) {
  if (!stats?.engineers?.length) return null;
  if (engineerId) {
    const hit = stats.engineers.find((e) => e.engineer_id === engineerId);
    if (hit) return hit;
  }
  const n = normName(engineerName);
  return stats.engineers.find((e) => normName(e.name) === n) || null;
}

export function formatEngineerDetailText(row, anomalies = []) {
  if (!row) return 'Мэдээлэл алга.';
  const mine = (anomalies || []).filter(
    (a) =>
      a.closer_id === row.engineer_id ||
      a.taker_id === row.engineer_id ||
      (a.assigned_ids || []).includes(row.engineer_id)
  );
  const lines = [
    `📋 ${row.name}`,
    `Айл: ${row.ail_calls} · Байгууллага: ${row.baiguulga_calls} · Нийт дuудлага: ${row.total_calls}`,
    `Дууссан: ${row.done_calls} · SLA хэтрэлт: ${row.sla_exceeded} · Гomдол: ${row.complaints_mentioned}`,
    `Бараа авсан: ${row.materials_withdrawn} төрөл (${row.materials_withdrawn_qty} нэгж)`,
    `Багаж авсан: ${row.tools_withdrawn} төрөл (${row.tools_withdrawn_qty} нэгж)`,
    `Айл дээр бараа бүртгэсэн: ${row.materials_used_at_calls} удаа`,
    `Ирц: ${row.days_worked} өдөр ажилласан · ${row.days_absent} тасалсан · ${row.days_leave} чөлөө/амралт`,
    `Нийт ажилласан: ${row.total_work_hours || 0} цаг`,
  ];
  if (row.materials_used_items?.length) {
    lines.push(`Хэрэглэсэн: ${row.materials_used_items.map((m) => `${m.name}×${m.qty}`).join(', ')}`);
  }
  if (row.complaint_snippets?.length) {
    lines.push('\nГomдол/санал:');
    row.complaint_snippets.forEach((s) => lines.push(`• ${s.text}`));
  }
  if (mine.length) {
    lines.push('\n⚠️ Анхаарах:');
    mine.slice(0, 5).forEach((a) => lines.push(`• ${a.message}`));
  }
  return lines.join('\n');
}

export function formatEngineerDetailWithAi(row, anomalies = [], aiInsight = null) {
  const base = formatEngineerDetailText(row, anomalies);
  if (!aiInsight) return base;
  const extra = [
    '\n🤖 AI дүгнэлт:',
    `Эрсдэл: ${aiInsight.risk_level || '—'}`,
  ];
  if (aiInsight.patterns?.length) extra.push(`Давтамж: ${aiInsight.patterns.join('; ')}`);
  if (aiInsight.recommendation) extra.push(`Зөвлөмж: ${aiInsight.recommendation}`);
  return `${base}\n${extra.join('\n')}`;
}

export function getAiInsightForEngineer(stats, engineerName) {
  if (!stats?.ai_insights || !engineerName) return null;
  const direct = stats.ai_insights[engineerName];
  if (direct) return direct;
  const n = normName(engineerName);
  return Object.entries(stats.ai_insights).find(([k]) => normName(k) === n)?.[1] || null;
}

export async function notifyAnomalies(anomalies, { skipTypes = [] } = {}) {
  const sent = new Set();
  for (const a of anomalies || []) {
    if (skipTypes.includes(a.type)) continue;
    const recipients = [...new Set(a.assigned_ids || [])].filter(Boolean);
    const key = `${a.type}:${a.call_id}:${a.taker_id || a.closer_id}:${a.item_name || ''}`;
    if (sent.has(key)) continue;
    sent.add(key);

    if (recipients.length) {
      await notifyApi.notifyUsers(recipients, {
        title: '⚠️ Бараа/дуудлага зөрүү',
        body: (a.message || '').slice(0, 200),
        data: { type: 'engineer_anomaly', callId: a.call_id, anomalyType: a.type },
        channelId: 'chat',
        priority: 'high',
      });
    }
    await notifyApi.notifyAdmins({
      title: 'AI гүйцэтгэл — зөрүү илэрлээ',
      body: (a.message || '').slice(0, 200),
      data: { type: 'engineer_anomaly_admin', callId: a.call_id },
      channelId: 'chat',
      priority: 'high',
    });
  }
}

/** Дуудлага хаах — оноогдсон биш инженер бараа бүртгэвэл */
export async function notifyCallCloseMismatch(call, closerId, closerName, materials = []) {
  if (!call || !closerId || isAssignedToCall(closerId, call)) return;
  const mats = (materials || []).map((m) => `${m.name}×${m.qty}`).join(', ');
  const assignedNames = [call.engineer_name, call.partner_engineer_name].filter(Boolean).join(', ');
  const anomaly = {
    type: 'call_materials_wrong_engineer',
    call_id: call.id,
    customer: call.customer,
    closer_id: closerId,
    closer_name: closerName,
    assigned_ids: callAssigneeIds(call),
    assigned_names: assignedNames,
    materials,
    message: `${closerName} ${call.customer || 'айл'} дээр бараа (${mats || '—'}) бүртгэлээ. Оноогдсон: ${assignedNames}.`,
  };
  await notifyAnomalies([anomaly]);
}

/** Агуулахаас авсан — оноогдсон дuудлагын биш бол */
export async function notifyStockWithdrawMismatch(userId, userName, item, qty) {
  const cutoff = new Date(Date.now() - 48 * 3600000).toISOString();
  const { data: openCalls } = await supabase
    .from('service_calls')
    .select('id, customer, engineer_id, engineer_name, partner_engineer_id, partner_engineer_name, status')
    .gte('created_at', cutoff)
    .not('status', 'in', '("Дууссан","Татгалзсан","Дахимдах")');

  const anomalies = [];
  (openCalls || []).forEach((call) => {
    if (isAssignedToCall(userId, call)) return;
    const assigned = callAssigneeIds(call);
    if (!assigned.length) return;
    anomalies.push({
      type: 'stock_withdraw_not_assigned',
      call_id: call.id,
      customer: call.customer,
      taker_id: userId,
      taker_name: userName,
      assigned_ids: assigned,
      assigned_names: [call.engineer_name, call.partner_engineer_name].filter(Boolean).join(', '),
      item_name: item?.name,
      qty,
      unit: item?.unit,
      message: `${userName} «${item?.name}» (${qty}) авлаа — ${call.customer} дээр ${[call.engineer_name, call.partner_engineer_name].filter(Boolean).join(', ')} оноогдсон.`,
    });
  });

  if (anomalies.length) await notifyAnomalies(anomalies.slice(0, 3));
}

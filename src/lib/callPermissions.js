/** Дуудлагын үйлдэл — бүх инженер (дуусаагүй дuудлага дээр) */

export function isCallAssignee(call, user) {
  if (!call || !user) return false;
  if (call.engineer_id && user.id && String(call.engineer_id) === String(user.id)) return true;
  if (call.partner_engineer_id && user.id && String(call.partner_engineer_id) === String(user.id)) return true;
  const en = (call.engineer || '').trim().toLowerCase();
  const un = (user.name || user.email || '').trim().toLowerCase();
  return Boolean(en && un && en === un);
}

export function canPerformCallActions(call, user, isAdmin) {
  if (!call || !user) return false;
  if (call.status === 'Дууссан') return false;
  if (isCallCancelled(call)) return false;
  if (isAdmin) return true;
  return true;
}

/** Бусад инженерийн task — зөвхөн мэдээлэл харуулах */
export function isSharedCallView(call, user, isAdmin) {
  if (!call || !user || isAdmin) return false;
  return !isCallAssignee(call, user);
}

export function isCallCancelled(call) {
  if (!call) return false;
  if (call.status === 'Татгалзсан') return true;
  return call.status === 'Шилжүүлсэн' && call.close_meta?.transfer?.type === 'Cancel';
}

export function isCallRescheduled(call) {
  if (!call) return false;
  if (call.status === 'Дахимдах') return true;
  const t = call.close_meta?.transfer?.type;
  return t === 'Dahimdah' || t === 'Reschedule';
}

export function getCallCancelNote(call) {
  const t = call?.close_meta?.transfer;
  if (!t) return '';
  const parts = [];
  if (t.reason) parts.push(t.reason);
  if (t.comment) parts.push(t.comment);
  return parts.join(' · ');
}

export function callDriverLabel(call) {
  return call?.engineer || 'Жолооч тодорхойгүй';
}

export function callTeamLabel(call) {
  return call?.team_name || 'Хамт яваа баг';
}

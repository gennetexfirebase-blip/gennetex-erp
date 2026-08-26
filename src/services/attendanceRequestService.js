import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import * as notifyApi from './notificationService';
import { attendanceRequestTypeLabel } from '../lib/attendanceRequestTypes';

const TABLE = 'attendance_requests';
const BUCKET = 'attendance';

export async function uploadAttachment(uri, userId) {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const path = `requests/${userId || 'anon'}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function submitAttendanceRequest({
  employeeId,
  employeeName,
  type,
  requestedDate,
  requestedTime,
  reason,
  attachments = [],
}) {
  const row = {
    employee_id: employeeId,
    employee_name: employeeName || 'Ажилтан',
    type,
    requested_date: requestedDate,
    requested_time: requestedTime || null,
    reason: reason ? String(reason).trim() : null,
    attachments,
    status: 'pending',
  };
  const { data, error } = await supabase.from(TABLE).insert(row).select().single();
  if (error) throw error;

  try {
    await notifyApi.notifyAttendanceRequestToAdmins({
      userName: row.employee_name,
      typeLabel: attendanceRequestTypeLabel(type),
      requestId: data.id,
    });
  } catch (e) {}

  return data;
}

export async function fetchMyAttendanceRequests(employeeId, limit = 50) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchAttendanceRequests({ status = null, limit = 100 } = {}) {
  let q = supabase.from(TABLE).select('*').order('created_at', { ascending: false }).limit(limit);
  if (status && status !== 'all') q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function cancelAttendanceRequest(requestId) {
  const { data, error } = await supabase.rpc('cancel_attendance_request', {
    p_request_id: requestId,
  });
  if (error) throw error;
  return data;
}

export async function decideAttendanceRequest(requestId, decision, rejectionReason = null) {
  const { data, error } = await supabase.rpc('admin_decide_attendance_request', {
    p_request_id: requestId,
    p_decision: decision,
    p_rejection_reason: rejectionReason,
  });
  if (error) throw error;

  try {
    await notifyApi.notifyAttendanceRequestDecision(data.employee_id, {
      typeLabel: attendanceRequestTypeLabel(data.type),
      status: decision,
      rejectionReason,
      requestId,
    });
  } catch (e) {}

  return data;
}

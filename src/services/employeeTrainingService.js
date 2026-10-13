import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';

const CERT_BUCKET = 'training-certificates';

export const TRAINING_STATUS = {
  REQUIRED: 'required',
  COMPLETED: 'completed',
};

export async function fetchEmployeeTrainings(employeeEmail) {
  const email = String(employeeEmail || '').trim().toLowerCase();
  if (!email) return [];
  const { data, error } = await supabase
    .from('employee_training_assignments')
    .select('*')
    .eq('employee_email', email)
    .order('status', { ascending: false })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('assigned_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Удирдлагын сургалтын тойм.
 *
 * RLS нь нэвтэрсэн хэрэглэгчийн удирдах эрхтэй ажилтнуудын мөрийг л
 * буцаана. Клиент дээр email бүрээр олон хүсэлт явуулахгүй, нэг хүсэлтээр
 * бүх төлөвийг авч overview дэлгэц дээр бүлэглэнэ.
 */
export async function fetchTrainingOverview() {
  const { data, error } = await supabase
    .from('employee_training_assignments')
    .select('*')
    .order('assigned_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addEmployeeTraining({ employee, trainingName, dueDate, note, assignedBy }) {
  const email = String(employee?.email || '').trim().toLowerCase();
  const name = String(trainingName || '').trim();
  if (!email || !name) throw new Error('Ажилтан болон сургалтын нэр шаардлагатай.');
  const employeeId = employee?.pending || String(employee?.id || '').startsWith('pending:')
    ? null
    : employee?.id || null;
  const { data: auth } = assignedBy ? { data: null } : await supabase.auth.getUser();
  const actorId = assignedBy || auth?.user?.id;
  if (!actorId) throw new Error('Нэвтрэлт дууссан байна. Дахин нэвтэрнэ үү.');
  const { data, error } = await supabase
    .from('employee_training_assignments')
    .insert({
      employee_email: email,
      employee_id: employeeId,
      training_name: name,
      due_date: dueDate || null,
      note: String(note || '').trim() || null,
      assigned_by: actorId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setEmployeeTrainingCompleted(id, completed) {
  const { data, error } = await supabase
    .from('employee_training_assignments')
    .update({
      status: completed ? TRAINING_STATUS.COMPLETED : TRAINING_STATUS.REQUIRED,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEmployeeTraining(id) {
  const { error } = await supabase.from('employee_training_assignments').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Сертификат (20261011151000_training_certificates.sql)
// ---------------------------------------------------------------------------

/** Оруулсан сертификатын зургийн түр URL-ууд: { [assignmentId]: url }. */
export async function certificateUrls(rows) {
  const paths = (rows || []).map((r) => r.certificate_path).filter(Boolean);
  if (!paths.length) return {};
  const { data } = await supabase.storage.from(CERT_BUCKET).createSignedUrls(paths, 3600);
  const byPath = new Map((data || []).map((s) => [s.path, s.signedUrl]));
  const out = {};
  rows.forEach((r) => {
    if (r.certificate_path && byPath.get(r.certificate_path)) out[r.id] = byPath.get(r.certificate_path);
  });
  return out;
}

/**
 * Сургалтын олгосон сертификатын зургийг оруулна. Сертификат оруулсан
 * сургалт хамрагдсан гэж тооцогдоно.
 */
export async function uploadCertificate(row, uri) {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const path = `${row.id}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(CERT_BUCKET).upload(path, decode(base64), { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  const now = new Date().toISOString();
  const { data, error: updateError } = await supabase
    .from('employee_training_assignments')
    .update({
      certificate_path: path,
      certificate_uploaded_at: now,
      status: TRAINING_STATUS.COMPLETED,
      completed_at: row.completed_at || now,
      updated_at: now,
    })
    .eq('id', row.id)
    .select()
    .single();
  if (updateError) throw updateError;
  if (row.certificate_path) await supabase.storage.from(CERT_BUCKET).remove([row.certificate_path]).catch(() => null);
  return data;
}

export async function removeCertificate(row) {
  const { error } = await supabase
    .from('employee_training_assignments')
    .update({ certificate_path: null, certificate_uploaded_at: null, updated_at: new Date().toISOString() })
    .eq('id', row.id);
  if (error) throw error;
  if (row.certificate_path) await supabase.storage.from(CERT_BUCKET).remove([row.certificate_path]).catch(() => null);
}

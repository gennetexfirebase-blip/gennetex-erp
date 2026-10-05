import { supabase } from '../lib/supabase';

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

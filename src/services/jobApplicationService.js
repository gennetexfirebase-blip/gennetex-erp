import { supabase } from '../lib/supabase';
import { uniqueChannel } from '../lib/realtimeChannel';
import * as notifyApi from './notificationService';

const TABLE = 'job_applications';

export const APPLICATION_STATUS = [
  { key: 'new', label: 'Шинэ' },
  { key: 'reviewing', label: 'Хянаж буй' },
  { key: 'contacted', label: 'Холбогдсон' },
  { key: 'hired', label: 'Ажилд авсан' },
  { key: 'rejected', label: 'Татгалзсан' },
];

export function applicationStatusLabel(status) {
  return APPLICATION_STATUS.find((s) => s.key === status)?.label || status || '—';
}

/** Ажилд орох анкет илгээх (public формоос эсвэл апп дотроос) */
export async function submitApplication({ name, lastName, phone, email, position, message, cvUrl, source = 'app' }) {
  const n = String(name || '').trim();
  if (!n) throw new Error('Нэрээ бичнэ үү.');
  const row = {
    name: n,
    last_name: String(lastName || '').trim() || null,
    phone: String(phone || '').trim() || null,
    email: String(email || '').trim() || null,
    position: String(position || '').trim() || null,
    message: String(message || '').trim() || null,
    cv_url: String(cvUrl || '').trim() || null,
    source,
    status: 'new',
  };
  const { data, error } = await supabase.from(TABLE).insert(row).select().single();
  if (error) {
    if (/job_applications/i.test(error.message)) {
      throw new Error('job_applications хүснэгт байхгүй. migration_job_applications.sql ажиллуулна уу.');
    }
    throw error;
  }
  try {
    await notifyApi.notifyApplicationToAdmins({
      name: n,
      position: row.position,
      phone: row.phone,
      applicationId: data.id,
    });
  } catch (e) {}
  return data;
}

export async function fetchApplications(limit = 200) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function countNewApplications() {
  const { count, error } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('status', 'new');
  if (error) return 0;
  return count || 0;
}

export async function updateApplicationStatus(id, status) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function approveApplication(id, { signatureSvg, adminId, adminName }) {
  if (!id || !signatureSvg) throw new Error('Гарын үсэг зурна уу.');
  const patch = {
    admin_signature_svg: signatureSvg,
    admin_signed_at: new Date().toISOString(),
    admin_signed_by: adminId || null,
    admin_signed_by_name: adminName || 'Админ',
  };
  const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export function subscribeApplications(onChange) {
  const channel = uniqueChannel('job-applications')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => onChange?.())
    .subscribe();
  return () => supabase.removeChannel(channel);
}

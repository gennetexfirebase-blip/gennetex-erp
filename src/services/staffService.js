import { supabase } from '../lib/supabase';
import { withoutSampleByName } from '../lib/sampleNames';

const TABLE = 'staff';

export async function fetchStaff() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return withoutSampleByName(data || []);
}

export async function insertStaff(staff) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      name: staff.name,
      phone: staff.phone || null,
      role: staff.role || 'Ажилтан',
      color: staff.color || '#3b82f6',
      latitude: staff.latitude ?? null,
      longitude: staff.longitude ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Ажилтны real-time байршлыг шинэчлэх
export async function updateStaffLocation(id, latitude, longitude) {
  const { error } = await supabase
    .from(TABLE)
    .update({ latitude, longitude, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// Ажилтны байршлын өөрчлөлтийг real-time сонсох
export function subscribeStaff(onChange) {
  const channel = supabase
    .channel('staff-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      () => onChange()
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

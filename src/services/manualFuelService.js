import { supabase } from '../lib/supabase';
import { validateFuelEntry } from '../lib/fuelEntry';

export async function fetchMyFuelEntries() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth?.user) throw new Error('Бүртгэлээ харахын тулд нэвтэрнэ үү.');
  const { data, error } = await supabase.from('manual_fuel_entries').select('*,vehicles(plate_number)').eq('user_id', auth.user.id).order('consumed_on', { ascending: false }).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return data || [];
}

export async function saveFuelEntry(input, id) {
  const payload = validateFuelEntry(input);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth?.user) throw new Error('Бүртгэл оруулахын тулд нэвтэрнэ үү.');
  const { data, error } = await supabase.from('manual_fuel_entries').insert({ ...payload, id, user_id: auth.user.id }).select().single();
  if (error?.code === '23505') {
    const existing = await supabase.from('manual_fuel_entries').select().eq('id', id).eq('user_id', auth.user.id).single();
    if (existing.error) throw existing.error;
    if (Object.keys(payload).some((key) => String(existing.data[key]) !== String(payload[key]))) {
      throw new Error('Өмнөх хүсэлт хадгалагдсан байна. Жагсаалтаа шинэчилж шалгана уу.');
    }
    return existing.data;
  }
  if (error) throw error;
  return data;
}

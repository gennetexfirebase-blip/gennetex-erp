import { supabase } from '../../lib/supabase';
import { LocationPoint } from '../utils/locationUtils';
export function trackingClient() {
  if (!supabase) throw new Error('Supabase холболт тохируулагдаагүй');
  return supabase;
}
export async function fetchCurrentLocations(employeeId?: string): Promise<LocationPoint[]> {
  const rows: LocationPoint[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = trackingClient().from('current_locations').select('*, profiles(name)').order('employee_id').range(offset, offset + 499);
    if (employeeId) query = query.eq('employee_id', employeeId);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []).map((row: any) => ({ ...row, name: row.profiles?.name, timestamp: Number(row.timestamp) })));
    if ((data || []).length < 500) return rows;
  }
}
export async function fetchEmployeeRoute(id: string, day: string): Promise<LocationPoint[]> {
  const rows: LocationPoint[] = [];
  let after = 0;
  for (;;) {
    const { data, error } = await trackingClient().from('location_history').select('*').eq('employee_id', id).eq('day', day)
      .gt('timestamp', after).order('timestamp').limit(500);
    if (error) throw error;
    rows.push(...(data || []).map((p: any) => ({ ...p, timestamp: Number(p.timestamp) })));
    if ((data || []).length < 500) return rows;
    after = Number(data[data.length - 1].timestamp);
  }
}

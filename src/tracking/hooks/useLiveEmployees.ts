import { useEffect, useState } from 'react';
import { fetchCurrentLocations, trackingClient } from '../services/realtimeLocationService';
import { LocationPoint } from '../utils/locationUtils';
export function useLiveEmployees(enabled: boolean, employeeId?: string) {
  const [employees, setEmployees] = useState<LocationPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!enabled) { setEmployees([]); setLoading(false); return; }
    const supabase = trackingClient();
    let active = true;
    const pending = new Map<string, LocationPoint>();
    const knownNames = new Set<string>();
    let fetching = false;
    const refresh = async () => {
      if (fetching) return;
      fetching = true;
      pending.clear();
      try {
        const rows = await fetchCurrentLocations(employeeId);
        rows.forEach(p => knownNames.add(p.employee_id));
        if (active) { setEmployees(rows.map(p => { const latest = pending.get(p.employee_id); return latest && latest.timestamp >= p.timestamp ? { ...p, ...latest } : p; })); pending.clear(); setError(null); }
      } catch (e: any) { if (active) setError(e.message); }
      finally { fetching = false; if (active) setLoading(false); }
    };
    const channel = supabase.channel(`tracking-current-${Math.random()}`).on('postgres_changes',
      { event: '*', schema: 'public', table: 'current_locations', ...(employeeId ? { filter: `employee_id=eq.${employeeId}` } : {}) }, (event: any) => {
        if (!active) return;
        if (event.eventType === 'DELETE') { setEmployees(rows => rows.filter(p => p.employee_id !== event.old.employee_id)); return; }
        const row = { ...event.new, timestamp: Number(event.new.timestamp) };
        if (!knownNames.has(row.employee_id)) {
          knownNames.add(row.employee_id);
          fetchCurrentLocations(row.employee_id).then(records => {
            if (active && records[0]) setEmployees(old => old.map(p => p.employee_id === row.employee_id ? { ...p, name: records[0].name } : p));
          }).catch(() => knownNames.delete(row.employee_id));
        }
        if (fetching) pending.set(row.employee_id, row);
        setEmployees(rows => {
          const previous = rows.find(p => p.employee_id === row.employee_id);
          if (!previous) return [...rows, row];
          if (previous.timestamp > row.timestamp) return rows;
          return rows.map(p => p.employee_id === row.employee_id ? { ...previous, ...row } : p);
        });
      }).subscribe((status: string) => {
        if (status === 'SUBSCRIBED') void refresh();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setError('Realtime холболт тасарсан. Дахин холбогдож байна.');
      });
    void refresh();
    const timer = setInterval(refresh, 60000);
    return () => { active = false; clearInterval(timer); void supabase.removeChannel(channel); };
  }, [enabled, employeeId]);
  return { employees, error, loading };
}
export function useTrackingClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return now;
}

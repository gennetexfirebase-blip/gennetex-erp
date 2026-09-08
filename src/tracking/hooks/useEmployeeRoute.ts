import { useEffect, useState } from 'react';
import { fetchEmployeeRoute, trackingClient } from '../services/realtimeLocationService';
import { LocationPoint } from '../utils/locationUtils';
export function useEmployeeRoute(id: string | undefined, day: string) {
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setPoints([]);
    if (!id) return;
    const supabase = trackingClient();
    let active = true;
    const refresh = async () => {
      try {
        const rows = await fetchEmployeeRoute(id, day);
        if (active) { setPoints(old => Array.from(new Map([...old, ...rows].map(p => [p.timestamp, p])).values()).sort((a,b) => a.timestamp-b.timestamp)); setError(null); }
      } catch (e: any) { if (active) setError(e.message); }
    };
    const channel = supabase.channel(`tracking-route-${id}-${Math.random()}`).on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'location_history', filter: `employee_id=eq.${id}` }, (event: any) => {
        if (!active || event.new.day !== day) return;
        const p = { ...event.new, timestamp: Number(event.new.timestamp) };
        setPoints(old => old.some(x => x.timestamp === p.timestamp) ? old : [...old, p].sort((a,b) => a.timestamp-b.timestamp));
      }).subscribe((status: string) => { if (status === 'SUBSCRIBED') void refresh(); });
    void refresh();
    const timer = setInterval(refresh, 60000);
    return () => { active = false; clearInterval(timer); void supabase.removeChannel(channel); };
  }, [id, day]);
  return { points, error };
}

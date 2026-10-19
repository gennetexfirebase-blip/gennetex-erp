import { supabase } from './supabase';

/**
 * Машин, аялал, бензин — хуучин панелийн `fuelStatsByVehicle`-тай ижил тооцоо
 * (admin-web-v1/index.html). Апп ижил хүснэгтүүдийг (vehicles, trips) бичдэг.
 */

export type Vehicle = {
  id: string;
  code: string | null;
  plate_number: string;
  liters_per_100km: number | null;
  tank_capacity_liters: number | null;
  driver_name: string | null;
  fuel_level_percent: number | null;
  created_at?: string;
};
export type Trip = {
  id: string;
  vehicle_id: string | null;
  plate_number: string | null;
  driver_name: string | null;
  started_at: string | null;
  status: string | null;
  liters: number | null;
  cost: number | null;
  distance_km: number | null;
};
export type FuelRow = {
  vehicle: Vehicle | null;
  plate: string;
  driver: string;
  tank: number;
  active: boolean;
  liters: number;
  cost: number;
  totalKm: number;
  trips: number;
  periodLiters: number;
  currentLevel: number;
  remainingLiters: number;
  color: string;
};

export const DEFAULT_TANK_L = 60;
export const tankOf = (v?: Vehicle | null) => Number(v?.tank_capacity_liters) || DEFAULT_TANK_L;
export const levelColor = (p: number) => (p <= 15 ? 'var(--danger)' : p <= 35 ? 'var(--warning)' : 'var(--success)');

export async function fetchFleet(days = 30) {
  const since = new Date(Date.now() - Math.max(days, 7) * 86400000).toISOString();
  const [v, t] = await Promise.all([
    supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
    supabase.from('trips').select('id, vehicle_id, plate_number, driver_name, started_at, status, liters, cost, distance_km').or(`started_at.gte.${since},status.eq.active`).order('started_at', { ascending: false }).limit(5000),
  ]);
  if (v.error) throw v.error;
  if (t.error) throw t.error;
  return { vehicles: (v.data || []) as Vehicle[], trips: (t.data || []) as Trip[] };
}

export function fuelStats(vehicles: Vehicle[], trips: Trip[], days = 30): FuelRow[] {
  const cutoff = Date.now() - days * 86400000;
  type Acc = { vehicle: Vehicle | null; plate: string; driver: string; tank: number; base: number; liters: number; cost: number; km: number; trips: number; active: boolean; activeLiters: number; activeKm: number };
  const map = new Map<string, Acc>();
  const mk = (v: Vehicle | null, plate: string, driver?: string | null): Acc => ({
    vehicle: v, plate, driver: driver || v?.driver_name || '—', tank: tankOf(v), base: Number(v?.fuel_level_percent ?? 0),
    liters: 0, cost: 0, km: 0, trips: 0, active: false, activeLiters: 0, activeKm: 0,
  });
  vehicles.forEach((v) => map.set(v.id || v.plate_number, mk(v, v.plate_number)));
  trips.forEach((t) => {
    const veh = vehicles.find((v) => v.id === t.vehicle_id) || vehicles.find((v) => v.plate_number === t.plate_number) || null;
    const key = veh?.id || t.plate_number || '—';
    if (!map.has(key)) map.set(key, mk(veh, t.plate_number || '—', t.driver_name));
    const r = map.get(key)!;
    if (t.status === 'active') {
      r.active = true;
      r.activeLiters = Number(t.liters || 0);
      r.activeKm = Number(t.distance_km || 0);
      if (t.driver_name) r.driver = t.driver_name;
      return;
    }
    if (!t.started_at || new Date(t.started_at).getTime() < cutoff) return;
    r.liters += Number(t.liters || 0);
    r.cost += Number(t.cost || 0);
    r.km += Number(t.distance_km || 0);
    r.trips += 1;
    if (t.driver_name) r.driver = t.driver_name;
  });
  return [...map.values()]
    .map((r) => {
      const drain = r.active && r.tank > 0 ? (r.activeLiters / r.tank) * 100 : 0;
      const currentLevel = Math.max(0, Math.min(100, Math.round((r.base - drain) * 10) / 10));
      return {
        vehicle: r.vehicle, plate: r.plate, driver: r.driver, tank: r.tank, active: r.active, liters: r.liters, cost: r.cost, trips: r.trips,
        totalKm: Math.round((r.km + (r.active ? r.activeKm : 0)) * 100) / 100,
        periodLiters: r.active ? r.activeLiters : r.liters,
        currentLevel,
        remainingLiters: Math.max(0, Math.round((currentLevel / 100) * r.tank * 10) / 10),
        color: levelColor(currentLevel),
      };
    })
    .sort((a, b) => (a.active !== b.active ? (a.active ? -1 : 1) : b.totalKm - a.totalKm));
}

/** Сүүлийн 7 хоногийн өдөр бүрийн литр (хуучинтай ижил). */
export function litersLast7(trips: Trip[]) {
  const out = Array(7).fill(0) as number[];
  const now = Date.now();
  trips.forEach((t) => {
    if (!t.started_at) return;
    const diff = Math.floor((now - new Date(t.started_at).getTime()) / 86400000);
    if (diff >= 0 && diff < 7) out[6 - diff] += Number(t.liters || 0);
  });
  return out.map((v) => Math.round(v * 10) / 10);
}

export async function refuelByAmount(vehicleId: string, amount: number, refueledOn: string, pricePerLiter: number | null, note: string | null = null) {
  const { data, error } = await supabase.rpc('refuel_vehicle_by_amount', {
    p_vehicle_id: vehicleId, p_amount_mnt: amount, p_note: note, p_price_per_liter: pricePerLiter, p_refueled_on: refueledOn,
  });
  if (error) throw new Error((error as any).hint || error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return Number(row?.liters || 0);
}

/* ── Улсын дугаар (хуучин formatPlateInput) ── */
const MN_CYR = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯӨҮ';
const MN_LATIN: Record<string, string> = { A: 'А', B: 'В', C: 'С', D: 'Д', E: 'Е', F: 'Ф', G: 'Г', H: 'Х', I: 'И', J: 'Ж', K: 'К', L: 'Л', M: 'М', N: 'Н', O: 'О', P: 'П', Q: 'К', R: 'Р', S: 'С', T: 'Т', U: 'У', V: 'В', W: 'В', X: 'Х', Y: 'Ы', Z: 'З' };
const toCyr = (ch: string) => {
  const u = ch.toUpperCase();
  return MN_CYR.includes(u) ? u : MN_LATIN[u] || u;
};
export function formatPlate(v: string) {
  let digits = '';
  let letters = '';
  for (const ch of String(v || '').toUpperCase()) {
    if (/\d/.test(ch) && digits.length < 4 && !letters) digits += ch;
    else if (/[A-ZА-ЯӨҮЁ]/.test(ch) && digits.length && letters.length < 3) letters += toCyr(ch);
  }
  return letters ? `${digits} ${letters}` : digits;
}

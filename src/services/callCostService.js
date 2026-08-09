/**
 * Per-call material + fuel cost → margin / KPI.
 */
import { supabase } from '../lib/supabase';
import { estimateMaterialCost } from '../lib/materialSuggest';
import { isFlagOn } from '../lib/featureFlags';

export function computeCallCost(call, { catalogItems = [], fuelPricePerLiter = 2600, litersPer100km = 12 } = {}) {
  const meta = call?.close_meta || {};
  const materials = meta.materials || meta.used_materials || [];
  const mat = estimateMaterialCost(
    materials.map((m) => ({
      id: m.id || m.item_id,
      qty: m.qty || m.quantity,
      price: m.price,
      name: m.name || m.item_name,
    })),
    catalogItems
  );

  // Distance from workflow / close meta
  const km =
    Number(meta.distance_km) ||
    Number(meta.workflow?.distance_km) ||
    Number(call?.distance_km) ||
    0;
  const fuelLiters = (km / 100) * litersPer100km;
  const fuelCost = fuelLiters * fuelPricePerLiter;

  const laborHours =
    Number(meta.labor_hours) ||
    (call?.created_at && call?.updated_at
      ? Math.max(0, (new Date(call.updated_at) - new Date(call.created_at)) / 3600000)
      : 0);

  return {
    callId: call?.id,
    customer: call?.customer,
    materialCost: mat.total,
    materialLines: mat.lines,
    km,
    fuelLiters: Math.round(fuelLiters * 100) / 100,
    fuelCost: Math.round(fuelCost),
    laborHours: Math.round(laborHours * 100) / 100,
    totalCost: Math.round(mat.total + fuelCost),
  };
}

export async function fetchClosedCallsWithCost({ from, to, engineerId } = {}) {
  if (!supabase || !isFlagOn('callCost')) return [];
  let q = supabase
    .from('service_calls')
    .select('*')
    .eq('status', 'Дууссан')
    .order('updated_at', { ascending: false })
    .limit(500);
  if (engineerId) q = q.eq('engineer_id', engineerId);
  if (from) q = q.gte('updated_at', from);
  if (to) q = q.lte('updated_at', to);
  const { data, error } = await q;
  if (error) throw error;

  let catalog = [];
  try {
    const { data: inv } = await supabase.from('inventory').select('id, name, price, unit, category');
    catalog = inv || [];
  } catch {}

  return (data || []).map((row) => {
    const call = {
      id: row.id,
      customer: row.customer,
      close_meta: row.close_meta,
      created_at: row.created_at,
      updated_at: row.updated_at,
      engineer: row.engineer_name,
      engineer_id: row.engineer_id,
      type: row.call_type,
    };
    return { ...computeCallCost(call, { catalogItems: catalog }), engineer: call.engineer, type: call.type };
  });
}

export function aggregateCostReport(rows = []) {
  const totalMaterial = rows.reduce((s, r) => s + (r.materialCost || 0), 0);
  const totalFuel = rows.reduce((s, r) => s + (r.fuelCost || 0), 0);
  const totalKm = rows.reduce((s, r) => s + (r.km || 0), 0);
  return {
    count: rows.length,
    totalMaterial: Math.round(totalMaterial),
    totalFuel: Math.round(totalFuel),
    totalCost: Math.round(totalMaterial + totalFuel),
    totalKm: Math.round(totalKm * 10) / 10,
    avgCost: rows.length ? Math.round((totalMaterial + totalFuel) / rows.length) : 0,
  };
}

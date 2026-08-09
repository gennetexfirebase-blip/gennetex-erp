import { supabase } from '../lib/supabase';
import { DEFAULT_FUEL_SETTINGS } from '../data/mockData';

const TABLE = 'fuel_settings';

export function mapFuelSettings(row) {
  if (!row) return { ...DEFAULT_FUEL_SETTINGS };
  return {
    litersPer100km: Number(row.liters_per_100km) || DEFAULT_FUEL_SETTINGS.litersPer100km,
    pricePerLiter: Number(row.price_per_liter) || DEFAULT_FUEL_SETTINGS.pricePerLiter,
    idleLitersPerHour: Number(row.idle_liters_per_hour) || DEFAULT_FUEL_SETTINGS.idleLitersPerHour,
  };
}

export async function fetchFuelSettings() {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  return mapFuelSettings(data);
}

export async function saveFuelSettings({ litersPer100km, pricePerLiter, idleLitersPerHour }) {
  const row = {
    id: 1,
    liters_per_100km: Number(litersPer100km) || 12,
    price_per_liter: Number(pricePerLiter) || 2600,
    idle_liters_per_hour: Number(idleLitersPerHour) || 1.2,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from(TABLE).upsert(row).select().single();
  if (error) throw error;
  return mapFuelSettings(data);
}

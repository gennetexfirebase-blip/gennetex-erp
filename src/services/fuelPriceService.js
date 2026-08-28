import { supabase } from '../lib/supabase';

/**
 * Түлшний үнэ — 1 литрийн үнийг ОГНООТОЙ түүх болгож хадгална.
 *
 * ⚠️ ЯАГААД ТҮҮХ ВЭ: үнэ байнга өөрчлөгддөг. Тохиргоонд ганц тоо
 *    барьвал үнэ солиход ӨМНӨХ бүх цэнэглэлтийн литр буруу болно.
 *    Цэнэглэлт бүр өөрийн үеийн үнийг мөрдөө хадгалдаг тул
 *    "тэр өдөр хэдээр авсан бэ" гэдэгт хариулах боломжтой.
 */

export const FUEL_TYPES = [
  { key: 'ai80', label: 'А-80' },
  { key: 'ai92', label: 'АИ-92' },
  { key: 'ai95', label: 'АИ-95' },
  { key: 'diesel', label: 'Дизель' },
];

export function fuelTypeLabel(key) {
  return FUEL_TYPES.find((t) => t.key === key)?.label || key || '—';
}

/** Бүх төрлийн ОДООГИЙН үнэ. */
export async function fetchCurrentPrices() {
  const { data, error } = await supabase.rpc('current_fuel_prices');
  if (error) throw error;
  return data || [];
}

/** Нэг төрлийн одоогийн үнэ (₮/литр). Байхгүй бол `null`. */
export async function fetchPrice(fuelType = 'ai92') {
  const { data, error } = await supabase.rpc('current_fuel_price', { p_fuel_type: fuelType });
  if (error) throw error;
  return data == null ? null : Number(data);
}

/** Үнийн түүх — өөрчлөлтийг хянахад. */
export async function fetchPriceHistory(fuelType, limit = 60) {
  let q = supabase
    .from('fuel_prices')
    .select('*')
    .order('effective_date', { ascending: false })
    .limit(limit);
  if (fuelType) q = q.eq('fuel_type', fuelType);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/**
 * Үнэ тохируулах (зөвхөн админ — сервер тал шалгана).
 *
 * Нэг өдөр нэг төрөлд нэг үнэ: дахин оруулбал шинэчилнэ.
 */
export async function setPrice({ fuelType, price, date, note }) {
  const { data, error } = await supabase.rpc('set_fuel_price', {
    p_fuel_type: fuelType,
    p_price: Number(price),
    p_date: date || null,
    p_source: 'manual',
    p_note: note || null,
  });
  if (error) throw error;
  return data;
}

/**
 * Мөнгөн дүнгээр цэнэглэх — литрийг сервер тооцно.
 *
 * ⚠️ Тооцоог клиент талд хийхгүй: хэрэглэгч бүрийн утсанд өөр өөр
 *    (хоцрогдсон) үнэ байж болно. Сервер тооцсноор бүх бүртгэл
 *    нэг эх сурвалжтай болно.
 */
export async function refuelByAmount({ vehicleId, amountMnt, note }) {
  const { data, error } = await supabase.rpc('refuel_vehicle_by_amount', {
    p_vehicle_id: vehicleId,
    p_amount_mnt: Number(amountMnt),
    p_note: note || null,
  });
  if (error) throw error;
  // `returns table` тул массив ирнэ.
  const row = Array.isArray(data) ? data[0] : data;
  return {
    liters: Number(row?.liters) || 0,
    pricePerLiter: Number(row?.price_per_liter) || 0,
    fuelLevelPercent: Number(row?.fuel_level_percent) || 0,
  };
}

/**
 * Нийтийн эх сурвалжаас үнэ татахыг оролдоно.
 *
 * ⚠️ Монголын түлш нийлүүлэгчид албан ёсны API гаргадаггүй бөгөөд
 *    нүүр хуудсандаа өдөр тутмын үнэ тавьдаггүй (2026-08-28-нд
 *    petrovis.mn, shunkhlai.mn дээр шалгав). Тиймээс энэ нь
 *    БАТАЛГААГҮЙ туслах зам — амжилтгүй болвол админ гараар оруулна.
 */
export async function syncFromSource() {
  const { data, error } = await supabase.functions.invoke('fuel-price-sync', { body: {} });
  if (error) throw error;
  return data;
}

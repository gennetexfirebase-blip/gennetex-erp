import { supabase } from '../lib/supabase';

export const DEFAULT_COMPANY_SETTINGS = Object.freeze({
  singleton: true,
  work_start_time: '09:00:00',
  late_grace_minutes: 0,
  default_min_stock: 5,
  reminder_days: [30, 7, 1],
  low_stock_alert_enabled: true,
  training_alert_enabled: true,
  vehicle_alert_enabled: true,
});

export function normalizeCompanySettings(value = {}) {
  return {
    ...DEFAULT_COMPANY_SETTINGS,
    ...value,
    work_start_time: String(value.work_start_time || DEFAULT_COMPANY_SETTINGS.work_start_time),
    late_grace_minutes: Number(value.late_grace_minutes ?? 0),
    default_min_stock: Number(value.default_min_stock ?? 5),
    reminder_days: Array.isArray(value.reminder_days)
      ? value.reminder_days.map(Number).filter(Number.isFinite)
      : DEFAULT_COMPANY_SETTINGS.reminder_days,
  };
}

export function workStartLabel(settings) {
  return String(settings?.work_start_time || '09:00').slice(0, 5);
}

export function lateFromLabel(settings) {
  const [hour, minute] = workStartLabel(settings).split(':').map(Number);
  const total = hour * 60 + minute + Number(settings?.late_grace_minutes || 0) + 1;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export async function fetchCompanySettings() {
  if (!supabase) return DEFAULT_COMPANY_SETTINGS;
  const { data, error } = await supabase.rpc('get_company_settings');
  if (error) throw error;
  return normalizeCompanySettings(data || {});
}

export async function updateCompanySettings(settings) {
  const value = normalizeCompanySettings(settings);
  const { data, error } = await supabase.rpc('update_company_settings', {
    p_work_start_time: workStartLabel(value),
    p_late_grace_minutes: value.late_grace_minutes,
    p_default_min_stock: value.default_min_stock,
    p_reminder_days: value.reminder_days,
    p_low_stock_alert_enabled: value.low_stock_alert_enabled,
    p_training_alert_enabled: value.training_alert_enabled,
    p_vehicle_alert_enabled: value.vehicle_alert_enabled,
  });
  if (error) throw error;
  return normalizeCompanySettings(data || value);
}

export async function fetchOperationalAlerts() {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_operational_alerts');
  if (error) throw error;
  return data || [];
}

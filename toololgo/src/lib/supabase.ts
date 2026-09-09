import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase холболт — ERP-тэй ЯГ ИЖИЛ project.
 *
 * Ингэснээр ажилтан ERP-д ордог Google хаягаараа энд шууд нэвтэрнэ,
 * тусдаа бүртгэл үүсгэх шаардлагагүй.
 *
 * ⚠️ Зөвхөн ANON key. Бүх эрхийн шалгалт RLS дээр хийгдэнэ.
 */
const url = import.meta.env.VITE_SUPABASE_URL || '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);

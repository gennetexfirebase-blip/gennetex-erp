import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase холболт.
 *
 * Утгуудыг build үед `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`-ээс авна.
 * Хуучин vanilla admin-web нь `window.__SUPABASE__`-д тавьдаг байсан тул
 * түүнийг мөн уншиж, аль нэг нь байвал ажиллана (нэг домэйн дээр зэрэгцэн
 * ажиллах шилжилтийн үед хэрэгтэй).
 *
 * ⚠️ Зөвхөн ANON key. Service-role key браузерт ОГТ ирэхгүй — бүх эрхийн
 * шалгалт RLS болон `security definer` функцууд дээр хийгдэнэ.
 */
declare global {
  interface Window {
    __SUPABASE__?: { url?: string; anonKey?: string };
  }
}

const url =
  import.meta.env.VITE_SUPABASE_URL || window.__SUPABASE__?.url || '';
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || window.__SUPABASE__?.anonKey || '';

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder',
  { auth: { persistSession: true, autoRefreshToken: true } }
);

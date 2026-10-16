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
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // adiyasuren.gennetex.com/system/admin нь өөрийн сесс хадгалдаггүй клиенттэй —
      // Google-ээс буцсан токеныг ердийн клиент булаан авахгүй.
      detectSessionInUrl: !(window.location.hostname === 'adiyasuren.gennetex.com' && window.location.pathname.startsWith('/system/admin')),
    },
  }
);

/**
 * Сесс хадгалдаггүй клиент — хуудас ачаалагдах бүрт дахин нэвтрэх шаардлагатай
 * хэсэгт (adiyasuren.gennetex.com/system/admin). Google-ээс буцахад хаяг дахь
 * токеныг зөвхөн санах ойд уншина; refresh хийхэд сесс алга болно.
 */
export const createEphemeralClient = (): SupabaseClient =>
  createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder', {
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'gx-ephemeral' },
  });

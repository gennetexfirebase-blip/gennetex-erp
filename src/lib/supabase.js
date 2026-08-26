import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
// Нэвтрэлтийн token-ыг AsyncStorage-д ЭНГИЙН ТЕКСТЭЭР хадгалдаг байсныг
// Keychain / Android Keystore руу шилжүүлэв. Шалтгаан ба шилжилтийн
// логикийг `secureSessionStorage.js`-ийн толгойд бичсэн.
import { secureSessionStorage } from './secureSessionStorage';

// Тохиргоог .env файлаас уншина (EXPO_PUBLIC_ угтвартай хувьсагчид client талд ажиллана).
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Хэрэв тохиргоо байхгүй бол апп локал (AsyncStorage) горимоор ажиллана.
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: secureSessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null;

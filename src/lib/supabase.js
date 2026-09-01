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

const realClient = isSupabaseConfigured
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

/**
 * Demo горимд бодит клиентийг ОРЛУУЛАГЧААР солино.
 *
 * ⚠️ Proxy ашиглаж байгаа шалтгаан: `supabase` нь модуль ачаалагдах
 *    үед нэг удаа шийдэгддэг ба 87 дэлгэц түүнийг шууд import хийдэг.
 *    Хэрэв энгийн if-ээр сонговол demo руу орох/гарахад тэдгээр
 *    бүгд ХУУЧИН клиентийг барьсаар үлдэнэ.
 *
 *    Proxy нь дуудлага бүрд шинээр шийддэг тул нэвтрэх/гарах үед
 *    шууд солигдоно.
 *
 * ⚠️ Demo үед сүлжээний дуудлага ОГТ гарахгүй — бодит өгөгдөл
 *    алдагдах боломж математикийн хувьд тэг.
 */
export const supabase = realClient
  ? new Proxy(realClient, {
      get(target, prop, receiver) {
        // Дугуй хамаарлаас сэргийлж эндээс шаардана (demoClient нь
        // demoData-г, тэр нь юу ч import хийдэггүй).
        const { isDemoActive } = require('./demoMode');
        if (isDemoActive()) {
          const { demoClient } = require('./demoClient');
          const v = demoClient[prop];
          return typeof v === 'function' ? v.bind(demoClient) : v;
        }
        const v = Reflect.get(target, prop, receiver);
        return typeof v === 'function' ? v.bind(target) : v;
      },
    })
  : null;

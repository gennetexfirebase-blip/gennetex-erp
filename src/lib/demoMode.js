/**
 * Demo горим — дэлгүүрийн шинжээчид зориулсан sandbox.
 *
 * ⚠️ ЭНЭ БОЛ ХУУРАЛТ БИШ. Апп нь эдгээр функцийг бодитоор агуулдаг;
 *    зөвхөн ӨГӨГДӨЛ нь жишээ. Дэлгүүрт өгөх тэмдэглэлд "sandbox demo
 *    account with sample data" гэж ИЛ бичнэ. Байгууллагын аппуудын
 *    жишиг практик — учир нь эсрэг тохиолдолд шинжээч бодит
 *    ажилтнуудын цалин, хувийн чат, байршлыг үзнэ.
 *
 * Нэвтрэх:  Gennetex / Gennetex@2026
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resetDemoOverlay } from './demoClient';

const KEY = '@gennetex_demo_session_v1';

export const DEMO_USERNAME = 'Gennetex';
export const DEMO_PASSWORD = 'Gennetex@2026';

/**
 * Санах ой дахь тугийг ЗААВАЛ синхроноор уншиж чаддаг байх ёстой.
 *
 * `supabase` экспорт нь модуль ачаалагдах үед шийдэгддэг тул
 * AsyncStorage (async) хүлээх боломжгүй. Тиймээс апп эхлэхэд
 * `restoreDemoSession()` дуудаж тугийг сэргээнэ.
 */
let active = false;

export function isDemoActive() {
  return active;
}

/**
 * Оруулсан нэр/нууц үг demo эсэх.
 *
 * Нэрийг том/жижиг үсгээс хамааралгүй харьцуулна — шинжээч
 * "gennetex" гэж жижгээр бичих магадлалтай. Нууц үг нь ХАТУУ.
 */
export function isDemoCredentials(identifier, password) {
  return (
    String(identifier || '').trim().toLowerCase() === DEMO_USERNAME.toLowerCase() &&
    String(password || '') === DEMO_PASSWORD
  );
}

export async function enableDemo() {
  active = true;
  resetDemoOverlay();
  try { await AsyncStorage.setItem(KEY, '1'); } catch (e) { /* санах ойд ажиллана */ }
}

export async function disableDemo() {
  active = false;
  resetDemoOverlay();
  try { await AsyncStorage.removeItem(KEY); } catch (e) { /* хамаагүй */ }
}

/** Апп эхлэхэд дуудна — өмнөх demo сессийг сэргээнэ. */
export async function restoreDemoSession() {
  try {
    active = (await AsyncStorage.getItem(KEY)) === '1';
  } catch (e) {
    active = false;
  }
  return active;
}

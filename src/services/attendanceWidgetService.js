import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import { supabase } from '../lib/supabase';
import { isDemoActive } from '../lib/demoMode';

/**
 * Ирцийн WIDGET (iPhone / Android нүүр дэлгэц) — апп нээлгүйгээр «Ирлээ /
 * Явлаа» бүртгэнэ.
 *
 * Апп нэвтэрсний дараа серверээс ЗӨВХӨН ирц бүртгэх эрхтэй token авч
 * (`issue_attendance_widget_token`) widget-тэй хуваалцана. Widget нь уг
 * token-оор `widget-attendance` edge function-ийг шууд дууддаг тул апп
 * ажиллаагүй байсан ч ажиллана. Бүсээс гадуур бол сервер бүртгэхгүй —
 * widget аппыг нээлгэнэ.
 *
 * Хуваалцах сан:
 *   - iOS:     App Group `group.com.gennetex.erp` (UserDefaults)
 *   - Android: `modules/attendance-widget` (SharedPreferences + AppWidget)
 */

const APP_GROUP = 'group.com.gennetex.erp';
const KEY_CONFIG = 'attendanceWidgetConfig';
const KEY_STATE = 'attendanceWidgetState';
const TOKEN_KEY = 'attendance_widget_token_v1';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

let cachedStore;
function nativeStore() {
  if (cachedStore !== undefined) return cachedStore;
  cachedStore = null;
  try {
    if (Platform.OS === 'ios') {
      const { ExtensionStorage } = require('@bacons/apple-targets');
      const storage = new ExtensionStorage(APP_GROUP);
      cachedStore = {
        set: (key, value) => storage.set(key, value),
        remove: (key) => storage.remove(key),
        reload: () => ExtensionStorage.reloadWidget(),
      };
    } else if (Platform.OS === 'android') {
      const mod = require('../../modules/attendance-widget');
      if (mod.isAvailable()) {
        cachedStore = {
          set: (key, value) => mod.setItem(key, value),
          remove: (key) => mod.removeItem(key),
          reload: () => mod.reloadWidgets(),
        };
      }
    }
  } catch (e) {
    // Native хэсэггүй build (Expo Go, хуучин хувилбар) — widget алга.
    cachedStore = null;
  }
  return cachedStore;
}

const tokenKey = (userId) => `${TOKEN_KEY}_${String(userId).replace(/[^a-zA-Z0-9]/g, '')}`;

async function callWidget(token, action = 'status') {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/widget-attendance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, action }),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ...json };
}

async function issueToken(userId) {
  const device = `${Device.modelName || 'device'} · ${Platform.OS}`;
  const { data, error } = await supabase.rpc('issue_attendance_widget_token', { p_device: device });
  if (error) throw error;
  await SecureStore.setItemAsync(tokenKey(userId), String(data));
  return String(data);
}

/**
 * Нэвтэрсэн хэрэглэгчийн widget-ийг бэлдэнэ: token, сервер хаяг, өнөөдрийн
 * төлөв. Апп нээгдэх бүрд дуудахад хөнгөн (token нэг л удаа олгогдоно).
 */
export async function syncAttendanceWidget(userId) {
  const store = nativeStore();
  if (!store || !userId || !SUPABASE_URL || isDemoActive()) return;

  let token = await SecureStore.getItemAsync(tokenKey(userId));
  if (!token) token = await issueToken(userId);

  let result = await callWidget(token);
  if (result.status === 401) {
    // Token хүчингүй болсон (өөр утсанд дахин олгосон гэх мэт) — шинээр авна.
    token = await issueToken(userId);
    result = await callWidget(token);
  }

  store.set(KEY_CONFIG, JSON.stringify({ token, url: SUPABASE_URL }));
  if (result.ok && result.state) store.set(KEY_STATE, JSON.stringify(result.state));
  store.reload();
}

/** Апп дотроос ирц бүртгэсний дараа widget-ийг шинэчилнэ. */
export async function refreshAttendanceWidget() {
  const store = nativeStore();
  if (!store || !SUPABASE_URL || isDemoActive()) return;
  const { data } = await supabase.auth.getSession();
  const userId = data?.session?.user?.id;
  if (!userId) return;
  const token = await SecureStore.getItemAsync(tokenKey(userId));
  if (!token) return;
  const result = await callWidget(token);
  if (result.ok && result.state) {
    store.set(KEY_STATE, JSON.stringify(result.state));
    store.reload();
  }
}

/** Гарах үед: серверт token-ыг хүчингүй болгож, widget-ийг цэвэрлэнэ. */
export async function clearAttendanceWidget() {
  const store = nativeStore();
  if (!store) return;
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data?.session?.user?.id;
    if (userId) {
      const device = `${Device.modelName || 'device'} · ${Platform.OS}`;
      await supabase.rpc('revoke_attendance_widget_tokens', { p_device: device });
      await SecureStore.deleteItemAsync(tokenKey(userId));
    }
  } catch (e) {
    /* сүлжээгүй ч локал өгөгдлийг заавал цэвэрлэнэ */
  }
  store.remove(KEY_CONFIG);
  store.remove(KEY_STATE);
  store.reload();
}

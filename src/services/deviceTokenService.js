import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { APP_VERSION_LABEL } from '../version';
import { isExpoGo } from '../lib/runtimeEnv';

/**
 * Дуудлагын төхөөрөмжийн token бүртгэл.
 *
 * ЯАГААД `push_tokens`-ООС ТУСАД НЬ:
 *   Одоогийн `push_tokens` нь (user_id, token) төвтэй бөгөөд нэг мөрөнд нэг
 *   token хадгална. Гэтэл iOS дээр CallKit-ийг сэрээхэд PushKit-ийн VoIP
 *   token хэрэгтэй бөгөөд тэр нь энгийн мэдэгдлийн token-ООС ӨӨР. Хоёуланг
 *   нэг төхөөрөмжийн мөрөнд хадгалахгүй бол аль нь аль төхөөрөмжийнх болохыг
 *   тодорхойлох боломжгүй.
 *
 *   `push_tokens` хэвээр ажиллана — энэ нь зөвхөн дуудлагад зориулагдсан.
 *
 * АЮУЛГҮЙ БАЙДАЛ:
 *   RLS нь хэрэглэгчийг ЗӨВХӨН өөрийн мөрөө уншиж/бичихийг зөвшөөрнө.
 *   Өөр хүний token уншиж push илгээх боломжгүй — тэр нь Edge Function дээр
 *   service role-оор хийгдэнэ.
 */

const DEVICE_ID_KEY = '@call_device_id';

/** Тогтвортой төхөөрөмжийн ID. Апп дахин суулгахад ANDROID_ID хэвээр үлдэнэ. */
export async function getDeviceId() {
  try {
    if (Platform.OS === 'android' && Application.getAndroidId) {
      const id = Application.getAndroidId();
      if (id) return `and_${id}`;
    }
    if (Platform.OS === 'ios' && Application.getIosIdForVendorAsync) {
      const id = await Application.getIosIdForVendorAsync();
      if (id) return `ios_${id}`;
    }
  } catch (e) {}
  // Native ID авах боломжгүй бол өөрсдөө үүсгээд хадгална
  let stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!stored) {
    stored = `gen_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, stored);
  }
  return stored;
}

function deviceName() {
  return [Device.brand, Device.modelName].filter(Boolean).join(' ') || Device.deviceName || null;
}

/**
 * Энэ төхөөрөмжийг дуудлага хүлээн авахаар бүртгэнэ.
 *
 * @param {string} userId
 * @param {{ fcmToken?: string, voipToken?: string }} tokens
 */
export async function registerDevice(userId, { fcmToken, voipToken } = {}) {
  if (!supabase || !userId) return null;
  if (!fcmToken && !voipToken) return null;

  const deviceId = await getDeviceId();

  // Байгаа мөрийг олоод шинэчилнэ. `upsert` ашиглаагүй шалтгаан: fcm болон
  // voip token тус тусдаа өөр цагт ирдэг тул нэгийг нь бичихдээ нөгөөг
  // null-аар дарж болохгүй.
  const { data: existing } = await supabase
    .from('device_tokens')
    .select('id, fcm_token, voip_token')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle();

  const payload = {
    user_id: userId,
    platform: Platform.OS,
    device_id: deviceId,
    device_name: deviceName(),
    app_version: APP_VERSION_LABEL,
    is_active: true,
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  };
  if (fcmToken) payload.fcm_token = fcmToken;
  if (voipToken) payload.voip_token = voipToken;

  if (existing?.id) {
    const { data, error } = await supabase
      .from('device_tokens')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('device_tokens')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Гарах үед энэ төхөөрөмжийг идэвхгүй болгоно.
 *
 * Мөрийг УСТГАХГҮЙ — дараа дахин нэвтрэхэд ижил төхөөрөмж гэдгийг таньж,
 * түүхийг нь хадгална.
 */
export async function deactivateDevice(userId) {
  if (!supabase || !userId) return;
  try {
    const deviceId = await getDeviceId();
    await supabase
      .from('device_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('device_id', deviceId);
  } catch (e) {
    // Гарах үйлдлийг зогсоохгүй
  }
}

/** Апп нээгдэх бүрд "амьд" гэдгээ мэдэгдэнэ — хуучирсан token цэвэрлэхэд. */
export async function touchDevice(userId) {
  if (!supabase || !userId) return;
  try {
    const deviceId = await getDeviceId();
    await supabase
      .from('device_tokens')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('device_id', deviceId);
  } catch (e) {}
}

/** Миний бүртгэлтэй төхөөрөмжүүд — Профайл дээр харуулах, салгах боломжтой. */
export async function fetchMyDevices(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('device_tokens')
    .select('*')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Энэ орчинд дуудлага хүлээн авах боломжтой эсэх.
 *
 * Expo Go дээр алсын push байхгүй тул дуудлага ирэхгүй — хэрэглэгчид
 * үүнийг тодорхой хэлэх ёстой, чимээгүй ажиллахгүй байснаас дээр.
 */
export const canReceiveCalls = !isExpoGo && Platform.OS !== 'web';

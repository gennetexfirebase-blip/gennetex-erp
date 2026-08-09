import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Network from 'expo-network';
import { supabase } from '../lib/supabase';
import * as notifyApi from './notificationService';

// expo-application нь заримдаа build дотор байхгүй байж болзошгүй тул хамгаалалттай ачаална
let Application = null;
try {
  Application = require('expo-application');
} catch (e) {
  Application = null;
}

const TABLE = 'device_approvals';
const DEVICE_ID_KEY = '@gennetex_device_id_v1';

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Тогтвортой төхөөрөмжийн ID (ANDROID_ID / iOS idForVendor, эсвэл хадгалсан UUID) */
async function getStableDeviceId() {
  try {
    if (Application) {
      if (Platform.OS === 'android' && Application.getAndroidId) {
        const id = Application.getAndroidId();
        if (id) return `and_${id}`;
      }
      if (Platform.OS === 'ios' && Application.getIosIdForVendorAsync) {
        const id = await Application.getIosIdForVendorAsync();
        if (id) return `ios_${id}`;
      }
    }
  } catch (e) {}
  let stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!stored) {
    stored = `gen_${uuid()}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, stored);
  }
  return stored;
}

async function getPublicIp() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const json = await res.json();
    return json?.ip || null;
  } catch (e) {
    return null;
  }
}

async function getLocalIp() {
  try {
    return await Network.getIpAddressAsync();
  } catch (e) {
    return null;
  }
}

/** Төхөөрөмжийн таних мэдээлэл цуглуулна.
 * Тэмдэглэл: орчин үеийн Android/iOS жинхэнэ MAC хаяг өгдөггүй (02:00:00:00:00:00). */
export async function getDeviceFingerprint() {
  const [deviceId, localIp, publicIp] = await Promise.all([
    getStableDeviceId(),
    getLocalIp(),
    getPublicIp(),
  ]);
  return {
    device_id: deviceId,
    device_model: Device.modelName || Device.deviceName || 'Тодорхойгүй',
    device_brand: Device.brand || Device.manufacturer || null,
    os: Device.osName || Platform.OS,
    os_version: Device.osVersion || String(Platform.Version || ''),
    local_ip: localIp,
    public_ip: publicIp,
    mac: '02:00:00:00:00:00', // OS хязгаарлалт — жинхэнэ MAC унших боломжгүй
  };
}

/**
 * Төхөөрөмж зөвшөөрөгдсөн эсэхийг шалгана.
 * Шинэ төхөөрөмж бол pending хүсэлт үүсгээд системийн админд мэдэгдэнэ.
 * Буцаах: { status: 'approved'|'pending'|'rejected', deviceId, row }
 */
export async function ensureDeviceApproval(user) {
  if (!user?.id) return { status: 'approved', bypass: true };
  const fp = await getDeviceFingerprint();
  try {
    const { data: existing, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', user.id)
      .eq('device_id', fp.device_id)
      .maybeSingle();

    if (error) {
      // Хүснэгт байхгүй / алдаа — хатуу блоклохгүй
      return { status: 'approved', deviceId: fp.device_id, error: true };
    }

    if (existing) {
      return { status: existing.status || 'pending', deviceId: fp.device_id, row: existing };
    }

    const insertRow = {
      user_id: user.id,
      user_name: user.name || null,
      status: 'pending',
      ...fp,
    };
    const { data: created, error: insErr } = await supabase
      .from(TABLE)
      .insert(insertRow)
      .select()
      .single();
    if (insErr) {
      return { status: 'approved', deviceId: fp.device_id, error: true };
    }
    try {
      await notifyApi.notifyDeviceRequestToSuperadmins({
        userName: user.name,
        deviceModel: `${fp.device_brand || ''} ${fp.device_model || ''}`.trim(),
        publicIp: fp.public_ip,
        localIp: fp.local_ip,
        mac: fp.mac,
        deviceId: fp.device_id,
      });
    } catch (e) {}
    return { status: 'pending', deviceId: fp.device_id, row: created };
  } catch (e) {
    return { status: 'approved', deviceId: fp.device_id, error: true };
  }
}

/** Тухайн хэрэглэгч+төхөөрөмжийн одоогийн төлөв (poll) */
export async function fetchMyDeviceStatus(userId, deviceId) {
  if (!userId || !deviceId) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle();
  if (error) return null;
  return data;
}

/** Realtime — өөрийн төхөөрөмжийн төлөв өөрчлөгдөхөд */
export function subscribeMyDevice(userId, deviceId, onChange) {
  const channel = supabase
    .channel(`device-approval-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new || payload.old;
        if (!deviceId || row?.device_id === deviceId) onChange?.(payload.new);
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---- Системийн админд зориулсан ----
export async function fetchAllDevices(limit = 300) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('requested_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function countPendingDevices() {
  const { count, error } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) return 0;
  return count || 0;
}

export async function decideDevice(id, status, { deciderId, deciderName, userId } = {}) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status,
      decided_at: new Date().toISOString(),
      decided_by: deciderId || null,
      decided_by_name: deciderName || null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  try {
    if (userId) {
      await notifyApi.notifyDeviceDecisionToUser(userId, { status });
    }
  } catch (e) {}
  return data;
}

export function subscribeDevices(onChange) {
  const channel = supabase
    .channel('device-approvals-admin')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => onChange?.())
    .subscribe();
  return () => supabase.removeChannel(channel);
}

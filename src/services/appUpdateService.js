/**
 * Force / soft app update — min supported version remote check.
 * Supabase `app_config` хүснэгт эсвэл env fallback.
 */
import { Platform, Linking } from 'react-native';
import { APP_VERSION, formatAppVersion } from '../version';
import { supabase } from '../lib/supabase';
import { isFlagOn } from '../lib/featureFlags';

function parseVersion(str) {
  const parts = String(str || '0.0.0')
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
}

export function compareVersions(a, b) {
  const A = typeof a === 'string' ? parseVersion(a) : a;
  const B = typeof b === 'string' ? parseVersion(b) : b;
  if (A.major !== B.major) return A.major - B.major;
  if (A.minor !== B.minor) return A.minor - B.minor;
  return A.patch - B.patch;
}

/**
 * @returns {Promise<null | { force: boolean, soft: boolean, minVersion: string, latestVersion: string, message: string, storeUrl: string }>}
 */
export async function checkAppUpdate() {
  if (!isFlagOn('forceUpdate')) return null;

  const current = formatAppVersion(APP_VERSION);
  let minVersion = process.env.EXPO_PUBLIC_MIN_APP_VERSION || '0.0.0';
  let latestVersion = process.env.EXPO_PUBLIC_LATEST_APP_VERSION || current;
  let message = 'Шинэ хувилбар гарлаа. Аппаа шинэчилнэ үү.';
  let storeUrl =
    process.env.EXPO_PUBLIC_STORE_URL ||
    (Platform.OS === 'ios'
      ? 'https://apps.apple.com'
      : 'https://play.google.com/store');
  let force = false;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', ['min_app_version', 'latest_app_version', 'update_message', 'store_url_android', 'store_url_ios', 'force_update']);
      if (!error && data?.length) {
        const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
        if (map.min_app_version) minVersion = map.min_app_version;
        if (map.latest_app_version) latestVersion = map.latest_app_version;
        if (map.update_message) message = map.update_message;
        if (Platform.OS === 'ios' && map.store_url_ios) storeUrl = map.store_url_ios;
        if (Platform.OS === 'android' && map.store_url_android) storeUrl = map.store_url_android;
        force = map.force_update === '1' || map.force_update === 'true';
      }
    } catch {
      // offline / table missing — env fallback
    }
  }

  const belowMin = compareVersions(current, minVersion) < 0;
  const belowLatest = compareVersions(current, latestVersion) < 0;
  if (!belowMin && !belowLatest) return null;

  return {
    force: belowMin || force,
    soft: !belowMin && belowLatest,
    minVersion,
    latestVersion,
    currentVersion: current,
    message,
    storeUrl,
  };
}

export async function openStoreUrl(url) {
  if (!url) return;
  try {
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
  } catch {}
}

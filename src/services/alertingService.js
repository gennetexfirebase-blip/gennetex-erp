import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { APP_VERSION_LABEL } from '../version';
import { supabase } from '../lib/supabase';

function safe(v, max = 1200) {
  const s = String(v ?? '');
  return s.length > max ? s.slice(0, max - 3) + '...' : s;
}

function buildContext(extra = {}) {
  const ctx = {
    appVersion: APP_VERSION_LABEL,
    platform: Platform.OS,
    when: new Date().toISOString(),
    ...extra,
    expo: {
      sdkVersion: Constants.expoConfig?.sdkVersion || null,
      projectId: Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null,
    },
  };
  return safe(JSON.stringify(ctx, null, 2), 1800);
}

/** GPS асаалт/унтраалтыг Telegram группд мэдэгдэх */
export async function notifyGpsStatus({ userName, userId, enabled, coord } = {}) {
  if (!supabase) return;
  try {
    const alertSecret = process.env.EXPO_PUBLIC_ALERT_SECRET || '';
    const headers = alertSecret ? { 'x-alert-secret': alertSecret } : undefined;
    const who = userName || userId || 'Ажилтан';
    const loc = coord
      ? `Сүүлийн байршил: ${Number(coord.latitude).toFixed(5)}, ${Number(coord.longitude).toFixed(5)}`
      : 'Сүүлийн байршил тодорхойгүй';
    const title = enabled ? '📍 GPS дахин асаалаа' : '⚠️ GPS унтраалаа';
    const message = `${who} байршлын GPS-ээ ${enabled ? 'дахин асаалаа' : 'унтраалаа'}.\n${loc}`;
    await supabase.functions.invoke('telegram-alert', {
      body: {
        title,
        message,
        user: who,
        appVersion: APP_VERSION_LABEL,
        platform: Platform.OS,
        when: new Date().toISOString(),
        alertSecret,
      },
      headers,
    });
  } catch (e) {
    // чимээгүй алгасна
  }
}

export async function reportSystemError(error, extra = {}) {
  if (!supabase) return;
  try {
    const title = safe(extra.title || 'App error', 120);
    const message = safe(error?.stack || error?.message || String(error), 3200);
    const context = buildContext(extra);
    const alertSecret = process.env.EXPO_PUBLIC_ALERT_SECRET || '';
    const headers = alertSecret ? { 'x-alert-secret': alertSecret } : undefined;
    const { error } = await supabase.functions.invoke('telegram-alert', {
      body: {
        title,
        message,
        context,
        user: extra.user || null,
        appVersion: APP_VERSION_LABEL,
        platform: Platform.OS,
        when: new Date().toISOString(),
        alertSecret,
      },
      headers,
    });
    if (error && __DEV__) {
      console.warn('[alerting] telegram-alert failed:', error.message || error);
    }
  } catch (e) {
    // avoid recursive crash loops
  }
}

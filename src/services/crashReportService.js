/**
 * Crash / error reporting — ErrorBoundary + global handlers-ийг нэмэлтээр бэхжүүлнэ.
 * Хуучин alertingService-ийг ашиглана (устгахгүй).
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reportSystemError } from './alertingService';
import { isFlagOn } from '../lib/featureFlags';
import { APP_VERSION_LABEL } from '../version';

const LOG_KEY = '@gennetex/crash_log_v1';
const MAX_LOCAL = 40;

let _installed = false;

async function appendLocal(entry) {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(entry);
    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(list.slice(0, MAX_LOCAL)));
  } catch {}
}

export async function getLocalCrashLog() {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function reportCrash(error, extra = {}) {
  if (!isFlagOn('crashReporting')) return;
  const entry = {
    at: new Date().toISOString(),
    message: error?.message || String(error),
    stack: error?.stack || null,
    platform: Platform.OS,
    version: APP_VERSION_LABEL,
    ...extra,
  };
  await appendLocal(entry);
  try {
    await reportSystemError(error, {
      title: extra.title || 'Crash / uncaught',
      context: extra.context || '',
      user: extra.user || null,
    });
  } catch {}
}

export function installGlobalCrashHandlers() {
  if (_installed || !isFlagOn('crashReporting')) return;
  _installed = true;

  const prev = global.ErrorUtils?.getGlobalHandler?.();
  if (global.ErrorUtils?.setGlobalHandler) {
    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
      reportCrash(error, { title: isFatal ? 'Fatal JS error' : 'JS error', isFatal: !!isFatal }).catch(
        () => {}
      );
      if (typeof prev === 'function') prev(error, isFatal);
    });
  }

  // Promise rejection (RN)
  if (typeof global !== 'undefined') {
    const tracking = require('promise/setimmediate/rejection-tracking');
    try {
      tracking?.enable?.({
        allRejections: true,
        onUnhandled: (id, error) => {
          reportCrash(error, { title: 'Unhandled promise rejection', id }).catch(() => {});
        },
        onHandled: () => {},
      });
    } catch {
      // optional
    }
  }
}

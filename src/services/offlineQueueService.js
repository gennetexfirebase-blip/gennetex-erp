/**
 * Offline-first queue — талбайн үйлдлүүдийг сүлжээгүй үед хадгалаад
 * интернэт орж ирэхэд автомат sync хийнэ.
 * Хуучин Online-only OfflineGate-тай зэрэгцэн ажиллана (feature flag).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { isFlagOn } from '../lib/featureFlags';

const QUEUE_KEY = '@gennetex/offline_queue_v1';
const CACHE_PREFIX = '@gennetex/offline_cache/';

let _flushing = false;
let _listeners = new Set();
let _unsubNet = null;

export function subscribeOfflineQueue(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function emit(snapshot) {
  _listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {}
  });
}

export async function getQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveQueue(items) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  emit({ pending: items.length, items });
}

/**
 * @param {{ type: string, payload: object, mutate?: (payload)=>Promise<any> }} job
 * type: 'attendance' | 'call_status' | 'call_close' | 'stock_transfer' | 'site_photo' | 'generic'
 */
export async function enqueue(job) {
  const items = await getQueue();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type: job.type || 'generic',
    payload: job.payload || {},
    createdAt: new Date().toISOString(),
    retries: 0,
    lastError: null,
  };
  items.push(entry);
  await saveQueue(items);
  // Онлайн бол шууд оролдоно
  flushQueue().catch(() => {});
  return entry;
}

export async function cacheSet(key, data) {
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {}
}

export async function cacheGet(key, maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (maxAgeMs && Date.now() - (parsed.at || 0) > maxAgeMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/** Handler-уудыг app bootstrap-д бүртгэнэ */
const _handlers = {};

export function registerOfflineHandler(type, handler) {
  _handlers[type] = handler;
}

export async function flushQueue() {
  if (_flushing) return { ok: 0, fail: 0 };
  if (!isFlagOn('offlineFirst')) return { ok: 0, fail: 0 };

  const net = await NetInfo.fetch().catch(() => null);
  const online = net?.isConnected && net?.isInternetReachable !== false;
  if (!online) return { ok: 0, fail: 0 };

  _flushing = true;
  let ok = 0;
  let fail = 0;
  try {
    let items = await getQueue();
    const remaining = [];
    for (const item of items) {
      const handler = _handlers[item.type];
      if (!handler) {
        // Handler байхгүй — generic-ийг хадгална (алдахгүй)
        remaining.push(item);
        continue;
      }
      try {
        await handler(item.payload, item);
        ok += 1;
      } catch (e) {
        fail += 1;
        remaining.push({
          ...item,
          retries: (item.retries || 0) + 1,
          lastError: String(e?.message || e),
        });
      }
    }
    await saveQueue(remaining);
  } finally {
    _flushing = false;
  }
  return { ok, fail };
}

export async function getPendingCount() {
  const q = await getQueue();
  return q.length;
}

export function startOfflineSyncWatcher() {
  if (_unsubNet) return;
  _unsubNet = NetInfo.addEventListener((state) => {
    const online = state?.isConnected && state?.isInternetReachable !== false;
    if (online) flushQueue().catch(() => {});
  });
  // Эхлэхэд нэг удаа
  flushQueue().catch(() => {});
}

export function stopOfflineSyncWatcher() {
  if (_unsubNet) {
    _unsubNet();
    _unsubNet = null;
  }
}

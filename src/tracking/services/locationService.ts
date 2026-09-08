import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import NetInfo from '@react-native-community/netinfo';
import { trackingClient } from './realtimeLocationService';
import { LocationPoint, distanceMeters, plausible, updateInterval, validPoint } from '../utils/locationUtils';

const PREFIX = '@erp_tracking_v1:';
const MAX_POINTS = 12000;
let work: Promise<unknown> = Promise.resolve();
const last = new Map<string, LocationPoint>();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const task = work.then(fn, fn);
  work = task.catch(() => undefined);
  return task;
}
async function readQueue(id: string): Promise<LocationPoint[]> {
  const raw = await AsyncStorage.getItem(PREFIX + id);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Байршлын хадгалсан дарааллыг уншиж чадсангүй');
  return parsed;
}
async function drain(id: string) {
  const supabase = trackingClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id !== id) return;
  let points = await readQueue(id);
  // Publish the newest sample first so a long offline backlog does not delay the live map.
  if (points.length > 1) {
    const { error } = await supabase.rpc('ingest_employee_location', { p: points[points.length - 1] });
    if (error) throw error;
  }
  for (let batch = 0; points.length && batch < 5; batch++) {
    const { error } = await supabase.rpc('ingest_employee_locations', { points: points.slice(0, 100) });
    if (error) throw error;
    // Rejected invalid/out-of-session samples are terminal, not retried forever.
    points = points.slice(100);
    await AsyncStorage.setItem(PREFIX + id, JSON.stringify(points));
  }
}
export function syncLocations(id: string) { return serialized(() => drain(id)); }
export function subscribeLocationSync(id: string) {
  const unsubscribe = NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable !== false) syncLocations(id).catch(() => {});
  });
  const timer = setInterval(() => syncLocations(id).catch(() => {}), 30000);
  return () => { unsubscribe(); clearInterval(timer); };
}
export function sendLocation(id: string, position: { timestamp: number; coords: {
  latitude: number; longitude: number; accuracy?: number | null; speed?: number | null; heading?: number | null;
} }) {
  return serialized(async () => {
    const battery = await Battery.getBatteryLevelAsync().catch(() => -1);
    const c = position.coords;
    const point: LocationPoint = { employee_id: id, latitude: c.latitude, longitude: c.longitude,
      accuracy: c.accuracy ?? null, speed: c.speed != null && c.speed >= 0 ? c.speed : null,
      heading: c.heading != null && c.heading >= 0 ? c.heading % 360 : null,
      battery: battery < 0 ? null : Math.round(battery * 100), timestamp: Math.round(position.timestamp) };
    if (!validPoint(point)) return;
    const previous = last.get(id);
    if (previous) {
      if (!plausible(previous, point)) return;
      const elapsed = point.timestamp - previous.timestamp;
      if (elapsed < updateInterval(point.speed) && (elapsed < 3000 || distanceMeters(previous, point) < 10)) return;
    }
    const queue = (await readQueue(id)).filter(p => p.timestamp > Date.now() - 7 * 86400000);
    if (!queue.some(p => p.timestamp === point.timestamp)) queue.push(point);
    queue.sort((a, b) => a.timestamp - b.timestamp);
    await AsyncStorage.setItem(PREFIX + id, JSON.stringify(queue.slice(-MAX_POINTS)));
    last.set(id, point);
    await drain(id);
  });
}

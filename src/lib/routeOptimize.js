/**
 * Route optimization — nearest-neighbor + 2-opt (онлайн API-гүй).
 * Google Directions API байвал optional enhance (env key).
 */
import { distanceMeters } from './geo';

function dist(a, b) {
  if (a?.latitude == null || b?.latitude == null) return 1e9;
  try {
    return distanceMeters(a, b) / 1000; // km
  } catch {
    const dLat = (a.latitude - b.latitude) * 111;
    const dLng = (a.longitude - b.longitude) * 85;
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }
}

/**
 * @param {{ latitude, longitude }} origin — engineer current position
 * @param {Array<{ id, latitude, longitude, ... }>} calls
 * @returns {{ order: Array, totalKm: number, legs: Array }}
 */
export function optimizeCallRoute(origin, calls = []) {
  const points = (calls || []).filter((c) => c?.latitude != null && c?.longitude != null);
  if (!points.length) return { order: [], totalKm: 0, legs: [] };

  // Nearest neighbor
  const remaining = [...points];
  const order = [];
  let cur = origin;
  while (remaining.length) {
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = dist(cur, remaining[i]);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    const next = remaining.splice(bestI, 1)[0];
    order.push(next);
    cur = next;
  }

  // 2-opt improve
  let improved = true;
  let guard = 0;
  while (improved && guard < 80) {
    improved = false;
    guard += 1;
    for (let i = 0; i < order.length - 1; i++) {
      for (let k = i + 1; k < order.length; k++) {
        const a = i === 0 ? origin : order[i - 1];
        const b = order[i];
        const c = order[k];
        const d = k + 1 < order.length ? order[k + 1] : null;
        const before = dist(a, b) + (d ? dist(c, d) : 0);
        const after = dist(a, c) + (d ? dist(b, d) : 0);
        if (after + 1e-9 < before) {
          const slice = order.slice(i, k + 1).reverse();
          order.splice(i, k - i + 1, ...slice);
          improved = true;
        }
      }
    }
  }

  const legs = [];
  let totalKm = 0;
  let prev = origin;
  for (const p of order) {
    const km = dist(prev, p);
    totalKm += km;
    legs.push({ from: prev, to: p, km: Math.round(km * 100) / 100 });
    prev = p;
  }

  return { order, totalKm: Math.round(totalKm * 100) / 100, legs };
}

/** Google Maps multi-stop URL (external navigation) */
export function buildGoogleMapsMultiStopUrl(origin, orderedCalls) {
  if (!orderedCalls?.length) return null;
  const dest = orderedCalls[orderedCalls.length - 1];
  const waypoints = orderedCalls
    .slice(0, -1)
    .map((c) => `${c.latitude},${c.longitude}`)
    .join('|');
  const base = `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${dest.latitude},${dest.longitude}&travelmode=driving`;
  return waypoints ? `${base}&waypoints=${encodeURIComponent(waypoints)}` : base;
}

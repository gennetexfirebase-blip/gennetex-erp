export type Coordinate = { latitude: number; longitude: number };
export type LocationPoint = Coordinate & {
  employee_id: string; timestamp: number; accuracy: number | null;
  speed: number | null; heading: number | null; battery: number | null;
  online?: boolean; name?: string;
};
export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)));
}
export function validPoint(p: LocationPoint, now = Date.now()): boolean {
  return Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 &&
    Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180 &&
    Number.isSafeInteger(p.timestamp) && p.timestamp > now - 7 * 86400000 && p.timestamp <= now + 60000 &&
    (p.accuracy == null || (Number.isFinite(p.accuracy) && p.accuracy >= 0 && p.accuracy <= 100)) &&
    (p.speed == null || (Number.isFinite(p.speed) && p.speed >= 0 && p.speed <= 80));
}
export function plausible(a: LocationPoint, b: LocationPoint): boolean {
  const seconds = (b.timestamp - a.timestamp) / 1000;
  return seconds > 0 && distanceMeters(a, b) <= seconds * 80 + (a.accuracy || 0) + (b.accuracy || 0) + 10;
}
export function routeDistance(points: LocationPoint[]): number {
  return points.reduce((sum, point, i) => i && plausible(points[i - 1], point)
    ? sum + distanceMeters(points[i - 1], point) : sum, 0) / 1000;
}
export function updateInterval(speed: number | null): number {
  return speed != null && speed >= 2.5 ? 5000 : speed != null && speed >= 0.5 ? 12000 : 30000;
}
export function trackingDay(timestamp = Date.now()): string {
  return new Date(timestamp + 8 * 3600000).toISOString().slice(0, 10);
}
export function trackingStatus(point?: LocationPoint | null, now = Date.now()): 'online' | 'weak' | 'offline' {
  if (!point || point.online === false || now - point.timestamp > 120000) return 'offline';
  return now - point.timestamp <= 30000 ? 'online' : 'weak';
}
export function lastSeen(timestamp?: number, now = Date.now()): string {
  if (!timestamp) return 'Байршил ирээгүй';
  const sec = Math.max(0, Math.floor((now - timestamp) / 1000));
  return sec < 60 ? `${sec} сек өмнө` : sec < 3600 ? `${Math.floor(sec / 60)} мин өмнө` : `${Math.floor(sec / 3600)} цаг өмнө`;
}
export function accuracyLabel(value: number | null): string {
  return value == null ? 'Тодорхойгүй' : value <= 10 ? 'Excellent' : value <= 30 ? 'Good' : 'Low accuracy';
}

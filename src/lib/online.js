export const ONLINE_MS = 5 * 60 * 1000;

export function isOnline(lastSeen) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_MS;
}

export function formatLastSeen(lastSeen) {
  if (!lastSeen) return 'Offline';
  if (isOnline(lastSeen)) return 'Online';
  const diff = Date.now() - new Date(lastSeen).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Саяхан offline';
  if (min < 60) return `${min} мин өмнө offline`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} цаг өмнө offline`;
  return new Date(lastSeen).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' });
}

export function formatDuration(seconds = 0) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} цаг ${m} мин`;
  if (m > 0) return `${m} мин ${sec} сек`;
  return `${sec} сек`;
}

export function elapsedSeconds(from, to = new Date()) {
  if (!from) return 0;
  return Math.max(0, Math.floor((new Date(to) - new Date(from)) / 1000));
}

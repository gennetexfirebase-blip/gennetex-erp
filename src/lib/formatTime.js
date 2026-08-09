const TZ = 'Asia/Ulaanbaatar';

function dayKeyInTz(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

export function formatTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('mn-MN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  });
}

export function formatDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('mn-MN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: TZ,
  });
}

export function formatConvTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const today = dayKeyInTz(new Date());
  const msgDay = dayKeyInTz(d);
  if (msgDay === today) return formatTime(d);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (msgDay === dayKeyInTz(yesterday)) return 'Өчигдөр';
  return d.toLocaleDateString('mn-MN', { month: 'short', day: 'numeric', timeZone: TZ });
}

export function formatChatDay(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const today = dayKeyInTz(new Date());
  const msgDay = dayKeyInTz(d);
  if (msgDay === today) return 'Өнөөдөр';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (msgDay === dayKeyInTz(yesterday)) return 'Өчигдөр';
  return d.toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: TZ,
  });
}

export function isSameChatDay(a, b) {
  if (!a || !b) return false;
  return dayKeyInTz(a) === dayKeyInTz(b);
}

/** "5 минутын өмнө", "2 цагийн өмнө", "3 өдрийн өмнө" */
export function formatRelativeTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return 'Саяхан';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'Саяхан';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} минутын өмнө`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} цагийн өмнө`;
  const day = Math.floor(hour / 24);
  if (day === 1) return 'Өчигдөр';
  if (day < 7) return `${day} өдрийн өмнө`;
  const week = Math.floor(day / 7);
  if (week < 5) return `${week} долоо хоногийн өмнө`;
  return d.toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: TZ,
  });
}

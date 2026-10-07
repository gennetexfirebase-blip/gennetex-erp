const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value) {
  if (!value || value === '-') return null;
  const text = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(text);
  if (!match) return null;
  const result = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] || 23),
    Number(match[5] || 59),
    59
  );
  return Number.isNaN(result.getTime()) ? null : result;
}

export function diagnosisCompliance(data, now = new Date(), warningDays = 30) {
  const dates = [
    parseDate(data?.diagnosisValidUntil),
    ...(data?.diagnosisRows || []).map((row) => parseDate(row[3])),
  ].filter(Boolean);
  if (!dates.length) return { tone: 'unknown', label: 'Оношилгооны хугацаа олдсонгүй', date: null, daysLeft: null };
  const expiry = dates.reduce((latest, value) => value > latest ? value : latest);
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / DAY_MS);
  if (daysLeft < 0) {
    return { tone: 'danger', label: `Оношилгоо ${Math.abs(daysLeft)} хоног хэтэрсэн`, date: expiry, daysLeft };
  }
  if (daysLeft <= warningDays) {
    return { tone: 'danger', label: `Оношилгоо ${daysLeft} хоногийн дараа дуусна`, date: expiry, daysLeft };
  }
  return { tone: 'success', label: `Оношилгоо хэвийн · ${daysLeft} хоног`, date: expiry, daysLeft };
}

export function taxCompliance(data, now = new Date()) {
  const rows = data?.taxRows || [];
  if (!rows.length) return { tone: 'unknown', label: 'Татварын мэдээлэл олдсонгүй', year: null, paid: null };
  const normalized = rows.map((row) => ({
    year: Number(row.year ?? row[1]),
    status: String(row.statusText ?? row[6] ?? ''),
    paid: typeof row.isPaid === 'boolean'
      ? row.isPaid
      : typeof row[7] === 'boolean'
        ? row[7]
        : /төлсөн|төлөгдсөн|paid/i.test(String(row.statusText ?? row[6] ?? '')),
  })).filter((row) => Number.isFinite(row.year));
  if (!normalized.length) return { tone: 'unknown', label: 'Татварын мэдээлэл олдсонгүй', year: null, paid: null };
  const latest = normalized.reduce((best, row) => row.year > best.year ? row : best);
  const currentYear = now.getFullYear();
  const normal = latest.year >= currentYear && latest.paid;
  return normal
    ? { tone: 'success', label: `${latest.year} оны татвар төлөгдсөн`, year: latest.year, paid: true }
    : { tone: 'danger', label: `${currentYear} оны татвар төлөгдөөгүй`, year: latest.year, paid: false };
}

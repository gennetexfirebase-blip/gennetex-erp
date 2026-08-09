/** Ажилтны QR код — жолооч хамт яваа хүн уншуулахад ашиглана */
const PREFIX = 'EMP:';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function formatEmployeeBadge(userId) {
  if (!userId) return '';
  return `${PREFIX}${userId}`;
}

export function parseEmployeeBadge(raw) {
  const q = String(raw || '').trim();
  if (!q) return { userId: null, badgeCode: null };
  if (q.toUpperCase().startsWith(PREFIX)) {
    return { userId: q.slice(PREFIX.length).trim(), badgeCode: null };
  }
  if (UUID_RE.test(q)) {
    return { userId: q, badgeCode: null };
  }
  return { userId: null, badgeCode: q };
}

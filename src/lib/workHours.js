/** Өдрийн эхлэл/төгсгөл (local) */
export function dayKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDuration(ms) {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} мин`;
  return `${h} цаг ${m} мин`;
}

export function parseTimeOnDate(dateKey, hhmm) {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date(`${dateKey}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Ирцийн дээр өдрийн ажилласан цаг тооцох */
export function calculateDayWork({ attendance = [], dateKey = dayKey() }) {
  const approved = attendance
    .filter((a) => (a.status || 'approved') === 'approved')
    .filter((a) => dayKey(new Date(a.created_at)) === dateKey)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const pairs = [];
  let grossMs = 0;
  let openIn = null;

  for (const row of approved) {
    if (row.type === 'check_in') {
      openIn = row;
    } else if (row.type === 'check_out' && openIn) {
      const start = new Date(openIn.created_at).getTime();
      const end = new Date(row.created_at).getTime();
      const ms = Math.max(0, end - start);
      grossMs += ms;
      pairs.push({ checkIn: openIn, checkOut: row, ms });
      openIn = null;
    }
  }

  return { pairs, grossMs, netMs: grossMs, openCheckIn: openIn };
}

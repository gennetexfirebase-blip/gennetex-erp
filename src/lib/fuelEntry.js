export function fuelToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function validateFuelEntry(input, today = fuelToday()) {
  const date = String(input.consumed_on || '').trim();
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date > today || date < '2000-01-01') {
    throw new Error('Огноог YYYY-MM-DD хэлбэрээр оруулна уу. Ирээдүйн огноо сонгох боломжгүй.');
  }
  if (!input.vehicle_id) throw new Error('Машинаа сонгоно уу.');
  const number = (value) => Number(String(value ?? '').trim().replace(',', '.'));
  const liters = number(input.liters), cost = number(input.cost), distance = number(input.distance_km);
  if (!Number.isFinite(liters) || Math.round(liters * 100) <= 0 || liters > 10000) throw new Error('Зарцуулсан литр 0.01-ээс багагүй, 10,000-аас ихгүй байна.');
  if (!Number.isFinite(cost) || Math.round(cost * 100) <= 0 || cost > 100000000) throw new Error('Мөнгөн дүн 0.01-ээс багагүй, 100,000,000-аас ихгүй байна.');
  if (!Number.isFinite(distance) || distance < 0 || distance > 100000) throw new Error('Явсан км 0–100,000 хооронд байна.');
  const note = String(input.note || '').trim();
  if (note.length > 500) throw new Error('Тайлбар 500 тэмдэгтээс ихгүй байна.');
  return { vehicle_id: input.vehicle_id, consumed_on: date, liters: Math.round(liters * 100) / 100, cost: Math.round(cost * 100) / 100, distance_km: Math.round(distance * 100) / 100, note };
}

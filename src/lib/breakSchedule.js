/** 1=Даваа … 7=Ням (ISO) */
export const WEEKDAYS = [
  { day: 1, label: 'Даваа'},
  { day: 2, label: 'Мягмар'},
  { day: 3, label: 'Лхагва'},
  { day: 4, label: 'Пүрэв'},
  { day: 5, label: 'Баасан'},
  { day: 6, label: 'Бямба'},
  { day: 7, label: 'Ням'},
];

export function isoWeekday(date = new Date()) {
  const d = new Date(date).getDay();
  return d === 0 ? 7 : d;
}

export function weekdayLabel(day) {
  return WEEKDAYS.find((w) => w.day === day)?.label || `Өдөр ${day}`;
}

/** Бүх гариг — эхлээд ажлын өдөр */
export function emptyRestDays() {
  return WEEKDAYS.map((w) => ({ day_of_week: w.day, is_rest: false }));
}

/** Хуучин нэр — emptyRestDays() ашиглана */
export function emptyWeekSchedule() {
  return emptyRestDays();
}

/** DB-ээс ирсэн мөрүүд = амралтын өдөр */
export function mergeRestDays(rows = []) {
  const restSet = new Set((rows || []).map((r) => r.day_of_week));
  return WEEKDAYS.map((w) => ({
    day_of_week: w.day,
    is_rest: restSet.has(w.day),
  }));
}

export function formatRestDaysSummary(restDays = []) {
  const names = restDays
    .filter((d) => d.is_rest)
    .map((d) => weekdayLabel(d.day_of_week));
  if (!names.length) return 'Амралтын өдөр тохируулаагүй';
  return names.join(', ');
}

export function isRestDay(restDays = [], date = new Date()) {
  const weekday = isoWeekday(date);
  return restDays.some((d) => d.day_of_week === weekday && d.is_rest);
}

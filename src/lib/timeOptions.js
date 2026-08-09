/** 30 минут тутамд 06:00–22:00 */
export function buildTimeOptions(stepMin = 30, startHour = 6, endHour = 22) {
  const opts = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += stepMin) {
      if (h === endHour && m > 0) break;
      opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return opts;
}

export const TIME_OPTIONS = buildTimeOptions();

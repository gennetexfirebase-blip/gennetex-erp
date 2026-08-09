/** Машин явах хурдны доод хязгаар (~5 км/ц) — алхаад явахад тооцохгүй */
export const DRIVE_SPEED_MS = 1.4;

export function isDrivingSpeed(speedMs) {
  if (speedMs == null || Number.isNaN(speedMs)) return false;
  return speedMs >= DRIVE_SPEED_MS;
}

export function calculateFuel({
  distanceKm = 0,
  idleSeconds = 0,
  litersPer100km = 12,
  idleLitersPerHour = 1.2,
  pricePerLiter = 2600,
}) {
  const driveLiters = (Number(distanceKm) * Number(litersPer100km)) / 100;
  // Зогссон үед түлш тооцохгүй — зөвхөн хөдөлсөн км-ээр
  const idleLiters = 0;
  const liters = driveLiters + idleLiters;
  const cost = liters * Number(pricePerLiter);
  return {
    liters,
    cost,
    driveLiters,
    idleLiters,
  };
}

export function formatIdle(seconds = 0) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} цаг ${m} мин`;
  return `${m} мин`;
}

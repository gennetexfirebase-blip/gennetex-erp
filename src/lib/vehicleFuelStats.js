/** Машины түлш — савны багтаамж, үлдэгдэл %, явсан км */

export const DEFAULT_TANK_L = 60;

export function vehicleTankLiters(v) {
  return Number(v?.tank_capacity_liters) || DEFAULT_TANK_L;
}

export function tripKm(t) {
  return Number(t.distance_km ?? t.km ?? 0);
}

export function fuelLevelColor(pct) {
  const p = Number(pct) || 0;
  if (p <= 15) return '#ef4444';
  if (p <= 35) return '#f59e0b';
  return '#22c55e';
}

export function buildVehicleFuelStats(vehicles, trips, { days = 30 } = {}) {
  const cutoff = Date.now() - days * 86400000;
  const map = {};

  (vehicles || []).forEach((v) => {
    const key = v.id || v.plate_number;
    map[key] = {
      vehicle: v,
      plate: v.plate_number || '—',
      driver: v.driver_name || '—',
      km: 0,
      liters: 0,
      cost: 0,
      trips: 0,
      active: false,
      activeKm: 0,
      activeLiters: 0,
      activeTrip: null,
      tank: vehicleTankLiters(v),
      baseLevel: Number(v.fuel_level_percent ?? 100),
      // Сүүлийн цэнэглэлтийн мөч. Түвшинг ҮҮНЭЭС ХОЙШ явсан аяллаар
      // бууруулна — статистикийн `days` шүүлтээс хамаарахгүй.
      refilledAt: v.fuel_refilled_at ? new Date(v.fuel_refilled_at).getTime() : null,
      sinceRefillLiters: 0,
    };
  });

  (trips || []).forEach((t) => {
    const v =
      (vehicles || []).find((veh) => veh.id && t.vehicle_id && veh.id === t.vehicle_id) ||
      (vehicles || []).find((veh) => veh.plate_number && t.plate_number && veh.plate_number === t.plate_number);
    const key = v?.id || t.plate_number || 'unknown';
    if (!map[key]) {
      map[key] = {
        vehicle: v,
        plate: t.plate_number || '—',
        driver: t.driver_name || v?.driver_name || '—',
        km: 0,
        liters: 0,
        cost: 0,
        trips: 0,
        active: false,
        activeKm: 0,
        activeLiters: 0,
        activeTrip: null,
        tank: vehicleTankLiters(v),
        baseLevel: Number(v?.fuel_level_percent ?? 100),
        refilledAt: v?.fuel_refilled_at ? new Date(v.fuel_refilled_at).getTime() : null,
        sinceRefillLiters: 0,
      };
    }
    const row = map[key];

    /**
     * Энэ аялал СҮҮЛИЙН ЦЭНЭГЛЭЛТЭЭС ХОЙШ болсон уу?
     *
     * ⚠️ Түвшинг зөвхөн үүгээр бууруулна. Цэнэглэхээс ӨМНӨХ аялал нь
     *    аль хэдийн тооцогдсон түлшийг хоёр дахин хасах болно.
     */
    const startedMs = t.started_at ? new Date(t.started_at).getTime() : null;
    const afterRefill =
      row.refilledAt == null || (startedMs != null && startedMs >= row.refilledAt);

    if (t.status === 'active') {
      row.active = true;
      row.activeKm = tripKm(t);
      row.activeLiters = Number(t.liters || 0);
      row.activeTrip = t;
      if (afterRefill) row.sinceRefillLiters += Number(t.liters || 0);
      if (t.driver_name) row.driver = t.driver_name;
      return;
    }

    // Дууссан аялал ч түлш шатаадаг — өмнө нь энэ түвшинд огт
    // тусдаггүй байсан тул аялал дуусмагц хувь буцаж үсэрдэг байв.
    if (afterRefill) row.sinceRefillLiters += Number(t.liters || 0);

    if (!startedMs || startedMs < cutoff) return;
    row.km += tripKm(t);
    row.liters += Number(t.liters || 0);
    row.cost += Number(t.cost || 0);
    row.trips += 1;
    if (t.driver_name) row.driver = t.driver_name;
  });

  return Object.values(map)
    .map((row) => {
      const tank = row.tank;
      // Цэнэглэснээс хойш шатсан бүх түлш — явж байгаа аялал ч, дууссан ч.
      const drain = tank > 0 ? (row.sinceRefillLiters / tank) * 100 : 0;
      const currentLevel = Math.max(
        0,
        Math.min(100, Math.round((row.baseLevel - drain) * 10) / 10)
      );
      const remainingLiters = Math.max(0, Math.round(((currentLevel / 100) * tank) * 10) / 10);
      const totalKm = Math.round((row.km + (row.active ? row.activeKm : 0)) * 100) / 100;
      const periodLiters = row.active ? row.activeLiters : row.liters;
      return {
        ...row,
        currentLevel,
        // Цэнэглэлтээс хойш шатсан литр — дэлгэц дээр "хэдийг зарцуулав"
        // гэдгийг харуулахад.
        usedSinceRefill: Math.round(row.sinceRefillLiters * 10) / 10,
        remainingLiters,
        totalKm,
        periodLiters,
        levelColor: fuelLevelColor(currentLevel),
      };
    })
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return b.totalKm - a.totalKm;
    });
}

import { supabase } from '../lib/supabase';
import { parseEmployeeBadge } from '../lib/employeeBadge';
import { normalizePlateNumber } from '../lib/mongoliaPlate';

// Машины давтагдашгүй код (QR-д хадгалагдана)
export function generateVehicleCode() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `VH-${n}`;
}

export async function fetchVehicles() {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function insertVehicle({ code, plate_number, liters_per_100km, tank_capacity_liters, driver_name, driver_id }) {
  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      code: code.trim(),
      plate_number: normalizePlateNumber(plate_number),
      liters_per_100km: Number(liters_per_100km) || 12,
      tank_capacity_liters: Number(tank_capacity_liters) || 60,
      fuel_level_percent: 100,
      driver_name: driver_name?.trim() || null,
      driver_id: driver_id || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateVehicle(id, { plate_number, liters_per_100km, tank_capacity_liters, driver_name, driver_id }) {
  const patch = {};
  if (plate_number != null) patch.plate_number = normalizePlateNumber(plate_number);
  if (liters_per_100km != null) patch.liters_per_100km = Number(liters_per_100km) || 12;
  if (tank_capacity_liters != null) patch.tank_capacity_liters = Number(tank_capacity_liters) || 60;
  if (driver_name !== undefined) patch.driver_name = driver_name?.trim() || null;
  if (driver_id !== undefined) patch.driver_id = driver_id || null;
  const { data, error } = await supabase
    .from('vehicles')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteVehicle(id) {
  const { error } = await supabase.from('vehicles').delete().eq('id', id);
  if (error) throw error;
}

export async function getVehicleByCode(code) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('code', code.trim())
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** QR, бар код, улсын дугаараар машин хайна */
export async function resolveVehicleScan(raw) {
  const q = String(raw || '').trim();
  if (!q) return null;
  const cols = ['code', 'plate_number', 'barcode'];
  for (const col of cols) {
    const { data, error } = await supabase.from('vehicles').select('*').eq(col, q).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  const { data, error } = await supabase.from('vehicles').select('*').ilike('code', q).maybeSingle();
  if (error) throw error;
  return data;
}

// QR уншсан ажилтныг тухайн машины одоогийн жолооч болгож онооно
export async function assignDriver(vehicleId, { driverId, driverName }) {
  const { data, error } = await supabase
    .from('vehicles')
    .update({ driver_id: driverId || null, driver_name: driverName || null })
    .eq('id', vehicleId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Машины үйл явдлын лог (уншсан / аялал эхэлсэн / дууссан)
export async function logVehicleEvent({ vehicle, userId, userName, event, distanceKm, liters, cost, latitude, longitude }) {
  const { error } = await supabase.from('vehicle_logs').insert({
    vehicle_id: vehicle?.id || null,
    plate_number: vehicle?.plate_number || null,
    code: vehicle?.code || null,
    user_id: userId || null,
    user_name: userName || null,
    event: event || 'scan',
    distance_km: distanceKm ?? null,
    liters: liters ?? null,
    cost: cost ?? null,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
  });
  if (error) throw error;
}

export async function fetchVehicleLogs(limit = 100) {
  const { data, error } = await supabase
    .from('vehicle_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function beginDriverTrip({ vehicle, driverId, driverName }) {
  await endDriverActiveTrips(driverId);
  await endStaleActiveTripsBeforeToday();

  const { data, error } = await supabase
    .from('trips')
    .insert({
      vehicle_id: vehicle.id,
      plate_number: vehicle.plate_number,
      driver_id: driverId || null,
      driver_name: driverName,
      status: 'active',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** @deprecated beginDriverTrip ашиглана */
export const startTrip = beginDriverTrip;

export async function updateTrip(id, { distanceKm, liters, cost, idleSeconds }) {
  const patch = {};
  if (distanceKm != null) patch.distance_km = distanceKm;
  if (liters != null) patch.liters = liters;
  if (cost != null) patch.cost = cost;
  if (idleSeconds != null) patch.idle_seconds = idleSeconds;
  if (!Object.keys(patch).length) return;
  const { error } = await supabase.from('trips').update(patch).eq('id', id);
  if (error) throw error;
}

export async function endTrip(id, { distanceKm, liters, cost, idleSeconds }) {
  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .select('vehicle_id')
    .eq('id', id)
    .maybeSingle();
  if (tripErr) throw tripErr;

  const { error } = await supabase
    .from('trips')
    .update({
      distance_km: distanceKm,
      liters,
      cost,
      idle_seconds: idleSeconds ?? 0,
      status: 'done',
      ended_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;

  const usedLiters = Number(liters) || 0;
  if (trip?.vehicle_id && usedLiters > 0) {
    try {
      const { data: v } = await supabase
        .from('vehicles')
        .select('fuel_level_percent,tank_capacity_liters')
        .eq('id', trip.vehicle_id)
        .maybeSingle();
      if (v) {
        const tank = Number(v.tank_capacity_liters) || 60;
        const drain = (usedLiters / tank) * 100;
        const next = Math.max(0, Math.min(100, Number(v.fuel_level_percent ?? 100) - drain));
        await supabase
          .from('vehicles')
          .update({ fuel_level_percent: Math.round(next * 10) / 10 })
          .eq('id', trip.vehicle_id);
      }
    } catch (e) {}
  }
}

export async function refillVehicleFuel(vehicleId) {
  const { data, error } = await supabase
    .from('vehicles')
    .update({
      fuel_level_percent: 100,
      fuel_refilled_at: new Date().toISOString(),
    })
    .eq('id', vehicleId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchTrips(limit = 30) {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchMyTrips(userId, limit = 50) {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('driver_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

function todayStartDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Жолоочийн бүх идэвхтэй аяллыг хаана (шинэ баг эхлүүлэхэд) */
export async function endDriverActiveTrips(driverId) {
  if (!driverId) return;
  const { data: active, error } = await supabase
    .from('trips')
    .select('id')
    .eq('driver_id', driverId)
    .eq('status', 'active');
  if (error) throw error;
  for (const t of active || []) {
    await endTrip(t.id, { distanceKm: 0, liters: 0, cost: 0, idleSeconds: 0 });
  }
}

/** Өмнөх өдрийн идэвхтэй аяллуудыг автоматаар хаана */
export async function endStaleActiveTripsBeforeToday() {
  const start = todayStartDate().toISOString();
  const { data: active, error } = await supabase
    .from('trips')
    .select('id')
    .eq('status', 'active')
    .lt('started_at', start);
  if (error) throw error;
  for (const t of active || []) {
    await endTrip(t.id, { distanceKm: 0, liters: 0, cost: 0, idleSeconds: 0 });
  }
}

/** Өнөөдөр өөр идэвхтэй багт байгаа эсэх */
export async function findPassengerActiveTripToday(passengerId, excludeTripId = null) {
  if (!passengerId) return null;
  const todayStart = todayStartDate();

  try {
    const { data, error } = await supabase
      .from('trip_passengers')
      .select('trip_id, trips(id, driver_name, plate_number, status, started_at)')
      .eq('passenger_id', passengerId);
    if (!error) {
      const row = (data || []).find(
        (r) =>
          r.trips?.status === 'active'&&
          r.trip_id !== excludeTripId &&
          new Date(r.trips.started_at) >= todayStart
      );
      if (row?.trips) return row.trips;
    }
  } catch (e) {
    if (!isTripPassengersMissing(e)) throw e;
  }

  const { data: sessions, error: sErr } = await supabase
    .from('field_site_sessions')
    .select('trip_id, passengers, trips(id, driver_name, plate_number, status, started_at)')
    .in('status', ['pending', 'on_site', 'left'])
    .gte('created_at', todayStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(120);
  if (sErr) throw sErr;

  for (const s of sessions || []) {
    if (!s.trip_id || s.trip_id === excludeTripId || s.trips?.status !== 'active') continue;
    if (new Date(s.trips.started_at) < todayStart) continue;
    const inCrew = (s.passengers || []).some((p) => (p.id || p.passenger_id) === passengerId);
    if (inCrew) return s.trips;
  }
  return null;
}

const PROFILE_SCAN_FIELDS = 'id, name, role, avatar_url, position, phone';

async function findProfileBy(col, val) {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SCAN_FIELDS)
    .eq(col, val)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Ажилтны QR / badge кодоор хайна */
export async function resolveEmployeeScan(raw) {
  const { userId, badgeCode } = parseEmployeeBadge(raw);

  if (userId) {
    const byId = await findProfileBy('id', userId);
    if (byId) return byId;
  }

  if (badgeCode) {
    try {
      const byBadge = await findProfileBy('badge_code', badgeCode);
      if (byBadge) return byBadge;
    } catch (e) {
      // Хуучин DB дээр badge_code багана байхгүй бол зөвхөн id-ээр хайна.
      if (!/badge_code/i.test(e?.message || '')) throw e;
    }
  }

  return null;
}

function isTripPassengersMissing(err) {
  const m = String(err?.message || err || '');
  return /trip_passengers/i.test(m);
}

function normalizePassenger(p, tripId, scannedAt) {
  const pid = p.passenger_id || p.id || null;
  const pname = p.passenger_name || p.name || '—';
  return {
    id: pid,
    passenger_id: pid,
    passenger_name: pname,
    name: pname,
    trip_id: p.trip_id || tripId || null,
    scanned_at: p.scanned_at || scannedAt || null,
  };
}

async function fetchPassengersFromSiteSession(tripId, { driverId, driverName } = {}) {
  const { data, error } = await supabase
    .from('field_site_sessions')
    .select('passengers, created_at, trip_id')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const raw = data?.passengers;
  if (Array.isArray(raw) && raw.length) {
    return raw.map((p) => normalizePassenger(p, tripId, data.created_at));
  }

  const todayStart = todayStartDate().toISOString();
  let rosterQuery = supabase
    .from('field_site_sessions')
    .select('passengers, created_at, trip_id')
    .gte('created_at', todayStart)
    .order('created_at', { ascending: false })
    .limit(5);
  if (driverId) rosterQuery = rosterQuery.eq('driver_id', driverId);
  else if (driverName) rosterQuery = rosterQuery.eq('driver_name', driverName);
  else return [];

  const { data: rows, error: rErr } = await rosterQuery;
  if (rErr) throw rErr;
  const row = (rows || []).find((s) => Array.isArray(s.passengers) && s.passengers.length);
  if (!row) return [];
  return row.passengers.map((p) => normalizePassenger(p, tripId, row.created_at));
}

/** trip_passengers байхгүй DB дээр тухайн аяллын багийг field_site_sessions-д хадгална */
export async function syncTripPassengers(tripId, passengers, { driverId, driverName } = {}) {
  if (!tripId) return;
  const seen = new Set();
  const list = (passengers || [])
    .map((p) => ({
      id: p.passenger_id || p.id || null,
      name: p.passenger_name || p.name || '—',
    }))
    .filter((p) => {
      if (!p.id || !p.name || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

  const { data: existing, error: findErr } = await supabase
    .from('field_site_sessions')
    .select('id')
    .eq('trip_id', tripId)
    .eq('site_name', 'Аялал')
    .in('status', ['pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findErr) throw findErr;

  if (existing?.id) {
    const { error } = await supabase
      .from('field_site_sessions')
      .update({ passengers: list })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { data: anySession } = await supabase
    .from('field_site_sessions')
    .select('id')
    .eq('trip_id', tripId)
    .in('status', ['pending', 'on_site', 'left'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (anySession?.id) {
    const { error } = await supabase
      .from('field_site_sessions')
      .update({ passengers: list })
      .eq('id', anySession.id);
    if (error) throw error;
    return;
  }

  let tripDriverId = driverId;
  let tripDriverName = driverName;
  if (!tripDriverId || !tripDriverName) {
    const { data: trip } = await supabase
      .from('trips')
      .select('driver_id, driver_name')
      .eq('id', tripId)
      .maybeSingle();
    tripDriverId = tripDriverId || trip?.driver_id || null;
    tripDriverName = tripDriverName || trip?.driver_name || null;
  }

  const { error } = await supabase.from('field_site_sessions').insert({
    trip_id: tripId,
    driver_id: tripDriverId,
    driver_name: tripDriverName,
    site_name: 'Аялал',
    passengers: list,
    status: 'pending',
  });
  if (error) throw error;
}

export async function addTripPassenger(tripId, { passengerId, passengerName }, meta = {}) {
  try {
    const { data, error } = await supabase
      .from('trip_passengers')
      .insert({
        trip_id: tripId,
        passenger_id: passengerId || null,
        passenger_name: passengerName,
      })
      .select()
      .single();
    if (error) {
      if (!isTripPassengersMissing(error)) throw error;
    } else {
      return data;
    }
  } catch (e) {
    if (!isTripPassengersMissing(e)) throw e;
  }

  const current = await fetchTripPassengers(tripId);
  const next = [...current];
  if (!next.some((p) => (p.passenger_id || p.id) === passengerId)) {
    next.push(normalizePassenger({ passenger_id: passengerId, passenger_name: passengerName }, tripId));
  }
  await syncTripPassengers(tripId, next, meta);
  return next[next.length - 1];
}

export async function fetchTripPassengers(tripId, meta = {}) {
  try {
    const { data, error } = await supabase
      .from('trip_passengers')
      .select('*')
      .eq('trip_id', tripId)
      .order('scanned_at', { ascending: true });
    if (!error && data?.length) {
      return data.map((p) => normalizePassenger(p, tripId));
    }
    if (error && !isTripPassengersMissing(error)) throw error;
  } catch (e) {
    if (!isTripPassengersMissing(e)) throw e;
  }
  return fetchPassengersFromSiteSession(tripId, meta);
}

/** Админ: аялал + хамт яваа хүмүүс */
export async function fetchTripsWithPassengers(limit = 100) {
  const { data: trips, error } = await supabase
    .from('trips')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!trips?.length) return [];

  const ids = trips.map((t) => t.id);
  let passengers = [];
  try {
    const { data, error: pErr } = await supabase
      .from('trip_passengers')
      .select('*')
      .in('trip_id', ids)
      .order('scanned_at', { ascending: true });
    if (pErr && !isTripPassengersMissing(pErr)) throw pErr;
    passengers = data || [];
  } catch (e) {
    if (!isTripPassengersMissing(e)) throw e;
  }

  const byTrip = {};
  for (const p of passengers) {
    if (!byTrip[p.trip_id]) byTrip[p.trip_id] = [];
    byTrip[p.trip_id].push(normalizePassenger(p, p.trip_id));
  }

  const missingTripIds = ids.filter((id) => !byTrip[id]?.length);
  if (missingTripIds.length) {
    const { data: sessions, error: sErr } = await supabase
      .from('field_site_sessions')
      .select('trip_id, passengers, created_at')
      .in('trip_id', missingTripIds)
      .order('created_at', { ascending: false });
    if (!sErr) {
      const seen = new Set();
      for (const s of sessions || []) {
        if (!s.trip_id || seen.has(s.trip_id)) continue;
        if (!Array.isArray(s.passengers) || !s.passengers.length) continue;
        seen.add(s.trip_id);
        byTrip[s.trip_id] = s.passengers.map((p) => normalizePassenger(p, s.trip_id, s.created_at));
      }
    }
  }

  return trips.map((t) => ({ ...t, passengers: byTrip[t.id] || [] }));
}

/** Ажилтан: өөртэй хамт явж буй идэвхтэй аялал */
export async function fetchMyActivePassengerTrip(userId) {
  try {
    const { data, error } = await supabase
      .from('trip_passengers')
      .select('*, trips(*)')
      .eq('passenger_id', userId)
      .order('scanned_at', { ascending: false })
      .limit(5);
    if (!error) {
      const row = (data || []).find((r) => r.trips?.status === 'active');
      if (row) return row;
    } else if (!isTripPassengersMissing(error)) {
      throw error;
    }
  } catch (e) {
    if (!isTripPassengersMissing(e)) throw e;
  }

  const { data: sessions, error: sErr } = await supabase
    .from('field_site_sessions')
    .select('trip_id, passengers, created_at, trips(*)')
    .in('status', ['pending', 'on_site', 'left'])
    .order('created_at', { ascending: false })
    .limit(80);
  if (sErr) throw sErr;

  for (const s of sessions || []) {
    if (s.trips?.status !== 'active') continue;
    const inCrew = (s.passengers || []).some((p) => (p.id || p.passenger_id) === userId);
    if (!inCrew) continue;
    return {
      trip_id: s.trip_id,
      passenger_id: userId,
      scanned_at: s.created_at,
      trips: s.trips,
    };
  }
  return null;
}

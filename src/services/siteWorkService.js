import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import * as vehicleApi from './vehicleService';
import * as notifyApi from './notificationService';
import { isCallCancelled, isCallRescheduled } from '../lib/callPermissions';

const TABLE = 'field_site_sessions';
const CLOSED_CALL_STATUSES = new Set(['Дууссан', 'Татгалзсан', 'Дахимдах']);

export function isActiveCallForSite(call) {
  if (!call?.id || call.latitude == null || call.longitude == null) return false;
  if (CLOSED_CALL_STATUSES.has(call.status)) return false;
  if (isCallCancelled(call) || isCallRescheduled(call)) return false;
  return true;
}

function todayStartIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function fetchActiveTripContext(userId) {
  try {
    await vehicleApi.endStaleActiveTripsBeforeToday();
  } catch (e) {}

  const { data: asDriver, error } = await supabase
    .from('trips')
    .select('*')
    .eq('driver_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  if (asDriver) {
    const passengers = (
      await vehicleApi.fetchTripPassengers(asDriver.id, {
        driverId: userId,
        driverName: asDriver.driver_name,
      })
    ).filter((p) => (p.passenger_id || p.id) !== userId);
    return { trip: asDriver, role: 'driver', passengers };
  }
  const passRow = await vehicleApi.fetchMyActivePassengerTrip(userId);
  if (passRow?.trips) {
    const passengers = (
      await vehicleApi.fetchTripPassengers(passRow.trips.id, {
        driverId: passRow.trips.driver_id,
        driverName: passRow.trips.driver_name,
      })
    ).filter((p) => (p.passenger_id || p.id) !== passRow.trips.driver_id);
    return { trip: passRow.trips, role: 'passenger', passengers };
  }
  return null;
}

export async function fetchSessionForTrip(tripId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('trip_id', tripId)
    .in('status', ['on_site', 'left', 'submitted'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function markArrival({ trip, driverId, driverName, siteName, siteAddress, passengers }) {
  const existing = trip?.id ? await fetchSessionForTrip(trip.id) : null;
  if (existing?.status === 'on_site') return existing;

  let coord = {};
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      coord = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    }
  } catch (e) {}

  const row = {
    trip_id: trip?.id || null,
    driver_id: driverId,
    driver_name: driverName,
    site_name: siteName.trim(),
    site_address: siteAddress?.trim() || null,
    passengers: (passengers || []).map((p) => ({
      id: p.passenger_id || p.id,
      name: p.passenger_name || p.name,
    })),
    arrived_at: new Date().toISOString(),
    status: 'on_site',
    ...coord,
  };

  if (existing?.id) {
    const { data, error } = await supabase.from(TABLE).update(row).eq('id', existing.id).select().single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.from(TABLE).insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function markDeparture(sessionId) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ departed_at: new Date().toISOString(), status: 'left'})
    .eq('id', sessionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function submitWorkReport(sessionId, workNote) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      work_note: String(workNote || '').trim(),
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select()
    .single();
  if (error) throw error;

  try {
    await notifyApi.notifyAdmins({
      title: 'Ажлын тайлан',
      body: `${data.driver_name || 'Жолооч'} · ${data.site_name}`,
      data: { type: 'site_work', sessionId: data.id },
      channelId: 'chat',
    });
  } catch (e) {}

  return data;
}

export async function countTodayBags() {
  const from = todayStartIso();
  const { count, error } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .gte('created_at', from)
    .in('status', ['on_site', 'left', 'submitted']);
  if (error) throw error;
  return count || 0;
}

export async function fetchSiteSessions(limit = 100) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

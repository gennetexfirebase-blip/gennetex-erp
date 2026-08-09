import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { useApp } from '../context/AppContext';
import * as tracking from '../services/trackingService';
import { distanceMeters } from '../lib/geo';

const MIN_UPLOAD_MS = 15000; // хамгийн багадаа 15 сек тутам
const MIN_MOVE_M = 30; // эсвэл 30м хөдөлбөл
const ARRIVE_RADIUS_M = 120; // айлд "очсон" гэж тооцох радиус

// UI-гүй. Нэвтэрсэн үед байршлыг автоматаар админд (Supabase) илгээнэ.
export default function LocationTracker() {
  const { isCloud, currentUser, calls, setTrackingState, setPendingVisit } = useApp();
  const watchRef = useRef(null);
  const lastUpload = useRef(0);
  const lastCoord = useRef(null);
  const visited = useRef(new Set());

  useEffect(() => {
    if (!isCloud || !currentUser?.id) return;
    let active = true;

    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted' || !active) {
          setTrackingState?.({ active: false, reason: 'no-permission' });
          return;
        }
        setTrackingState?.({ active: true });

        // Эхлэнгүүт шууд нэг удаа байршил илгээх (хөдлөхийг хүлээхгүй)
        try {
          const first = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          await handle(first, true);
        } catch (e) {}

        watchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 20 },
          (pos) => handle(pos)
        );
      } catch (e) {
        setTrackingState?.({ active: false, reason: e.message });
      }
    })();

    const handle = async (pos, force = false) => {
      const coord = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      const now = Date.now();
      const moved = lastCoord.current ? distanceMeters(lastCoord.current, coord) : Infinity;

      if (force || now - lastUpload.current >= MIN_UPLOAD_MS || moved >= MIN_MOVE_M) {
        lastUpload.current = now;
        lastCoord.current = coord;
        try {
          await tracking.updateMyLocation(currentUser.id, coord);
          await tracking.logLocation({
            userId: currentUser.id,
            userName: currentUser.name,
            ...coord,
            speed: pos.coords.speed,
          });
          setTrackingState?.({ active: true, last: { ...coord, at: now } });
        } catch (e) {
          // Алдааг харуулах (RLS/сүлжээ) — админ/ажилтан оношилоход тус болно
          setTrackingState?.({ active: false, reason: e.message, last: { ...coord, at: now } });
        }
      }

      // Айлд очсон эсэхийг шалгах
      for (const c of calls || []) {
        if (c.latitude == null || visited.current.has(c.id)) continue;
        const d = distanceMeters(coord, { latitude: c.latitude, longitude: c.longitude });
        if (d <= ARRIVE_RADIUS_M) {
          visited.current.add(c.id);
          setPendingVisit?.({
            userId: currentUser.id,
            userName: currentUser.name,
            callId: c.id,
            customer: c.customer,
            problem: c.problem,
            callType: c.type,
            latitude: coord.latitude,
            longitude: coord.longitude,
          });
        }
      }
    };

    return () => {
      active = false;
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
    };
  }, [isCloud, currentUser?.id, calls]);

  return null;
}

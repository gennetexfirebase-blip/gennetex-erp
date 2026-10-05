import { useEffect, useRef, useState } from 'react';
import { AppState, DeviceEventEmitter, Platform } from 'react-native';
import * as Location from 'expo-location';
import Notifications from '../lib/notificationsCompat';
import { useApp } from '../context/AppContext';
import { sendLocation, subscribeLocationSync } from '../tracking/services/locationService';
import * as bgLocation from '../services/backgroundLocationService';
import * as attApi from '../services/attendanceService';
import { playZoneExitSound, playZoneEnterSound } from '../services/attendanceSoundService';
import { DEFAULT_CHANNEL } from '../services/notificationService';
import { distanceMeters } from '../lib/geo';
import { isExpoGo } from '../lib/runtimeEnv';

const MIN_UPLOAD_MS = 5000; // хамгийн багадаа 15 сек тутам
const MIN_MOVE_M = 10; // эсвэл 30м хөдөлбөл
const ARRIVE_RADIUS_M = 120; // айлд "очсон" гэж тооцох радиус

// UI-гүй. Нэвтэрсэн үед байршлыг автоматаар админд (Supabase) илгээнэ.
export default function LocationTracker() {
  const { isCloud, currentUser, onShift, shiftStatusReady, calls, setTrackingState, setPendingVisit } = useApp();
  const watchRef = useRef(null);
  const [consentVersion, setConsentVersion] = useState(0);
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('erp-location-consent', () => setConsentVersion(v => v + 1));
    return () => sub.remove();
  }, []);
  const lastUpload = useRef(0);
  const lastCoord = useRef(null);
  const visited = useRef(new Set());
  // `calls` нь байнга шинэчлэгддэг. Хэрэв түүнийг useEffect-ийн хамаарал болговол
  // дуудлага өөрчлөгдөх бүрд GPS watcher дахин эхэлж, байршил тасалддаг байв.
  // Тиймээс хамгийн сүүлийн утгыг ref-д хадгалж, effect-ийг нэг л удаа асаана.
  const callsRef = useRef(calls);
  callsRef.current = calls;
  useEffect(() => {
    if (!isCloud || !currentUser?.id) return;
    return subscribeLocationSync(currentUser.id);
  }, [isCloud, currentUser?.id]);

  /**
   * Ирц бүртгэх бүсээс ГАРСАН үеийн дуут анхааруулга.
   *
   * ⚠️ Өмнө нь энэ шалгалт `AttendanceScreen`-ий дотор байсан тул зөвхөн
   *    тэр дэлгэц НЭЭЛТТЭЙ байхад ажилладаг байв — ажилтан Нүүр рүү
   *    буцангуут, эсвэл аппаа хаангуут бүсээс гарсныг мэдэгдэхээ болино.
   *    Энд шилжүүлснээр НЭВТЭРСЭН БҮХ хэрэглэгчид (эрхээс үл хамааран),
   *    аппын аль ч дэлгэц дээр, арын хяналттай үед ч ажиллана.
   *
   * `undefined` = байршил хараахан тогтоогоогүй, `null` = бүсээс гадуур,
   * id = тухайн бүсэд байна. Гурвыг ялгах нь чухал — эс бөгөөс апп нээх
   * бүрд "бүсээс гарлаа" гэж буруу дуугарна.
   */
  const zoneRef = useRef(undefined);
  const zonesRef = useRef([]);

  useEffect(() => {
    if (!isCloud || !currentUser?.id) return;
    let cancelled = false;
    const load = () =>
      attApi
        .fetchAttendanceLocations()
        .then((list) => {
          if (!cancelled) zonesRef.current = list || [];
        })
        .catch(() => {});
    load();
    // Админ шинэ цэг нэмэх/радиус солиход аппыг дахин нээлгүйгээр тусна.
    const timer = setInterval(load, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isCloud, currentUser?.id]);

  useEffect(() => {
    if (isExpoGo) {
      setTrackingState?.({ active: false, background: false, reason: 'expo-go' });
      return;
    }
    if (isCloud && currentUser?.id && !shiftStatusReady) return;
    if (!isCloud || !currentUser?.id || !onShift) {
      bgLocation.stopTracking().catch(() => {});
      setTrackingState?.({ active: false, reason: onShift ? 'signed-out' : 'outside-session' });
      return;
    }
    let active = true;
    lastUpload.current = 0;
    lastCoord.current = null;

    (async () => {
      try {
        // Silent resume: never open disclosure or system permission dialogs at startup.
        // Foreground uploads also wait until BOTH permissions are granted.
        const res = await bgLocation.startTracking(currentUser, { isCurrent: () => active });
        if (!active) return;
        if (!res.ok) {
          setTrackingState?.({ active: false, background: false, reason: res.reason });
          return;
        }
        setTrackingState?.({ active: true, background: true, reason: null });

        try {
          const first = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          await handle(first, true);
        } catch (e) {}

        if (!active) return;
        const watcher = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 0 },
          (pos) => handle(pos)
        );
        if (active) watchRef.current = watcher; else watcher.remove();
      } catch (e) {
        setTrackingState?.({ active: false, reason: e.message });
      }
    })();

    /**
     * Бүс солигдсон мөчийг барина.
     *
     * Дуу дангаараа хангалтгүй: апп ард байх, дэлгэц түгжээтэй, чимээгүй
     * горимд байх үед сонсогдохгүй. Тиймээс мэдэгдэл давхар гаргана.
     */
    const checkZone = (coord) => {
      const zones = zonesRef.current;
      if (!zones.length) return;

      const near = attApi.nearestAttendanceLocation(coord, zones);
      const currentId = near.within ? near.location?.id : null;
      if (zoneRef.current === currentId) return; // өөрчлөгдөөгүй

      const previous = zoneRef.current;
      const isFirstFix = previous === undefined;
      zoneRef.current = currentId;

      if (currentId) {
        playZoneEnterSound(near.location?.name);
        return;
      }
      // ⚠️ Анхны байршил тогтоох үед дуугаргахгүй — тэр үед "гарсан" биш,
      // зүгээр л бүсээс гадуур байгаа гэсэн үг.
      if (!previous || isFirstFix) return;

      playZoneExitSound();
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Ирц бүртгэх байршлаас гарлаа',
          body: near.distance
            ? `Та бүсээс ~${near.distance}м зайд байна.`
            : 'Та ирц бүртгэх байршлаас гарсан байна.',
          sound: 'default',
          data: { type: 'attendance_zone_exit', screen: 'Attendance' },
          ...(Platform.OS === 'android' ? { channelId: DEFAULT_CHANNEL } : {}),
        },
        trigger: null,
      }).catch(() => {});
    };

    const handle = async (pos, force = false) => {
      if (!active) return;
      const coord = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      const now = Date.now();
      const moved = lastCoord.current ? distanceMeters(lastCoord.current, coord) : Infinity;

      if (force || now - lastUpload.current >= MIN_UPLOAD_MS || moved >= MIN_MOVE_M) {
        lastUpload.current = now;
        lastCoord.current = coord;
        try {
          await sendLocation(currentUser.id, pos);
          // Урьд тогтоосон `background` тугийг хадгална — орлуулбал
          // арын хяналт ажиллаж байхад ч "зөвхөн апп нээлттэй" гэж харагдана.
          setTrackingState?.((prev) => ({ ...prev, active: true, error: null, last: { ...coord, at: now } }));
        } catch (e) {
          // Алдааг харуулах (RLS/сүлжээ) — админ/ажилтан оношилоход тус болно
          setTrackingState?.((prev) => ({ ...prev, active: true, error: e.message, last: { ...coord, at: now } }));
        }
      }

      checkZone(coord);

      // Айлд очсон эсэхийг шалгах
      for (const c of callsRef.current || []) {
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

    // Re-check consent and both permissions on resume without prompting.
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && active) setConsentVersion(v => v + 1);
    });

    return () => {
      active = false;
      appStateSub?.remove?.();
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
    };
  }, [isCloud, currentUser?.id, onShift, shiftStatusReady, consentVersion]);

  return null;
}

import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import * as Location from 'expo-location';
import { useApp } from '../context/AppContext';
import * as tracking from '../services/trackingService';
import * as bgLocation from '../services/backgroundLocationService';
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
  // `calls` нь байнга шинэчлэгддэг. Хэрэв түүнийг useEffect-ийн хамаарал болговол
  // дуудлага өөрчлөгдөх бүрд GPS watcher дахин эхэлж, байршил тасалддаг байв.
  // Тиймээс хамгийн сүүлийн утгыг ref-д хадгалж, effect-ийг нэг л удаа асаана.
  const callsRef = useRef(calls);
  callsRef.current = calls;

  useEffect(() => {
    // Нэвтэрсэн бол БАЙНГА байршил илгээнэ.
    //
    // Өмнө нь `onShift` шалгаж, зөвхөн ирц бүртгүүлснээс явах хүртэл
    // хянадаг байв. Гэвч тэр үед админ ажилтныг ээлжийн гадна огт
    // харахгүй байсан тул шаардлагаар нь байнгын болгов.
    //
    // ⚠️ Үүний үнэ: батерей илүү зарцуулагдана, мөн ажлын бус цагт ч
    //    байршил бүртгэгдэнэ. Ажилтнуудад үүнийг мэдэгдэх ёстой —
    //    Android дээр байнга харагдах мэдэгдэл гарч байгаа нь үүнийг
    //    ил тод болгож байгаа.
    if (!isCloud || !currentUser?.id) {
      bgLocation.stopTracking().catch(() => {});
      setTrackingState?.({ active: false, reason: 'signed-out' });
      return;
    }
    let active = true;

    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted' || !active) {
          setTrackingState?.({ active: false, reason: 'no-permission' });
          return;
        }
        setTrackingState?.({ active: true });

        // Апп хаагдсан/дэлгэц түгжигдсэн ч байршил үргэлжлүүлэхийн тулд
        // OS түвшний арын task бүртгэнэ. watchPositionAsync нь зөвхөн апп
        // нээлттэй байхад ажилладаг тул ганцаараа хангалтгүй.
        bgLocation.startTracking(currentUser).then(async (res) => {
          if (!active) return;
          if (res.ok) {
            setTrackingState?.({ active: true, background: true });
            return;
          }
          setTrackingState?.({ active: true, background: false, reason: res.reason });

          /**
           * "Байнга зөвшөөрөх" дутуу бол ХЭРЭГЛЭГЧИД ХЭЛНЭ.
           *
           * Android 11-ээс хойш үүнийг системийн цонхоор олгох боломжгүй —
           * Тохиргоо руу ороод гараар сонгох ёстой. Сануулахгүй бол апп
           * нээлттэй үед байршил явдаг тул бүх зүйл хэвийн мэт харагдаж,
           * апп хаагдмагц чимээгүй зогсоно.
           *
           * Хоногт нэг удаа л сануулна — эс тэгвээс залхааж, уншихаа болино.
           */
          if (res.reason !== 'no-background-permission') return;
          if (!(await bgLocation.shouldPromptBackgroundPermission())) return;
          if (!active) return;
          await bgLocation.markBackgroundPromptShown();

          Alert.alert(
            'Байршил апп хаагдахад зогсоно',
            bgLocation.trackingProblemText('no-background-permission')
              + '\n\nОдоо апп нээлттэй үед л байршил илгээгдэж байна.',
            [
              { text: 'Дараа', style: 'cancel' },
              { text: 'Тохиргоо нээх', onPress: () => bgLocation.openAppSettings() },
            ]
          );
        });

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
          // Урьд тогтоосон `background` тугийг хадгална — орлуулбал
          // арын хяналт ажиллаж байхад ч "зөвхөн апп нээлттэй" гэж харагдана.
          setTrackingState?.((prev) => ({ ...prev, active: true, error: null, last: { ...coord, at: now } }));
        } catch (e) {
          // Алдааг харуулах (RLS/сүлжээ) — админ/ажилтан оношилоход тус болно
          setTrackingState?.((prev) => ({ ...prev, active: true, error: e.message, last: { ...coord, at: now } }));
        }
      }

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

    /**
     * Тохиргооноос буцаж ирэхэд ДАХИН оролдоно.
     *
     * ⚠️ ЭНЭ ДУТУУ БАЙСАН:
     *   Зөвшөөрлийг зөвхөн нэвтрэх үед НЭГ УДАА шалгадаг байв. Ажилтан
     *   Тохиргоо руу ороод "Байнга зөвшөөрөх" гэж сонгоод буцаж ирэхэд
     *   апп түүнийг мэдэхгүй хэвээр үлдэж, байршил апп хаагдмагц
     *   зогссоор байв. Аппыг бүрэн хааж дахин нээх хүртэл засрахгүй.
     *
     *   Одоо апп идэвхжих бүрд шалгаж, зөвшөөрөл олгогдсон бол ШУУД
     *   арын хяналтыг эхлүүлнэ — хэрэглэгч юу ч хийх шаардлагагүй.
     */
    const appStateSub = AppState.addEventListener('change', async (next) => {
      if (next !== 'active' || !active) return;
      if (await bgLocation.isTracking()) return;

      const res = await bgLocation.startTracking(currentUser);
      if (!active) return;
      if (res.ok) {
        setTrackingState?.((prev) => ({ ...prev, active: true, background: true, reason: null }));
      }
    });

    return () => {
      active = false;
      appStateSub?.remove?.();
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
    };
  }, [isCloud, currentUser?.id]);

  return null;
}

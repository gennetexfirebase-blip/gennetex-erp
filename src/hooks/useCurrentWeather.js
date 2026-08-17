/**
 * Одоогийн цаг агаар — УТСАНЫ БОДИТ GPS байршлаар.
 *
 * ХАРИУЦЛАГА: байршил → fetch → сэргээлт → нөөц зам → алдаа.
 * Харагдац (эможи, температур, tooltip) нь `RealtimeWeather`-т байна.
 *
 * ЯАГААД ӨӨРЧЛӨГДСӨН:
 *   Урьд нь Улаанбаатарын ТОГТМОЛ координат (47.9184, 106.9177) руу
 *   хатуу заасан байсан тул хэрэглэгч хот дотор ч, хөдөө ч явсан
 *   ялгаагүй нэг цэгийн температур харагддаг байв. Одоо утасны GPS-ээс
 *   авсан координатаар асууна.
 *
 * НӨӨЦ ЗАМ (fallback):
 *   1. Төхөөрөмжийн GPS
 *   2. Сүүлд амжилттай авсан координат (кэш, хугацаа хэтрээгүй бол)
 *   3. Улаанбаатарын координат — ЗӨВХӨН дээрх хоёр нь бүтэхгүй үед
 *
 *   ⚠️ GPS зөвшөөрөл өгсөн үед тогтмол координат руу буцахгүй.
 *
 * НУУЦЛАЛ: координатыг зөвхөн энэ төхөөрөмж дээр, цаг агаарын нөөц
 * зориулалтаар кэшлэнэ. Сервер рүү илгээхгүй, хөдөлгөөн хянахгүй.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

/** Цаг агаарыг 10 минут тутам шинэчилнэ. */
export const WEATHER_REFRESH_INTERVAL = 10 * 60 * 1000;
/** Байршлыг 20 минут тутам (болон апп идэвхжихэд) дахин авна. */
export const LOCATION_REFRESH_INTERVAL = 20 * 60 * 1000;

/** Кэшлэсэн координатыг хэр удаан хүчинтэйд тооцох вэ. */
const LOCATION_CACHE_MAX_AGE = 6 * 60 * 60 * 1000; // 6 цаг
const LOCATION_CACHE_KEY = '@gennetex/weather_location_v1';

/** GPS хариу ирэхгүй бол хүлээх дээд хугацаа. */
const LOCATION_TIMEOUT = 10 * 1000;

/** Апп идэвхжихэд дахин дуудахгүй байх доод завсар. */
const FOREGROUND_THROTTLE = 2 * 60 * 1000;

/** GPS ч, кэш ч байхгүй үеийн сүүлчийн арга. */
const FALLBACK = { latitude: 47.9184, longitude: 106.9177, fallback: true };

/** Ойролцоо ч болохгүй нарийвчлал — илүү сайныг нь дахин асууна. */
const POOR_ACCURACY_M = 5000;

const API_BASE = 'https://api.open-meteo.com/v1/forecast';
const CURRENT_FIELDS =
  'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m';

export function weatherUrl(latitude, longitude) {
  return (
    `${API_BASE}?latitude=${latitude}&longitude=${longitude}`
    + `&current=${CURRENT_FIELDS}`
    // `auto` — координатын цагийн бүсийг Open-Meteo өөрөө тодорхойлно.
    + '&timezone=auto'
  );
}

async function readCachedLocation() {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!Number.isFinite(saved?.latitude) || !Number.isFinite(saved?.longitude)) return null;
    // Хэт хуучин байршлаар цаг агаар асуувал буруу хотынхыг харуулна.
    if (!saved.updatedAt || Date.now() - saved.updatedAt > LOCATION_CACHE_MAX_AGE) return null;
    return { latitude: saved.latitude, longitude: saved.longitude, cached: true };
  } catch {
    return null;
  }
}

async function writeCachedLocation(latitude, longitude) {
  try {
    await AsyncStorage.setItem(
      LOCATION_CACHE_KEY,
      JSON.stringify({ latitude, longitude, updatedAt: Date.now() })
    );
  } catch {
    // Кэш бичигдэхгүй байх нь цаг агаарыг зогсоох шалтгаан биш.
  }
}

/** Амлалтыг хугацаагаар хязгаарлана — GPS хариугүй бол мөнхөд хүлээхгүй. */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

/**
 * Байршлыг олох.
 *
 * Эхлээд СҮҮЛД МЭДЭГДЭЖ БУЙ байршлыг авна (шуурхай, батарей хэмнэнэ),
 * тэр нь байхгүй/муу нарийвчлалтай бол шинээр асууна.
 */
async function resolveLocation() {
  try {
    let { status } = await Location.getForegroundPermissionsAsync();
    // Онбординг дээр аль хэдийн асуусан байдаг. Хараахан асуугаагүй
    // тохиолдолд л нэг удаа асууна — дахин дахин цонх гаргахгүй.
    if (status === 'undetermined') {
      ({ status } = await Location.requestForegroundPermissionsAsync());
    }
    if (status !== 'granted') {
      return (await readCachedLocation()) || FALLBACK;
    }

    const last = await Location.getLastKnownPositionAsync({
      maxAge: 5 * 60 * 1000,
      requiredAccuracy: 3000,
    }).catch(() => null);

    if (last?.coords) {
      const { latitude, longitude, accuracy } = last.coords;
      await writeCachedLocation(latitude, longitude);
      // Нарийвчлал муу бол илүү сайныг нь оролдоно (цаг агаарт метр
      // хэрэггүй ч 5 км нь өөр хотод унаж болзошгүй).
      if (Number.isFinite(accuracy) && accuracy > POOR_ACCURACY_M) {
        const better = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
          LOCATION_TIMEOUT
        ).catch(() => null);
        if (better?.coords) {
          await writeCachedLocation(better.coords.latitude, better.coords.longitude);
          return { latitude: better.coords.latitude, longitude: better.coords.longitude };
        }
      }
      return { latitude, longitude };
    }

    const fresh = await withTimeout(
      // `Low` = ~1 км нарийвчлал. Цаг агаарт хангалттай, батарей хэмнэнэ.
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
      LOCATION_TIMEOUT
    ).catch(() => null);

    if (fresh?.coords) {
      await writeCachedLocation(fresh.coords.latitude, fresh.coords.longitude);
      return { latitude: fresh.coords.latitude, longitude: fresh.coords.longitude };
    }

    return (await readCachedLocation()) || FALLBACK;
  } catch {
    // GPS унтарсан, модуль байхгүй, эрх цуцлагдсан — аль нь ч апп унагаахгүй.
    return (await readCachedLocation()) || FALLBACK;
  }
}

export default function useCurrentWeather() {
  const [state, setState] = useState({
    data: null,
    loading: true,
    failed: false,
    /** 'gps' | 'cache' | 'fallback' — tooltip дээр ямар байршил болохыг хэлнэ */
    source: null,
  });

  const alive = useRef(true);
  const coords = useRef(null);
  const coordsAt = useRef(0);
  const lastRun = useRef(0);
  const controller = useRef(null);

  /** Цаг агаарыг татах. `refreshLocation` үнэн бол байршлыг дахин олно. */
  const load = useCallback(async (refreshLocation = false) => {
    lastRun.current = Date.now();

    if (refreshLocation || !coords.current) {
      const found = await resolveLocation();
      if (!alive.current) return;
      coords.current = found;
      coordsAt.current = Date.now();
    }

    const point = coords.current || FALLBACK;

    // Өмнөх хүсэлт дуусаагүй байвал цуцална — давхар хүсэлт үүсгэхгүй.
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;

    try {
      const res = await fetch(weatherUrl(point.latitude, point.longitude), {
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error('weather_unavailable');
      const json = await res.json();
      const current = json?.current;
      if (typeof current?.temperature_2m !== 'number') throw new Error('weather_malformed');
      if (!alive.current) return;

      const num = (v) => (Number.isFinite(v) ? Math.round(v) : null);
      setState({
        loading: false,
        failed: false,
        source: point.fallback ? 'fallback' : point.cached ? 'cache' : 'gps',
        data: {
          temp: Math.round(current.temperature_2m),
          feels: num(current.apparent_temperature),
          humidity: num(current.relative_humidity_2m),
          wind: num(current.wind_speed_10m),
          code: current.weather_code,
        },
      });
    } catch (e) {
      if (e?.name === 'AbortError' || !alive.current) return;
      // Дэлгэрэнгүй алдааг лог руу бичихгүй — эмзэг мэдээлэл, шуугиан үүсгэхгүй.
      // Хуучин утга байвал хэвээр үлдээж, зөвхөн "алдаатай" гэж тэмдэглэнэ.
      setState((s) => ({ ...s, loading: false, failed: !s.data }));
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    load(true);

    const weatherTimer = setInterval(() => load(false), WEATHER_REFRESH_INTERVAL);
    const locationTimer = setInterval(() => load(true), LOCATION_REFRESH_INTERVAL);

    // Апп ар талаас эргэж ирэхэд хэрэглэгч өөр газар очсон байж болно.
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      if (Date.now() - lastRun.current < FOREGROUND_THROTTLE) return;
      load(true);
    });

    return () => {
      alive.current = false;
      clearInterval(weatherTimer);
      clearInterval(locationTimer);
      sub?.remove?.();
      controller.current?.abort();
    };
  }, [load]);

  return {
    ...state,
    /** Гараар дахин оролдох — алдааны дараа дарахад. */
    reload: () => load(true),
  };
}

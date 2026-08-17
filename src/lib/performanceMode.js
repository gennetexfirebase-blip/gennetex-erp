/**
 * Гүйцэтгэлийн горим — сул чадлын утсанд аппыг хөнгөлнө.
 *
 * ЯАГААД:
 *   Galaxy A12 (Helio P35, 3 GB) мэтийн утас S8/S9-ээс 2 дахин удаан.
 *   Тэдгээр дээр видео дуудлагын 720p, царайны өндөр нягтралтай зураг,
 *   урт жагсаалтууд нь гацаа, санах ойн дутагдал үүсгэдэг.
 *
 * ⚠️ ТУСДАА APK БАРИХГҮЙ:
 *   Хоёр өөр APK гаргавал татах хуудас хоёр болж, ажилтан буруугаа
 *   татаж, шинэчлэлт бүрийг хоёр удаа барих шаардлагатай болно. Оронд
 *   нь НЭГ APK доторх горимыг утас өөрөө сонгоно — хэрэглэгч гараар ч
 *   солиж болно (Профайл → Гүйцэтгэл).
 *
 * ТҮВШИН ТОГТООХ:
 *   low  — 4 GB-ээс бага RAM, эсвэл Android 9-өөс доош  → ХӨНГӨН горим
 *   mid  — 6 GB-ээс бага                                → бүрэн, гэхдээ
 *                                                          хэмнэлттэй
 *   high — бусад                                         → бүрэн
 *
 * Жишээ: Galaxy A12 (3-4 GB) → low. Galaxy S8/S9 (4 GB) → low/mid хилийн
 * заагт тул RAM-аас гадна Android хувилбарыг бас харна.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const STORAGE_KEY = '@gennetex/performance_mode_v1';

/** Хэрэглэгчийн сонголт. */
export const MODES = {
  AUTO: 'auto',
  LITE: 'lite',
  FULL: 'full',
};

export const MODE_OPTIONS = [
  { key: MODES.AUTO, label: 'Автомат', desc: 'Утасны чадлаар өөрөө сонгоно' },
  { key: MODES.LITE, label: 'Хөнгөн', desc: 'Хуучин, сул утсанд — гацахгүй байх' },
  { key: MODES.FULL, label: 'Бүрэн', desc: 'Хамгийн сайн чанар, илүү ачаалалтай' },
];

const GB = 1024 * 1024 * 1024;

let tier = 'mid';
let mode = MODES.AUTO;
let ready = false;
const listeners = new Set();

function detectTier() {
  try {
    const ram = Device.totalMemory || 0;
    // Android хувилбарыг тоо болгож авна ("9", "12.0" гэх мэт).
    const os = parseFloat(String(Device.osVersion || '')) || 0;

    if (Platform.OS === 'android' && os > 0 && os < 9) return 'low';
    if (ram > 0 && ram < 4 * GB) return 'low';
    if (ram > 0 && ram < 6 * GB) return 'mid';
    // RAM тодорхойлж чадаагүй бол дунд гэж үзнэ — хэт өөдрөг ч,
    // хэт гутранги ч биш.
    return ram === 0 ? 'mid' : 'high';
  } catch {
    return 'mid';
  }
}

/** Апп эхлэхэд нэг удаа дуудна. */
export async function initPerformanceMode() {
  tier = detectTier();
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved && Object.values(MODES).includes(saved)) mode = saved;
  } catch {
    // Хадгалалт унших боломжгүй бол автомат горимоор ажиллана.
  }
  ready = true;
  emit();
  return { tier, mode, lite: isLite() };
}

function emit() {
  for (const fn of listeners) {
    try {
      fn({ tier, mode, lite: isLite() });
    } catch {}
  }
}

/** Хөнгөн горим идэвхтэй эсэх — синхрон уншина. */
export function isLite() {
  if (mode === MODES.LITE) return true;
  if (mode === MODES.FULL) return false;
  return tier === 'low';
}

export function getPerformanceState() {
  return { tier, mode, lite: isLite(), ready };
}

export async function setPerformanceMode(next) {
  if (!Object.values(MODES).includes(next)) return;
  mode = next;
  emit();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, next);
  } catch {}
}

export function subscribePerformance(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------------------------------------------------------------------------
// Тохируулгын утгууд — нэг дороос уншиж, дэлгэц бүрд тоо тарааж бичихгүй
// ---------------------------------------------------------------------------

/** Видео дуудлагын нягтрал. Хөнгөн горимд 480p/20fps. */
export function videoConstraints() {
  return isLite()
    ? {
        width: { min: 320, ideal: 640 },
        height: { min: 240, ideal: 480 },
        frameRate: { min: 12, ideal: 20 },
      }
    : {
        width: { min: 640, ideal: 1280 },
        height: { min: 480, ideal: 720 },
        frameRate: { min: 15, ideal: 30 },
      };
}

/** Зураг илгээхийн өмнөх шахалт. */
export function imageQuality() {
  return isLite() ? 0.5 : 0.75;
}

/**
 * Урт жагсаалтын тохируулга.
 *
 * `removeClippedSubviews` нь дэлгэцээс гарсан мөрийг санах ойгоос
 * түр гаргана — 3 GB утсан дээр мэдэгдэхүйц ялгаа өгнө.
 */
export function listPerfProps() {
  return isLite()
    ? {
        removeClippedSubviews: true,
        initialNumToRender: 6,
        maxToRenderPerBatch: 6,
        windowSize: 5,
        updateCellsBatchingPeriod: 60,
      }
    : {
        removeClippedSubviews: true,
        initialNumToRender: 10,
        maxToRenderPerBatch: 10,
        windowSize: 11,
      };
}

/** Давтамжтай шинэчлэлтийн интервал (мс). Хөнгөн горимд сийрэгжүүлнэ. */
export function pollInterval(base) {
  return isLite() ? Math.round(base * 2.5) : base;
}

/** Чимэглэлийн хөдөлгөөн (pulse, gradient) ажиллуулах эсэх. */
export function animationsEnabled() {
  return !isLite();
}

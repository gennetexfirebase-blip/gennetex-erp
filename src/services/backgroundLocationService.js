import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as tracking from './trackingService';
import { isExpoGo } from '../lib/runtimeEnv';

/**
 * Арын байршил хянах.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ:
 *   LocationTracker нь `Location.watchPositionAsync` ашигладаг. Тэр нь ЗӨВХӨН
 *   апп нээлттэй байхад ажиллана — дэлгэц түгжих, апп-аас гарахад OS түүнийг
 *   зогсооно. Тиймээс ажилтан утсаа халаасандаа хийхэд байршил тасардаг байв.
 *
 *   Энэ файл нь `Location.startLocationUpdatesAsync`-ийг TaskManager-ийн
 *   task-тай хослуулна. Энэ хослол нь OS түвшинд бүртгэгддэг тул апп хаагдсан
 *   ч, дэлгэц түгжигдсэн ч, утас дахин асаасны дараа ч үргэлжилнэ.
 *
 * ХЯЗГААР — ЭНЭ НЬ ЗАСАГДАХГҮЙ:
 *   Хэрэглэгч Тохиргоо → Апп → "Clear data" хийвэл Android аппыг албадан
 *   зогсоож, бүх хадгалсан өгөгдөл (нэвтрэлт, зөвшөөрөл, энэ task-ийн бүртгэл)
 *   устгана. Ямар ч апп үүнийг тойрч чадахгүй — үүнийг тойрдог програм нь
 *   хортой програм болно. Дараа нь хэрэглэгч дахин нэвтэрч, зөвшөөрлөө дахин
 *   өгөх шаардлагатай.
 */

export const LOCATION_TASK = 'gennetex-background-location';

const USER_KEY = '@bg_location_user';

/** Task дотор React context байхгүй тул хэрэглэгчийг диск дээр хадгална. */
export async function setTrackedUser(user) {
  if (!user?.id) {
    await AsyncStorage.removeItem(USER_KEY);
    return;
  }
  await AsyncStorage.setItem(
    USER_KEY,
    JSON.stringify({ id: user.id, name: user.name || '' })
  );
}

async function getTrackedUser() {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Task тодорхойлолт — модулийн дээд түвшинд, React mount хийхээс ӨМНӨ ажиллана.
// ---------------------------------------------------------------------------
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = data?.locations || [];
  if (!locations.length) return;

  const user = await getTrackedUser();
  if (!user?.id) return;

  // Багц болж ирсэн бол хамгийн сүүлийнх нь одоогийн байрлал
  const last = locations[locations.length - 1];
  const coord = {
    latitude: last.coords.latitude,
    longitude: last.coords.longitude,
  };

  try {
    await tracking.updateMyLocation(user.id, coord);
    await tracking.logLocation({
      userId: user.id,
      userName: user.name,
      ...coord,
      speed: last.coords.speed,
    });
  } catch (e) {
    // Сүлжээгүй үед чимээгүй өнгөрнө — дараагийн байрлал дахин оролдоно
  }
});

/** Арын хяналт аль хэдийн ажиллаж байгаа эсэх. */
export async function isTracking() {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  } catch (e) {
    return false;
  }
}

/**
 * Арын хяналтыг эхлүүлнэ.
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function startTracking(user) {
  if (!user?.id) return { ok: false, reason: 'no-user' };

  // Expo Go дээр арын байршил БОДИТ ТӨХӨӨРӨМЖ дээр ажиллахгүй:
  //   Android — огт байхгүй
  //   iOS     — зөвхөн Simulator дээр ажиллана, жинхэнэ утсан дээр үгүй
  //
  // Зөвшөөрөл асууж хэрэглэгчийг төөрөгдүүлэхээс өмнө шууд хэлнэ — эс
  // тэгвээс "зөвшөөрөл өгсөн мөртлөө байршил шинэчлэгдэхгүй" гэсэн
  // ойлгомжгүй байдал үүснэ.
  if (isExpoGo) {
    return { ok: false, reason: 'expo-go' };
  }

  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { ok: false, reason: 'no-foreground-permission' };

  // Зөвшөөрөл өгсөн ч утасны БАЙРШЛЫН ҮЙЛЧИЛГЭЭ унтраалттай байвал
  // байршил огт ирэхгүй, ямар ч алдаа ч гарахгүй — чимээгүй бүтэлгүйтнэ.
  // Энэ дуудлага нь Android дээр "Байршлыг асаах уу?" гэсэн системийн
  // цонх гаргаж, хэрэглэгч нэг товшилтоор асаах боломж өгнө.
  if (Platform.OS === 'android') {
    try {
      await Location.enableNetworkProviderAsync();
    } catch (e) {
      return { ok: false, reason: 'location-services-off' };
    }
  }

  // Арын зөвшөөрлийг тусад нь асууна. Android 11+ дээр хэрэглэгч үүнийг
  // Тохиргооноос "Байнга зөвшөөрөх" гэж гараар сонгох шаардлагатай.
  let bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    bg = await Location.requestBackgroundPermissionsAsync();
  }
  if (bg.status !== 'granted') return { ok: false, reason: 'no-background-permission' };

  await setTrackedUser(user);

  if (await isTracking()) return { ok: true };

  try {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 15000,
      distanceInterval: 30,
      // Зогссон үед OS түр зогсоовол дахин эхлэхгүй байх эрсдэлтэй
      pausesUpdatesAutomatically: false,
      // Утас дахин асаасны дараа автоматаар сэргэнэ
      ...(Platform.OS === 'android'
        ? {
            // Android 8+ дээр арын байршилд заавал харагдах мэдэгдэл шаардана.
            // Энэ нь хэрэглэгчид хяналт явж байгааг ил тод харуулна.
            foregroundService: {
              notificationTitle: 'Байршил хяналт идэвхтэй',
              notificationBody: 'Ажлын цагт байршлыг админд илгээж байна',
              notificationColor: '#0099db',
              killServiceOnDestroy: false,
            },
          }
        : {
            activityType: Location.ActivityType.AutomotiveNavigation,
            showsBackgroundLocationIndicator: true,
          }),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

/** Арын хяналтыг зогсооно (гарах үед). */
export async function stopTracking() {
  try {
    if (await isTracking()) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch (e) {}
  await setTrackedUser(null);
}

/**
 * Батерейн хэмнэлтийн тохиргоог нээнэ.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ:
 *   Xiaomi, Huawei, Samsung, Oppo зэрэг үйлдвэрлэгчид Android-ын стандарт
 *   дээр НЭМЭЛТ батерей хэмнэлт суулгасан байдаг. Тэдгээр нь дэлгэц унтарсны
 *   дараа хэдхэн минутын дотор арын үйлчилгээг АЛЖ орхидог — зөвшөөрөл
 *   бүрэн өгсөн, foreground service ажиллаж байсан ч.
 *
 *   Үр дүнд нь байршил зөвхөн апп нээлттэй үед шинэчлэгддэг мэт харагдана.
 *   Үүнийг код дотроос шийдэх боломжгүй — хэрэглэгч өөрөө тохиргооноос
 *   энэ аппыг хэмнэлтээс чөлөөлөх ёстой.
 *
 * @returns {Promise<boolean>} тохиргооны цонх нээгдсэн эсэх
 */
export async function openBatterySettings() {
  if (Platform.OS !== 'android') return false;
  try {
    const IntentLauncher = require('expo-intent-launcher');
    const pkg = Application.applicationId || 'com.gennetex.erp';
    // Эхлээд яг энэ аппын батерейн дэлгэцийг нээхийг оролдоно
    await IntentLauncher.startActivityAsync(
      'android.settings.APPLICATION_DETAILS_SETTINGS',
      { data: `package:${pkg}` }
    );
    return true;
  } catch (e) {
    try {
      const IntentLauncher = require('expo-intent-launcher');
      await IntentLauncher.startActivityAsync('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
      return true;
    } catch (err) {
      return false;
    }
  }
}

/** Арын хяналт яагаад ажиллахгүй байгааг хүнд ойлгомжтой хэлнэ. */
export function trackingProblemText(reason) {
  switch (reason) {
    case 'no-foreground-permission':
      return 'Байршлын зөвшөөрөл өгөөгүй байна.';
    case 'no-background-permission':
      return 'Арын байршлын зөвшөөрөл дутуу. Тохиргоо → Байршил → "Байнга зөвшөөрөх" гэж сонгоно уу.';
    case 'location-services-off':
      return 'Утасны байршлын үйлчилгээ унтраалттай байна.';
    case 'expo-go':
      return 'Expo Go дээр арын байршил Android дээр огт ажиллахгүй. Суулгасан апп (APK) ашиглана уу.';
    case 'no-user':
      return 'Нэвтрээгүй байна.';
    default:
      return reason ? `Арын хяналт эхэлсэнгүй: ${reason}` : '';
  }
}

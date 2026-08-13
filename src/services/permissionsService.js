import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Device from 'expo-device';
// Статик импорт. Өмнө нь функц дотор `await import(...)` ашигладаг байсан —
// Metro дээр динамик импорт найдваргүй бөгөөд 'Cannot read property replace
// of undefined' гэсэн алдаа өгдөг байв.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isExpoGo } from '../lib/runtimeEnv';

export const ONBOARDING_KEY = '@gennetex_permissions_onboarded_v1';

async function requestPermission(results, key, request, isGranted) {
  try {
    const response = await request();
    results[key] = isGranted(response);
  } catch (error) {
    results.errors.push(key);
    console.warn(`[permissions] ${key}:`, error?.message || error);
  }
}

// Анх апп нээхэд бүх шаардлагатай зөвшөөрлийг дараалан асууна
export async function requestAllAppPermissions() {
  const results = {
    notifications: false,
    location: false,
    camera: false,
    media: false,
    speech: false,
    errors: [],
    skipped: false,
    // Аль зөвшөөрөл нь ЭНЭ ОРЧИНД зарчмын хувьд боломжгүй болохыг тэмдэглэнэ.
    // Ингэснээр дуудагч тал "хэрэглэгч татгалзсан" гэж андуурахгүй.
    unavailable: [],
  };

  if (Platform.OS === 'web' || !Device.isDevice) {
    results.skipped = true;
    return results;
  }

  // Expo Go дээр алсын push мэдэгдэл SDK 53-аас хойш байхгүй. Зөвшөөрөл асуувал
  // Android дээр амжилтгүй болж, хэрэглэгчид "зөвшөөрөл дутуу" гэсэн буруу
  // мессеж харагддаг байв — үнэндээ тэр нь Expo Go-гийн хязгаар, хэрэглэгчийн
  // буруу биш. Тиймээс энд боломжгүй гэж тэмдэглээд шаардлагаас чөлөөлнө.
  if (isExpoGo && Platform.OS === 'android') {
    results.notifications = true;
    results.unavailable.push('notifications');
  } else {
    await requestPermission(
      results,
      'notifications',
      async () => {
        const current = await Notifications.getPermissionsAsync();
        return current.status === 'granted'
          ? current
          : Notifications.requestPermissionsAsync();
      },
      (permission) => permission?.status === 'granted'
    );
  }

  await requestPermission(
    results,
    'location',
    async () => {
      const current = await Location.getForegroundPermissionsAsync();
      return current.status === 'granted'
        ? current
        : Location.requestForegroundPermissionsAsync();
    },
    (permission) => permission?.status === 'granted'
  );

  await requestPermission(
    results,
    'camera',
    () => Camera.requestCameraPermissionsAsync(),
    (permission) => permission?.status === 'granted'
  );

  await requestPermission(
    results,
    'media',
    () => ImagePicker.requestMediaLibraryPermissionsAsync(),
    (permission) => permission?.granted === true
  );

  // expo-speech-recognition нь native модуль тул Expo Go-д ачаалагдахгүй.
  // Асуухыг оролдвол алдаа шидэж, "зөвшөөрөл дутуу" гэсэн буруу дүгнэлт өгдөг.
  if (isExpoGo) {
    results.speech = true;
    results.unavailable.push('speech');
  } else {
    await requestPermission(
      results,
      'speech',
      async () => {
        const { ExpoSpeechRecognitionModule } = await import('expo-speech-recognition');
        return ExpoSpeechRecognitionModule.requestPermissionsAsync();
      },
      (permission) => permission?.granted === true
    );
  }

  return results;
}

export async function isOnboardingComplete() {
  return (await AsyncStorage.getItem(ONBOARDING_KEY)) === '1';
}

export async function markOnboardingComplete() {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
}

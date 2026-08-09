import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Device from 'expo-device';

export const ONBOARDING_KEY = '@gennetex_permissions_onboarded_v1';

// Анх апп нээхэд бүх шаардлагатай зөвшөөрлийг дараалан асууна
export async function requestAllAppPermissions() {
  const results = { notifications: false, location: false, camera: false, media: false, speech: false };

  if (Platform.OS === 'web' || !Device.isDevice) return results;

  const { status: n0 } = await Notifications.getPermissionsAsync();
  let nStatus = n0;
  if (n0 !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    nStatus = status;
  }
  results.notifications = nStatus === 'granted';

  const { status: l0 } = await Location.getForegroundPermissionsAsync();
  let lStatus = l0;
  if (l0 !== 'granted') {
    const { status } = await Location.requestForegroundPermissionsAsync();
    lStatus = status;
  }
  results.location = lStatus === 'granted';

  const cam = await Camera.requestCameraPermissionsAsync();
  results.camera = cam.status === 'granted';

  const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
  results.media = media.granted;

  try {
    const { ExpoSpeechRecognitionModule } = await import('expo-speech-recognition');
    const speech = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    results.speech = speech.granted;
  } catch (e) {
    results.speech = false;
  }

  return results;
}

export async function isOnboardingComplete() {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  return (await AsyncStorage.getItem(ONBOARDING_KEY)) === '1';
}

export async function markOnboardingComplete() {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
}

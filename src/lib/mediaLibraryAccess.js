import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * Зургийн сангаас сонгохын өмнөх зөвшөөрөл.
 *
 * ⚠️ Google Play `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO`-г хүссэн
 *    хувилбарыг татгалздаг (photo/video permissions policy) — тиймээс
 *    app.json-оос хассан. Android дээр `launchImageLibraryAsync` нь
 *    системийн photo picker нээдэг бөгөөд ЯМАР Ч зөвшөөрөл шаардахгүй.
 *    Харин `requestMediaLibraryPermissionsAsync` зөвшөөрөлгүй манифест
 *    дээр «татгалзсан» буцааж, зураг сонгох бүх урсгалыг зогсооно.
 *    iOS дээр зөвшөөрөл хэвээр хэрэгтэй.
 */
export function requestLibraryAccess() {
  if (Platform.OS === 'android') return Promise.resolve({ granted: true, status: 'granted', canAskAgain: true });
  return ImagePicker.requestMediaLibraryPermissionsAsync();
}

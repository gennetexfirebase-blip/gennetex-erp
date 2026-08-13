import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Ажиллаж буй орчныг тодорхойлно.
 *
 * Энэ шалгалт өмнө нь ScreenLiveShare.js болон notificationService.js дотор
 * тус тусад нь давхардаж бичигдсэн байсан. Нэг газар төвлөрүүлснээр шинэ
 * хязгаарлалт гарахад нэг л газар засна.
 */

/**
 * Expo Go дээр ажиллаж байна уу?
 *
 * Expo Go нь урьдчилан суулгасан ТОГТМОЛ багц native модультой ирдэг тул
 * төслийн өөрийн native модулиудыг (ML Kit, ONNX Runtime, Firebase,
 * remote push) ачаалж чадахгүй. Тиймээс тэдгээрийг шаарддаг боломжуудыг
 * энд шалгаж, зөөлөн унагах ёстой — алдаа шидэх биш.
 */
export const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

/** Жинхэнэ төхөөрөмж дээр үү, эсвэл симулятор/вэб дээр үү. */
export const isSimulatorOrWeb = Platform.OS === 'web';

/**
 * Алсын (remote) push мэдэгдэл боломжтой эсэх.
 * Expo Go-оос SDK 53-аас хойш хасагдсан.
 */
export const canUseRemotePush = !isExpoGo && Platform.OS !== 'web';

/** Төслийн өөрийн native модулиуд ачаалагдах боломжтой эсэх. */
export const canUseNativeModules = !isExpoGo && Platform.OS !== 'web';

/**
 * Native модуль байгаа эсэхийг ХОЁР АРХИТЕКТУРТ зөв шалгана.
 *
 * АЛДАА ГАРСАН ТҮҮХ:
 *   Төсөл шинэ архитектур дээр ажилладаг (`newArchEnabled=true`,
 *   android/gradle.properties). Тэнд native модулиуд TurboModule болж
 *   бүртгэгддэг тул ХУУЧИН `NativeModules` бүртгэлд харагдахаа болино.
 *
 *   Үүнээс болж APK дотор native сан нь бүрэн байсаар атал апп нь
 *   "модуль байхгүй" гэж андуурч, дуудлага болон царай таних зэрэг
 *   боломжийг хаачихаж байв (`libjingle_peerconnection_so.so`,
 *   `libonnxruntime.so` хоёул APK дотор байгаа нь батлагдсан).
 *
 * ЭНД ЮУ ХИЙХ ВЭ:
 *   Эхлээд хуучин бүртгэлээс, дараа нь TurboModule бүртгэлээс хайна.
 *   `TurboModuleRegistry.get` нь олдохгүй бол `null` буцаадаг (алдаа
 *   шиднэ гэхгүй) тул Expo Go дээр ч аюулгүй — тэнд зүгээр л `false`.
 *
 * ⚠️ Модулийг `require` хийж ШАЛГАХГҮЙ: onnxruntime-react-native нь
 *    import хийх үедээ `install()` дуудаж, native хэсэггүй орчинд
 *    аппыг унагаадаг.
 */
import { NativeModules, TurboModuleRegistry } from 'react-native';

export function hasNativeModule(name) {
  try {
    if (NativeModules?.[name]) return true;
  } catch {
    // NativeModules proxy нь зарим тохиолдолд алдаа шиднэ
  }
  try {
    return !!TurboModuleRegistry?.get?.(name);
  } catch {
    return false;
  }
}

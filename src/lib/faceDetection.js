import React from 'react';
import { isExpoGo } from './runtimeEnv';

/**
 * ML Kit царай илрүүлэлт — Expo Go-д БАЙХГҮЙ.
 *
 * ⚠️ ЯАГААД `try/catch` ГАНЦААРАА ХАНГАЛТГҮЙ ВЭ:
 *   `@infinitered/react-native-mlkit-face-detection` нь Expo Modules API
 *   дээр суурилдаг. `require` нь АМЖИЛТТАЙ болдог (JS хэсэг нь ачаалагдана),
 *   харин native модулийг зөвхөн provider RENDER хийгдэх / hook ДУУДАГДАХ
 *   үед хайдаг. Тэр мөчид Expo Go дээр:
 *
 *     Invariant Violation: Your JavaScript code tried to access a native
 *     module that doesn't exist.
 *
 *   гэж унадаг — import-ийн үеийн try/catch үүнийг барихгүй. `SiteVisitVerifier`
 *   нь App.js дотор байнга суудаг тул апп Expo Go дээр эхлэнгүүтээ л
 *   энэ алдаа гарч байв.
 *
 * ШИЙДЭЛ: Expo Go бол native хэсэгт ОГТ хүрэхгүй — хоосон provider,
 *   `null` буцаадаг hook ашиглана. APK / development build дээр жинхэнэ
 *   ML Kit ажиллана.
 */
let NativeFaceDetectionProvider = ({ children }) => children;
let useNativeFaceDetection = () => null;

if (!isExpoGo) {
  try {
    const nativeFaceDetection = require('@infinitered/react-native-mlkit-face-detection');
    NativeFaceDetectionProvider = nativeFaceDetection.FaceDetectionProvider;
    useNativeFaceDetection = nativeFaceDetection.useFaceDetection;
  } catch (_error) {
    // faceService нь дуудагдах үедээ "APK ашиглана уу" гэсэн мессеж өгнө.
  }
}

export function FaceDetectionProvider(props) {
  return <NativeFaceDetectionProvider {...props} />;
}

export function useFaceDetection() {
  return useNativeFaceDetection();
}

/**
 * app.json owns the native config and plugin list for both local prebuild and EAS.
 * Config plugins do not load native modules into Expo Go.
 */
const fs = require('fs');
const path = require('path');

const androidGoogleServices = process.env.GOOGLE_SERVICES_JSON || './google-services.json';
// EAS дээр file төрлийн env хувьсагчаар өгч болно (android-тай адил).
const iosGoogleServices = process.env.GOOGLE_SERVICE_INFO_PLIST || './GoogleService-Info.plist';

/**
 * Газрын зураг — OpenStreetMap.
 *
 * ⚠️ 2026-08-27: Google Maps-аас БҮРЭН татгалзав.
 *
 *    Google Maps SDK нь Android дээр `com.google.android.geo.API_KEY`
 *    meta-data ЗААВАЛ шаарддаг бөгөөд байхгүй үед натив талдаа
 *    `IllegalStateException: API key not found` шидэж бүтэн аппыг
 *    унагаадаг. Ирц дэлгэц газрын зурагтай тул тэр дэлгэц рүү орох
 *    бүрд апп хаагддаг байв. Түүнчлэн уг түлхүүр нь биллинг холбосон
 *    төлбөртэй данс шаарддаг.
 *
 *    Одоо `src/components/Map.js` нь OpenStreetMap-ийг WebView (Leaflet)
 *    дотор зурдаг тул ЯМАР Ч түлхүүр шаардахгүй бөгөөд натив газрын
 *    зургийн крэш бүрмөсөн арилав.
 */

module.exports = ({ config }) => {
  return {
    ...config,
    /**
     * AI түлхүүрүүд.
     *
     * ⚠️ ЭНЭ ДУТУУ БАЙСАН: `gennetexAiService` нь түлхүүрээ
     *    `Constants.expoConfig.extra.geminiApiKey`-ээс уншдаг ч түүнийг
     *    хаанаас ч бөглөдөггүй байсан тул үргэлж `undefined` буцаж,
     *    "AI тохируулаагүй байна" гэсэн алдаа гардаг байв.
     *
     * ⚠️ НУУЦЛАЛЫН АНХААРУУЛГА: `extra` ч, `EXPO_PUBLIC_*` ч хоёулаа
     *    APK дотор ИЛ үлддэг. Задалсан хүн түлхүүрийг олж чадна.
     *    Урт хугацаанд Gemini дуудлагыг Edge Function-оор дамжуулж,
     *    түлхүүрийг зөвхөн серверт байлгах нь зөв.
     */
    extra: {
      ...(config.extra || {}),
      geminiApiKey:
        process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || undefined,
      youtubeApiKey:
        process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || config.extra?.youtubeApiKey || undefined,
    },
    android: {
      ...config.android,
      googleServicesFile: androidGoogleServices,
    },
    ios: {
      ...config.ios,
      ...(fs.existsSync(path.resolve(__dirname, iosGoogleServices)) ? { googleServicesFile: iosGoogleServices } : {}),
    },
  };
};

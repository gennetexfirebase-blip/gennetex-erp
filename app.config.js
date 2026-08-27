/**
 * Expo Go: native-only plugin-уудыг хасна.
 * APK / EAS build: бүх plugin идэвхтэй.
 */
const fs = require('fs');

const isNativeBuild =
  !!process.env.EAS_BUILD ||
  process.env.EXPO_USE_DEV_CLIENT === '1' ||
  process.env.NODE_ENV === 'production';

/**
 * Expo Go-д ачаалагдахгүй plugin-ууд.
 *
 * ⚠️ `react-native-full-screen-notification-incoming-call`-ийг ЭНДЭЭС ХАСЛАА:
 *    Тэр plugin нь `IncomingCallActivity` зэргийг AndroidManifest-д нэмдэг.
 *    Шүүгдэж хаягдсан үед `android/` үүссэн тул манифестэд огт ороогүй бөгөөд
 *    ирэх дуудлагын БҮТЭН ДЭЛГЭЦ хэзээ ч гардаггүй байв.
 *
 *    Config plugin нь зөвхөн prebuild үед native төслийг өөрчилдөг — Expo Go
 *    түүнийг ашигладаггүй тул жагсаалтад үлдээх шаардлагагүй.
 */
const NATIVE_ONLY_PLUGINS = new Set([
  'expo-dev-client',
]);

const androidGoogleServices = './google-services.json';
const iosGoogleServices = './GoogleService-Info.plist';

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
  const plugins = (config.plugins || []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return !NATIVE_ONLY_PLUGINS.has(name) || isNativeBuild;
  });

  if (isNativeBuild) {
    plugins.push('@react-native-firebase/app', '@react-native-firebase/messaging');
  }

  return {
    ...config,
    plugins,
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
      ...(fs.existsSync(androidGoogleServices) ? { googleServicesFile: androidGoogleServices } : {}),
    },
    ios: {
      ...config.ios,
      ...(fs.existsSync(iosGoogleServices) ? { googleServicesFile: iosGoogleServices } : {}),
    },
  };
};

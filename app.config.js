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
 * Google Maps түлхүүр.
 *
 * ⚠️ ӨМНӨ НЬ `app.json` дотор `AIzaSyAOVY…3lLao` гэж ХАТУУ бичигдсэн байв.
 *    Тэр нь Google өөрийн баримт бичигтээ жишээ болгон нийтэлсэн ОЛОН
 *    НИЙТИЙН түлхүүр — мянга мянган төсөл түүнийг хуулсан бөгөөд танай
 *    төслийн Android аппад ажиллахгүй (Maps SDK нь түлхүүрийг
 *    аппын SHA-1 гарын үсэгтэй уядаг). Тиймээс газрын зураг хоосон саарал
 *    дэлгэц болж харагдана.
 *
 * ЗӨВ ЗАМ:
 *   Google Cloud Console → APIs & Services → Credentials → API key үүсгээд
 *   заавал ХЯЗГААРЛАНА:
 *     Android — package `com.gennetex.erp` + release SHA-1
 *     iOS     — bundle id `com.gennetex.erp`
 *   Дараа нь `.env` дотор:
 *     EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
 *
 * Түлхүүр нь аппын багц дотор ил үлддэг (үүнээс зайлсхийх боломжгүй) тул
 * дээрх хязгаарлалт нь цорын ганц бодит хамгаалалт юм.
 */
const mapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

if (!mapsApiKey && process.env.EAS_BUILD) {
  // Build-ийг зогсоохгүй — газрын зураггүйгээр аппын бусад хэсэг ажиллана.
  console.warn(
    '[app.config] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY тохируулаагүй байна — ' +
      'Android дээр газрын зураг хоосон харагдана.'
  );
}

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
      ...(mapsApiKey ? { config: { ...(config.android?.config || {}), googleMaps: { apiKey: mapsApiKey } } } : {}),
    },
    ios: {
      ...config.ios,
      ...(fs.existsSync(iosGoogleServices) ? { googleServicesFile: iosGoogleServices } : {}),
      ...(mapsApiKey ? { config: { ...(config.ios?.config || {}), googleMapsApiKey: mapsApiKey } } : {}),
    },
  };
};

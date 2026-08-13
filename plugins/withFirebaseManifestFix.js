const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

/**
 * expo-notifications ↔ react-native-firebase/messaging манифест мөргөлдөөн.
 *
 * АСУУДАЛ:
 *   Хоёр сан ижил meta-data-г ӨӨР утгаар зарладаг:
 *
 *     default_notification_channel_id
 *       expo-notifications        → "default"
 *       react-native-firebase     → "" (хоосон)
 *
 *     default_notification_color
 *       expo-notifications        → @color/notification_icon_color
 *       react-native-firebase     → @color/white
 *
 *   Gradle-ийн manifest merger аль нь зөв болохыг мэдэхгүй тул build-ыг
 *   зогсооно:
 *     "Execution failed for task ':app:processDebugMainManifest'"
 *
 * ШИЙДЭЛ:
 *   `tools:replace` тавьж "манай утга давамгайлна" гэж хэлнэ. Бид
 *   expo-notifications-ийн утгыг сонгов — мэдэгдлийн суваг болон өнгө нь
 *   app.json дотор тодорхойлогдсон бөгөөд брэндийн өнгөтэй (#0099db).
 *   react-native-firebase-ийн анхдагч цагаан өнгө нь цагаан дэвсгэр дээр
 *   огт харагдахгүй болно.
 *
 * ЯАГААД CONFIG PLUGIN ВЭ:
 *   `android/` фолдер нь generated (gitignore-д). AndroidManifest.xml-ийг
 *   гараар засвал дараагийн `expo prebuild` дээр устана. Plugin нь
 *   prebuild бүрд дахин хэрэгжинэ.
 *
 * ⚠️ ДАРААЛАЛ: app.json-ы plugins массивт энэ нь ХАМГИЙН ЭХЭНД байх ёстой.
 *    Expo-гийн mod-ууд УРВУУ дарааллаар ажилладаг — жагсаалтын сүүлийн
 *    plugin хамгийн түрүүнд гүйцэтгэгддэг. Сүүлд нь тавьсан үед манай
 *    код expo-notifications-ийн meta-data үүсэхээс ӨМНӨ ажиллаж, засах
 *    зүйлээ олохгүй байв (шалгасан: meta-data count = 4, Firebase-ийнх алга).
 */

/** Аль meta-data-д ямар атрибут давамгайлахыг зааж өгөх вэ. */
const OVERRIDES = {
  'com.google.firebase.messaging.default_notification_channel_id': 'android:value',
  'com.google.firebase.messaging.default_notification_color': 'android:resource',
  'com.google.firebase.messaging.default_notification_icon': 'android:resource',
};

module.exports = function withFirebaseManifestFix(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;

    // `tools:` namespace байхгүй бол tools:replace зүгээр л үл мэдэгдэх
    // атрибут болж, мөргөлдөөн хэвээр үлдэнэ.
    manifest.manifest.$ = manifest.manifest.$ || {};
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    app['meta-data'] = app['meta-data'] || [];

    for (const item of app['meta-data']) {
      const name = item?.$?.['android:name'];
      const attr = OVERRIDES[name];
      if (!attr) continue;

      // Тухайн атрибут үнэхээр байгаа үед л replace зарлана — байхгүй
      // атрибутыг орлуулахыг оролдвол merger дахин алдаа өгнө.
      if (item.$[attr] === undefined) continue;

      const existing = item.$['tools:replace'];
      const parts = new Set(
        (existing ? String(existing).split(',') : []).map((s) => s.trim()).filter(Boolean)
      );
      parts.add(attr);
      item.$['tools:replace'] = [...parts].join(',');
    }

    return cfg;
  });
};

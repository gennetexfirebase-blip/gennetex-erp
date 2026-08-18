const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

/**
 * Ирэх дуудлагын бүтэн дэлгэцийн манифест бүртгэл.
 *
 * ЯАГААД PLUGIN ВЭ:
 *   `android/` фолдер нь generated бөгөөд .gitignore-д байдаг. Эдгээр
 *   бүртгэлийг гараар нэмсэн байсан тул дараагийн `expo prebuild` дээр
 *   чимээгүй устаж, дуудлагын дэлгэц дахин ажиллахаа болино. Мөн шинэ
 *   хүн repo-г clone хийвэл android/ огт байхгүй тул гар засвар нь
 *   дамжихгүй.
 *
 * ЮУ ЗАРЛАЖ БАЙГАА ВЭ:
 *
 *   IncomingCallActivity — бүтэн дэлгэцийн дуудлагын цонх.
 *     showWhenLocked / turnScreenOn нь түгжээтэй дэлгэц дээр гарч,
 *     дэлгэцийг асаана. Үүнгүйгээр түгжээтэй үед юу ч харагдахгүй.
 *
 *   NotificationReceiverActivity — мэдэгдэл дээрх товчны хариу.
 *     exported=true байх ёстой — системийн мэдэгдлээс дуудагдана.
 *
 *   IncomingCallService — мэдэгдлийг гаргадаг foreground service.
 *     ⚠️ `foregroundServiceType="phoneCall"` ЗААВАЛ хэрэгтэй. Service нь
 *     дотроо `startForeground(..., FOREGROUND_SERVICE_TYPE_PHONE_CALL)`
 *     дууддаг бөгөөд Android 14 (API 34)-өөс хойш манифестэд тэр
 *     төрлийг зарлаагүй бол систем алдаа шидэж, service ОГТ эхлэхгүй.
 *     Энэ шинж чанар дутуу байсан нь дуудлагын дэлгэц гарахгүй байсны
 *     нэг шалтгаан байв.
 */

const PKG = 'com.reactnativefullscreennotificationincomingcall';

module.exports = function withIncomingCallManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    app.activity = app.activity || [];
    app.service = app.service || [];

    upsert(app.activity, `${PKG}.IncomingCallActivity`, {
      'android:name': `${PKG}.IncomingCallActivity`,
      'android:launchMode': 'singleTask',
      'android:excludeFromRecents': 'true',
      'android:showWhenLocked': 'true',
      'android:turnScreenOn': 'true',
      'android:exported': 'false',
    });

    upsert(app.activity, `${PKG}.NotificationReceiverActivity`, {
      'android:name': `${PKG}.NotificationReceiverActivity`,
      'android:launchMode': 'singleTask',
      'android:excludeFromRecents': 'true',
      'android:exported': 'true',
    });

    upsert(app.service, `${PKG}.IncomingCallService`, {
      'android:name': `${PKG}.IncomingCallService`,
      'android:foregroundServiceType': 'phoneCall',
      'android:exported': 'false',
    });

    return cfg;
  });
};

/**
 * Байгаа бол атрибутыг нь шинэчилнэ, байхгүй бол нэмнэ.
 *
 * Давхардуулж нэмбэл manifest merger алдаа өгнө — тиймээс нэрээр нь
 * эхлээд хайна.
 */
function upsert(list, name, attrs) {
  const existing = list.find((item) => item?.$?.['android:name'] === name);
  if (existing) {
    existing.$ = { ...existing.$, ...attrs };
    return;
  }
  list.push({ $: attrs });
}

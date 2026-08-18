#!/usr/bin/env node
/**
 * react-native-full-screen-notification-incoming-call — RN 0.81 compile fix.
 * EAS build дээр npm install-ийн дараа автоматаар ажиллана.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '../node_modules/react-native-full-screen-notification-incoming-call/android/src/main/java/com/reactnativefullscreennotificationincomingcall/IncomingCallActivity.java'
);

const MARKER = '// RN 0.81+ compatible incoming call UI';
const SERVICE_MARKER = '// gennetex: safe foreground service start';
const COLOR_MARKER = '// gennetex: crash-proof color lookup';
const RINGTONE_MARKER = '// gennetex: ringtone audio stream';

// Засвар БҮРИЙГ тусад нь ажиллуулна. Урьд нь эхний засвар хийгдсэн бол
// `process.exit(0)` хийж, дараагийнх руу ХҮРДЭГГҮЙ байсан — шинэ засвар
// нэмэхэд чимээгүй алгасагдана.
patchActivity();
patchModuleStartService();
patchServiceColorLookup();
patchRingtoneStream();

function patchActivity() {
  if (!fs.existsSync(file)) {
    console.log('[patch-incoming-call] library not installed, skip');
    return;
  }

  let src = fs.readFileSync(file, 'utf8');
  if (src.includes(MARKER)) {
    console.log('[patch-incoming-call] activity already patched');
    return;
  }

  const oldBlock = `    if (bundle.containsKey("mainComponent") && bundle.getString("mainComponent") != null) {
      String mainComponent = bundle.getString("mainComponent");
      setContentView(R.layout.custom_ingcoming_call_rn);
      Fragment reactNativeFragment = new ReactFragment.Builder()
        .setComponentName(mainComponent)
        .setLaunchOptions(bundle)
        .build();

      getSupportFragmentManager()
        .beginTransaction()
        .add(R.id.reactNativeFragment, reactNativeFragment)
        .commit();
      return;
    } else {
      setContentView(R.layout.activity_call_incoming);
    }`;

  const newBlock = `    ${MARKER}
    setContentView(R.layout.activity_call_incoming);`;

  if (!src.includes('setComponentName(mainComponent)')) {
    console.log('[patch-incoming-call] pattern not found, skip');
    return;
  }

  src = src.replace(oldBlock, newBlock);
  fs.writeFileSync(file, src);
  console.log('[patch-incoming-call] patched IncomingCallActivity.java');
}

/**
 * `startService` → `startForegroundService` (Android 8+).
 *
 * ⚠️ ЯАГААД ДУУДЛАГЫН ДЭЛГЭЦ ГАРДАГГҮЙ БАЙСАН БЭ:
 *    Сан нь `getReactApplicationContext().startService(intent)` гэж
 *    дууддаг. Android 8 (API 26)-аас хойш апп АРД байхад энгийн
 *    `startService`-ийг дуудвал систем `IllegalStateException: Not
 *    allowed to start service ... app is in background` шиднэ.
 *
 *    Яг тэр үед — утас түгжээтэй, апп хаагдсан үед — дуудлагын дэлгэц
 *    хэрэгтэй байдаг. Тиймээс дэлгэц ХЭЗЭЭ Ч гардаггүй байв.
 *
 *    `IncomingCallService` нь дотроо `startForeground(...)`-ыг
 *    FOREGROUND_SERVICE_TYPE_PHONE_CALL-тай дууддаг тул
 *    `startForegroundService`-ээр эхлүүлэх нь зөв бөгөөд аюулгүй.
 *
 *    Өндөр ач холбогдолтой (high priority) FCM мессеж ирэхэд Android
 *    аппад богино хугацааны зөвшөөрөл өгдөг тул ард байхад ч
 *    foreground service эхлүүлэх боломжтой. Манай дуудлагын push нь
 *    аль хэдийн `priority: 'high'` бөгөөд data-only.
 */
function patchModuleStartService() {
  const moduleFile = path.join(
    __dirname,
    '../node_modules/react-native-full-screen-notification-incoming-call/android/src/main/java/com/reactnativefullscreennotificationincomingcall/FullScreenNotificationIncomingCallModule.java'
  );
  if (!fs.existsSync(moduleFile)) {
    console.log('[patch-incoming-call] module file missing, skip');
    return;
  }

  let mod = fs.readFileSync(moduleFile, 'utf8');
  if (mod.includes(SERVICE_MARKER)) {
    console.log('[patch-incoming-call] service start already patched');
    return;
  }

  // Анхны эх код, эсвэл энэ script-ийн ӨМНӨХ хувилбарын гаргасан блок —
  // хоёуланг таньж, шинэ аюулгүй хувилбараар солино.
  const original = '    getReactApplicationContext().startService(intent);';
  const previous = `    // Android 8+ дээр апп ард байхад энгийн startService хориотой.
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
      getReactApplicationContext().startForegroundService(intent);
    } else {
      getReactApplicationContext().startService(intent);
    }`;

  let target = null;
  if (mod.includes(previous)) target = previous;
  else if (mod.includes(original)) target = original;

  if (!target) {
    console.log('[patch-incoming-call] startService pattern not found, skip');
    return;
  }

  const replacement = `    ${SERVICE_MARKER}
    //
    // Android 8 (API 26)+ : апп АРД байхад энгийн startService хориотой.
    // Android 12 (API 31)+: startForegroundService НЬ Ч мөн ард байхад
    //   хориотой — ForegroundServiceStartNotAllowedException шиднэ.
    //
    // Жинхэнэ дуудлагын үед энэ нь асуудалгүй: өндөр ач холбогдолтой
    // (high priority) FCM мессеж ирэхэд Android аппад богино хугацааны
    // чөлөөлөлт өгдөг тул foreground service эхлүүлэхийг зөвшөөрнө.
    //
    // Харин апп ард байхад ГАРААР дуудвал (жишээ нь оношилгооны тест)
    // чөлөөлөлт байхгүй тул систем exception шиднэ. Түүнийг бариагүй
    // бол процесс бүхэлдээ УНАНА. Тиймээс энд заавал барина.
    try {
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
        getReactApplicationContext().startForegroundService(intent);
      } else {
        getReactApplicationContext().startService(intent);
      }
    } catch (Exception e) {
      Log.w(TAG, "displayNotification: could not start service", e);
      // Апп урд талд байвал энгийн startService ажиллаж магадгүй.
      try {
        getReactApplicationContext().startService(intent);
      } catch (Exception ignored) {
        Log.w(TAG, "displayNotification: fallback startService failed", ignored);
      }
    }`;

  mod = mod.replace(target, replacement);
  fs.writeFileSync(moduleFile, mod);
  console.log('[patch-incoming-call] patched FullScreenNotificationIncomingCallModule.java');
}

/**
 * `getColorForResourceName` нь өнгө олдохгүй үед аппыг унагадаг.
 *
 * ⚠️ ЭНЭ НЬ ДУУДЛАГЫН ДЭЛГЭЦ ГАРАХГҮЙ БАЙСНЫ ЖИНХЭНЭ ШАЛТГААН БАЙВ:
 *
 *   int colorId = res.getIdentifier(colorPath, "color", packageName);
 *   int desiredColor = ContextCompat.getColor(context, colorId);
 *
 * Нэр олдохгүй бол `getIdentifier` нь 0 буцаана. `getColor(0)` нь
 * `Resources$NotFoundException: Resource ID #0x0` шидэж, IncomingCallService
 * бүхэлдээ унана — мэдэгдэл ч, бүтэн дэлгэц ч гарахгүй, апп "stopped"
 * болно. Утасны logcat-аас баталсан.
 *
 * Дуудлагын дэлгэцийн ӨНГӨ нь чухал зүйл биш — түүнээс болж бүх зүйл
 * унах ёсгүй. Тиймээс:
 *   • hex код (#RRGGBB) өгсөн бол шууд задалж авна
 *   • resource нэр олдвол түүнийг ашиглана
 *   • аль нь ч болохгүй бол өнгө тавихгүй өнгөрнө
 */
function patchServiceColorLookup() {
  const serviceFile = path.join(
    __dirname,
    '../node_modules/react-native-full-screen-notification-incoming-call/android/src/main/java/com/reactnativefullscreennotificationincomingcall/IncomingCallService.java'
  );
  if (!fs.existsSync(serviceFile)) {
    console.log('[patch-incoming-call] service file missing, skip');
    return;
  }

  let src = fs.readFileSync(serviceFile, 'utf8');
  if (src.includes(COLOR_MARKER)) {
    console.log('[patch-incoming-call] color lookup already patched');
    return;
  }

  const original = `  private int getColorForResourceName(Context context, String colorPath) {
    // java
    Resources res = context.getResources();
    String packageName = context.getPackageName();

    int colorId = res.getIdentifier(colorPath, "color", packageName);
    int desiredColor = ContextCompat.getColor(context, colorId);

    return desiredColor;
  }`;

  if (!src.includes(original)) {
    console.log('[patch-incoming-call] color lookup pattern not found, skip');
    return;
  }

  const replacement = `  ${COLOR_MARKER}
  // 0 = "олдсонгүй". getColor(0) нь Resources$NotFoundException шидэж
  // аппыг унагадаг тул хэзээ ч тэр рүү оруулж болохгүй.
  private int getColorForResourceName(Context context, String colorPath) {
    if (colorPath == null) {
      return 0;
    }

    // "#RRGGBB" хэлбэрээр өгсөн бол шууд задална.
    if (colorPath.startsWith("#")) {
      try {
        return android.graphics.Color.parseColor(colorPath);
      } catch (IllegalArgumentException e) {
        return 0;
      }
    }

    Resources res = context.getResources();
    String packageName = context.getPackageName();
    int colorId = res.getIdentifier(colorPath, "color", packageName);
    if (colorId == 0) {
      return 0;
    }

    try {
      return ContextCompat.getColor(context, colorId);
    } catch (Resources.NotFoundException e) {
      return 0;
    }
  }`;

  src = src.replace(original, replacement);

  // Өнгө 0 (олдсонгүй) бол setColor огт дуудахгүй.
  const applyOld = `    String notificationColor = bundle.getString("notificationColor");
    if (notificationColor != null) {
      notificationBuilder.setColor(getColorForResourceName(context, notificationColor));
    }`;
  const applyNew = `    String notificationColor = bundle.getString("notificationColor");
    if (notificationColor != null) {
      int resolved = getColorForResourceName(context, notificationColor);
      if (resolved != 0) {
        notificationBuilder.setColor(resolved);
      }
    }`;
  if (src.includes(applyOld)) {
    src = src.replace(applyOld, applyNew);
  }

  fs.writeFileSync(serviceFile, src);
  console.log('[patch-incoming-call] patched IncomingCallService.java color lookup');
}

/**
 * Дуудлагын хонхыг МЭДЭГДЛИЙН биш, ХОНХНЫ дууны урсгал дээр тоглуулна.
 *
 * ⚠️ "Дуудлага ирэхэд зөвхөн чичирдэг" гэдгийн шалтгаан:
 *
 *   .setUsage(AudioAttributes.USAGE_NOTIFICATION)
 *
 * Энэ нь дууг МЭДЭГДЛИЙН дууны урсгал (STREAM_NOTIFICATION) дээр
 * тоглуулна. Олон хүн мэдэгдлийн дууг намхан эсвэл бүрмөсөн хааж,
 * харин хонхны дууг өндөр тавьдаг. Тэр үед дуудлага ирэхэд дуу
 * сонсогдохгүй, зөвхөн чичиргээ үлдэнэ.
 *
 * Ирэх дуудлага бол мэдэгдэл биш — ХОНХ. Тиймээс
 * `USAGE_NOTIFICATION_RINGTONE` ашиглах ёстой. Энэ нь дууг хонхны
 * урсгал дээр тоглуулж, "Чимээгүй/Чичиргээ" горимыг ч зөв дагана.
 *
 * ⚠️ Суваг нэг удаа үүссэний дараа өөрчлөгдөхгүй тул JS тал дээрх
 *    CHANNEL_ID-г мөн ахиулсан (v1 -> v2). Эс тэгвээс энэ засвар
 *    хуучин утсанд огт үйлчлэхгүй.
 */
function patchRingtoneStream() {
  const serviceFile = path.join(
    __dirname,
    '../node_modules/react-native-full-screen-notification-incoming-call/android/src/main/java/com/reactnativefullscreennotificationincomingcall/IncomingCallService.java'
  );
  if (!fs.existsSync(serviceFile)) {
    console.log('[patch-incoming-call] service file missing, skip');
    return;
  }

  let src = fs.readFileSync(serviceFile, 'utf8');
  if (src.includes(RINGTONE_MARKER)) {
    console.log('[patch-incoming-call] ringtone stream already patched');
    return;
  }

  const original = `      notificationChannel.setSound(soundUri,
        new AudioAttributes.Builder()
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .setUsage(AudioAttributes.USAGE_NOTIFICATION)
          .build());`;

  if (!src.includes(original)) {
    console.log('[patch-incoming-call] ringtone pattern not found, skip');
    return;
  }

  const replacement = `      ${RINGTONE_MARKER}
      // USAGE_NOTIFICATION нь мэдэгдлийн дууны урсгалыг ашигладаг тул
      // мэдэгдлийн дуу намхан хүмүүст зөвхөн чичиргээ үлддэг.
      // Ирэх дуудлага бол хонх — хонхны урсгал дээр тоглуулна.
      notificationChannel.setSound(soundUri,
        new AudioAttributes.Builder()
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
          .build());`;

  src = src.replace(original, replacement);
  fs.writeFileSync(serviceFile, src);
  console.log('[patch-incoming-call] patched IncomingCallService.java ringtone stream');
}

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

// Засвар БҮРИЙГ тусад нь ажиллуулна. Урьд нь эхний засвар хийгдсэн бол
// `process.exit(0)` хийж, дараагийнх руу ХҮРДЭГГҮЙ байсан — шинэ засвар
// нэмэхэд чимээгүй алгасагдана.
patchActivity();
patchModuleStartService();

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
  if (mod.includes('startForegroundService(intent)')) {
    console.log('[patch-incoming-call] startForegroundService already patched');
    return;
  }

  const oldCall = '    getReactApplicationContext().startService(intent);';
  if (!mod.includes(oldCall)) {
    console.log('[patch-incoming-call] startService pattern not found, skip');
    return;
  }

  const newCall = `    // Android 8+ дээр апп ард байхад энгийн startService хориотой.
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
      getReactApplicationContext().startForegroundService(intent);
    } else {
      getReactApplicationContext().startService(intent);
    }`;

  mod = mod.replace(oldCall, newCall);
  fs.writeFileSync(moduleFile, mod);
  console.log('[patch-incoming-call] patched FullScreenNotificationIncomingCallModule.java');
}

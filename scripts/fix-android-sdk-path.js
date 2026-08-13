#!/usr/bin/env node
/**
 * Android SDK-гийн зам дахь ЗАЙГ тойрох.
 *
 * АСУУДАЛ:
 *   Энэ компьютерийн SDK нь `C:\Users\work pc\AppData\Local\Android\Sdk`
 *   дотор байдаг — "work pc" гэсэн ЗАЙТАЙ нэр. NDK 27-гийн CMake toolchain
 *   нь libc++-ийн замыг `CMAKE_CXX_STANDARD_LIBRARIES` дотор угсрахдаа
 *   зайг зөв боловсруулж чаддаггүй тул тэр зам чимээгүй алдагдана:
 *
 *       CMakeCache:  ANDROID_STL = c++_shared            ← зөв
 *                    CMAKE_CXX_STANDARD_LIBRARIES = -latomic -lm
 *                                                    ↑ libc++ алга
 *
 *   Үр дүнд нь БҮХ native модуль линкийн үед унана:
 *       ld.lld: error: undefined symbol: operator new(unsigned long)
 *       ld.lld: error: undefined symbol: std::__ndk1::...
 *
 *   ⚠️ Төслийг зайгүй зам руу зөөх нь ХАНГАЛТГҮЙ — NDK өөрөө зайтай
 *      замд байсаар байна. Засах ёстой нь SDK-гийн зам.
 *
 * ШИЙДЭЛ:
 *   SDK руу заасан зайгүй junction (`C:\android-sdk`) үүсгээд
 *   `android/local.properties` дотор түүнийг заана.
 *
 * ЯАГААД СКРИПТ ВЭ:
 *   `android/` фолдер нь generated бөгөөд `expo prebuild` бүрд устдаг.
 *   Тиймээс local.properties-ийг гараар бичих нь нэг л удаа тусална.
 *   Энэ скриптийг prebuild-ийн ДАРАА, build-ийн ӨМНӨ ажиллуулна.
 *
 * Хэрэглэх:
 *   node scripts/fix-android-sdk-path.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const LINK = 'C:\\android-sdk';

function log(msg) {
  console.log(`[android-sdk-path] ${msg}`);
}

if (os.platform() !== 'win32') {
  log('Зөвхөн Windows дээр хэрэгтэй, алгасав');
  process.exit(0);
}

const androidDir = path.join(__dirname, '..', 'android');
if (!fs.existsSync(androidDir)) {
  log('android/ фолдер алга (prebuild хийгээгүй), алгасав');
  process.exit(0);
}

// SDK хаана байна?
const sdk =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk');

if (!fs.existsSync(sdk)) {
  log(`SDK олдсонгүй: ${sdk}`);
  process.exit(0);
}

// Зайгүй бол юу ч хийх шаардлагагүй
if (!sdk.includes(' ')) {
  log('SDK-гийн замд зай алга — засвар шаардлагагүй');
  process.exit(0);
}

// Junction үүсгэнэ (аль хэдийн байвал дахин үүсгэхгүй)
if (!fs.existsSync(LINK)) {
  try {
    execFileSync('cmd', ['/c', 'mklink', '/J', LINK, sdk], { stdio: 'ignore' });
    log(`junction үүсгэв: ${LINK} -> ${sdk}`);
  } catch (e) {
    log(`junction үүсгэж чадсангүй (админ эрх хэрэгтэй байж болно): ${e.message}`);
    process.exit(0);
  }
} else {
  log(`junction аль хэдийн бий: ${LINK}`);
}

// local.properties — Java properties тул URL хэлбэрийн ташуу зураас
// ашиглана, ингэснээр backslash escape хийх шаардлагагүй.
const propsFile = path.join(androidDir, 'local.properties');
const desired = 'sdk.dir=C:/android-sdk\n';
const current = fs.existsSync(propsFile) ? fs.readFileSync(propsFile, 'utf8') : '';

if (current.includes('sdk.dir=C:/android-sdk')) {
  log('local.properties аль хэдийн зөв');
} else {
  fs.writeFileSync(propsFile, desired);
  log('android/local.properties -> C:/android-sdk');
}

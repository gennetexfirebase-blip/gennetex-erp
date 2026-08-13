#!/usr/bin/env node
/**
 * Release гарын үсгийн тохиргоог `android/` руу суулгана.
 *
 * ЯАГААД СКРИПТ ВЭ:
 *   `android/` фолдер нь generated бөгөөд `expo prebuild` бүрд бүрэн
 *   устдаг. Keystore-г тэнд хадгалбал нэг л удаа ажиллаад алга болно.
 *   Тиймээс жинхэнэ файл нь `credentials/` дотор (git-д ордоггүй)
 *   байрлаж, энэ скрипт prebuild-ийн дараа хуулж, build.gradle-ыг
 *   засварлана.
 *
 * ЮУ ХИЙХ ВЭ:
 *   1. credentials/gennetex-release.keystore → android/app/ руу хуулна
 *   2. android/gradle.properties-д нууц үгийг бичнэ
 *   3. android/app/build.gradle доторх release signingConfig-ыг
 *      debug түлхүүрээс жинхэнэ түлхүүр рүү сольно
 *
 * ⚠️ ЭНЭ KEYSTORE-ЫГ АЛДВАЛ Google Play дээрх аппаа ХЭЗЭЭ Ч шинэчилж
 *    чадахгүй. Тусдаа газар (нууц үгийн сан, гадаад диск) хуулбарлаж
 *    хадгална уу.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const KEYSTORE_SRC = path.join(ROOT, 'credentials', 'gennetex-release.keystore');
const PASSWORD_FILE = path.join(ROOT, 'credentials', '.keystore-password.txt');
const ANDROID = path.join(ROOT, 'android');
const KEYSTORE_DEST = path.join(ANDROID, 'app', 'gennetex-release.keystore');
const GRADLE_PROPS = path.join(ANDROID, 'gradle.properties');
const APP_GRADLE = path.join(ANDROID, 'app', 'build.gradle');

const KEY_ALIAS = 'gennetex';
const STORE_NAME = 'gennetex-release.keystore';

function log(m) {
  console.log(`[release-signing] ${m}`);
}

if (!fs.existsSync(ANDROID)) {
  log('android/ фолдер алга (prebuild хийгээгүй), алгасав');
  process.exit(0);
}

if (!fs.existsSync(KEYSTORE_SRC)) {
  log('credentials/gennetex-release.keystore олдсонгүй — debug түлхүүр хэвээр үлдэнэ');
  log('Release болон Play Store-т ЭНЭ ХАНГАЛТГҮЙ.');
  process.exit(0);
}

const password = fs.readFileSync(PASSWORD_FILE, 'utf8').trim();
if (!password) {
  log('Нууц үг хоосон байна — credentials/.keystore-password.txt шалгана уу');
  process.exit(1);
}

// 1) Keystore хуулах
fs.copyFileSync(KEYSTORE_SRC, KEYSTORE_DEST);
log('keystore → android/app/');

// 2) gradle.properties
// Нууц үгийг build.gradle дотор ШУУД бичихгүй: тэр файл generated бөгөөд
// алдаатай тохиолдолд лог руу хэвлэгдэх эрсдэлтэй.
let props = fs.existsSync(GRADLE_PROPS) ? fs.readFileSync(GRADLE_PROPS, 'utf8') : '';
props = props.replace(/\nGENNETEX_(UPLOAD|RELEASE)_[A-Z_]+=.*/g, '');
props +=
  `\n# Release гарын үсэг — scripts/setup-release-signing.js үүсгэсэн\n` +
  `GENNETEX_RELEASE_STORE_FILE=${STORE_NAME}\n` +
  `GENNETEX_RELEASE_KEY_ALIAS=${KEY_ALIAS}\n` +
  `GENNETEX_RELEASE_STORE_PASSWORD=${password}\n` +
  `GENNETEX_RELEASE_KEY_PASSWORD=${password}\n`;
fs.writeFileSync(GRADLE_PROPS, props);
log('gradle.properties шинэчлэв');

// 3) build.gradle доторх signingConfig
let gradle = fs.readFileSync(APP_GRADLE, 'utf8');

if (!gradle.includes('GENNETEX_RELEASE_STORE_FILE')) {
  // signingConfigs блокт release нэмнэ
  gradle = gradle.replace(
    /signingConfigs \{\s*debug \{[\s\S]*?\}\s*\}/,
    (block) =>
      block.replace(
        /\n(\s*)\}\s*$/,
        `\n$1    release {
$1        if (project.hasProperty('GENNETEX_RELEASE_STORE_FILE')) {
$1            storeFile file(GENNETEX_RELEASE_STORE_FILE)
$1            storePassword GENNETEX_RELEASE_STORE_PASSWORD
$1            keyAlias GENNETEX_RELEASE_KEY_ALIAS
$1            keyPassword GENNETEX_RELEASE_KEY_PASSWORD
$1        }
$1    }
$1}`
      )
  );

  // release buildType-ийн signingConfig-ыг сольно
  gradle = gradle.replace(
    /(release \{\s*(?:\/\/[^\n]*\n\s*)*)signingConfig signingConfigs\.debug/,
    '$1signingConfig signingConfigs.release'
  );

  fs.writeFileSync(APP_GRADLE, gradle);
  log('build.gradle — release нь жинхэнэ түлхүүрээр гарын үсэг зурна');
} else {
  log('build.gradle аль хэдийн тохируулагдсан');
}

log('бэлэн ✔');

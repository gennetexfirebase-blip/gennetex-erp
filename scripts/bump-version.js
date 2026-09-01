#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VERSION_FILE = path.join(ROOT, 'src/version.js');
const APP_JSON = path.join(ROOT, 'app.json');
const PACKAGE_JSON = path.join(ROOT, 'package.json');
const ADMIN_HTML = path.join(ROOT, 'admin-web/index.html');
const SEGMENT_MAX = 10;

function parseVersion(src) {
  const major = Number(/major:\s*(\d+)/.exec(src)?.[1] ?? 0);
  const minor = Number(/minor:\s*(\d+)/.exec(src)?.[1] ?? 0);
  const patch = Number(/patch:\s*(\d+)/.exec(src)?.[1] ?? 0);
  return { major, minor, patch };
}

function bumpVersion(v) {
  let { major, minor, patch } = v;
  if (patch < SEGMENT_MAX) {
    return { major, minor, patch: patch + 1 };
  }
  patch = 0;
  if (minor < SEGMENT_MAX) {
    return { major, minor: minor + 1, patch };
  }
  return { major: major + 1, minor: 0, patch: 0 };
}

function formatVersion(v) {
  return `${v.major}.${v.minor}.${v.patch}`;
}

function writeVersionFile(v) {
  const src = fs.readFileSync(VERSION_FILE, 'utf8');
  const next = src
    .replace(/major:\s*\d+/, `major: ${v.major}`)
    .replace(/minor:\s*\d+/, `minor: ${v.minor}`)
    .replace(/patch:\s*\d+/, `patch: ${v.patch}`);
  fs.writeFileSync(VERSION_FILE, next);
}

function syncJson(filePath, version) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (filePath.endsWith('app.json')) {
    data.expo.version = version;

    /**
     * ⚠️ ДЭЛГҮҮРИЙН БҮРТГЭЛИЙН ДУГААРЫГ ЗААВАЛ АХИУЛНА.
     *
     *   Google Play нь `versionCode`, App Store нь `buildNumber`-ыг
     *   өмнөх илгээлтээс ЗААВАЛ ИХ байхыг шаарддаг. Тэнцүү эсвэл бага
     *   бол илгээлт татгалзагдана.
     *
     *   Эдгээр нь `version`-оос ТУСДАА тоолуур — 1.3.7 → 1.3.8 болоход
     *   өөрөө нэмэгддэггүй. 2026-08-31-ний аудитаар апп 1.3.7 хувилбартай
     *   байхад `versionCode` нь зөвхөн 2 байсан: гараар нэмэх шаардлагатай
     *   байсныг мартсанаас болсон.
     *
     *   CI нь EAS ашигладаггүй (Gradle-ээр шууд барьдаг) тул
     *   `eas.json`-ы `autoIncrement` энд ХАМААРАХГҮЙ — тоолуурыг энэ
     *   скрипт л ахиулна.
     */
    data.expo.android = data.expo.android || {};
    data.expo.android.versionCode = Number(data.expo.android.versionCode || 0) + 1;

    data.expo.ios = data.expo.ios || {};
    data.expo.ios.buildNumber = String(Number(data.expo.ios.buildNumber || 0) + 1);

    console.log(
      `  versionCode → ${data.expo.android.versionCode}` +
        `   buildNumber → ${data.expo.ios.buildNumber}`
    );
  } else {
    data.version = version;
  }
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function syncPackageLock(version) {
  const lockPath = path.join(ROOT, 'package-lock.json');
  if (!fs.existsSync(lockPath)) return;
  const data = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  data.version = version;
  if (data.packages?.['']) {
    data.packages[''].version = version;
  }
  fs.writeFileSync(lockPath, `${JSON.stringify(data, null, 2)}\n`);
}

function syncAdminHtml(version) {
  let html = fs.readFileSync(ADMIN_HTML, 'utf8');
  html = html.replace(
    /(<span id="appVersionFoot">ЖЕННЕТЕКС )v[\d.]+(<\/span>)/,
    `$1v${version}$2`,
  );
  html = html.replace(
    /(<div class="foot">Gennetex ERP )v[\d.]+(<\/div>)/,
    `$1v${version}$2`,
  );
  html = html.replace(
    /<meta name="admin-build-version" content="[^"]*"\/>/,
    `<meta name="admin-build-version" content="${version}"/>`,
  );
  if (!html.includes('admin-build-version')) {
    html = html.replace(
      '<meta name="viewport"',
      `<meta name="admin-build-version" content="${version}"/>\n  <meta name="viewport"`,
    );
  }
  fs.writeFileSync(ADMIN_HTML, html);
}

const currentSrc = fs.readFileSync(VERSION_FILE, 'utf8');
const current = parseVersion(currentSrc);

/**
 * ⚠️ ЗӨРҮҮГ ШАЛГАНА — эс бөгөөс хувилбар УХАРНА.
 *
 * Энэ скрипт `src/version.js`-ийг эх сурвалж болгодог ч
 * `app.json`-ыг гараар засаад tag түлхэх нь бас боломжтой. Тэгвэл
 * хоёр файл салж, дараагийн bump нь ХУУЧИН тооноос үргэлжилнэ.
 *
 * 2026-09-01-нд яг ингэж болсон: `app.json` нь 1.3.7 байхад
 * `version.js` нь 1.3.2 дээр зогссон тул bump нь 1.3.3 гаргаж,
 * хувилбар дөрвөөр УХАРСАН. `/app` дээр аль хэдийн 1.3.7 байсан
 * тул тэр файлыг байршуулсан бол ажилтнууд хуучин апп татах байв.
 *
 * Одоо зөрүүг эрт барьж, гараар засахыг шаардана.
 */
const appJsonVersion = JSON.parse(fs.readFileSync(APP_JSON, 'utf8')).expo.version;
if (appJsonVersion !== formatVersion(current)) {
  console.error(
    `\n  ✕ Хувилбарын зөрүү:\n` +
      `      src/version.js  → ${formatVersion(current)}\n` +
      `      app.json        → ${appJsonVersion}\n\n` +
      `    Хоёрын АЛЬ ИХИЙГ нь src/version.js дотор бичээд дахин\n` +
      `    ажиллуулна уу. Ингэхгүй бол хувилбар ухарч, /app дээр\n` +
      `    хуучин апп тавигдана.\n`
  );
  process.exit(1);
}

const next = bumpVersion(current);
const nextStr = formatVersion(next);

writeVersionFile(next);
syncJson(APP_JSON, nextStr);
syncJson(PACKAGE_JSON, nextStr);
syncPackageLock(nextStr);
syncAdminHtml(nextStr);

console.log(`Version bumped: ${formatVersion(current)} → ${nextStr}`);

#!/usr/bin/env node
/**
 * Vercel deploy бэлдэх скрипт:
 *   dist-web/                 → adiya.site (нийтийн танилцуулга сайт)
 *   dist-web/gennetex/admin/  → adiya.site/gennetex/admin (админ хяналтын самбар)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { syncAdminEnv } = require('./sync-admin-env');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist-web');
const publicWeb = path.join(root, 'public-web');
const publicWebDist = path.join(publicWeb, 'dist');
const publicWebPublic = path.join(publicWeb, 'public');
const adminWeb = path.join(root, 'admin-web');
const logo = path.join(root, 'assets', 'logo.png');
const reportLogo = path.join(root, 'assets', 'report-logo.png');

function rimraf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, destDir) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(destDir, { recursive: true });
  fs.cpSync(src, destDir, { recursive: true });
}

console.log('[build-web] Цэвэрлэж байна:', dist);
rimraf(dist);
fs.mkdirSync(dist, { recursive: true });

// Copy logos to deploy paths (admin + fallback)
if (fs.existsSync(logo)) {
  fs.mkdirSync(publicWebPublic, { recursive: true });
  fs.copyFileSync(logo, path.join(publicWebPublic, 'logo.png'));
  fs.copyFileSync(logo, path.join(adminWeb, 'logo.png'));
  const adminReport = path.join(adminWeb, 'report-logo.png');
  if (fs.existsSync(reportLogo)) {
    fs.copyFileSync(reportLogo, adminReport);
  } else {
    fs.copyFileSync(logo, adminReport);
  }
}

// 1) React + Tailwind public site build
console.log('[build-web] Public site build (Vite)...');
try {
  execSync('npm install', { cwd: publicWeb, stdio: 'inherit' });
  execSync('npm run build', { cwd: publicWeb, stdio: 'inherit' });
} catch (e) {
  console.error('[build-web] Public site build алдаа:', e.message);
  process.exit(1);
}

if (!fs.existsSync(publicWebDist)) {
  console.error('[build-web] public-web/dist олдсонгүй');
  process.exit(1);
}

console.log('[build-web] dist-web руу хуулж байна');
copyDir(publicWebDist, dist);

if (fs.existsSync(logo) && !fs.existsSync(path.join(dist, 'logo.png'))) {
  fs.copyFileSync(logo, path.join(dist, 'logo.png'));
}

// 2) Админ самбар → dist-web/gennetex/admin/
const adminDest = path.join(dist, 'gennetex', 'admin');
console.log('[build-web] Админ самбар (admin-web → gennetex/admin)');
copyDir(adminWeb, adminDest);
syncAdminEnv(path.join(adminDest, 'index.html'));

// Админ index.html дээр build хувилбар (кэш шалгах)
try {
  const versionSrc = fs.readFileSync(path.join(root, 'src/version.js'), 'utf8');
  const ver = /patch:\s*(\d+)/.exec(versionSrc);
  const minor = /minor:\s*(\d+)/.exec(versionSrc);
  const major = /major:\s*(\d+)/.exec(versionSrc);
  if (major && minor && ver) {
    const v = `${major[1]}.${minor[1]}.${ver[1]}`;
    let adminHtml = fs.readFileSync(path.join(adminDest, 'index.html'), 'utf8');
    adminHtml = adminHtml.replace(/<meta name="admin-build-version" content="[^"]*"\/>/, `<meta name="admin-build-version" content="${v}"/>`);
    fs.writeFileSync(path.join(adminDest, 'index.html'), adminHtml);
  }
} catch (_) {}

// Лого fallback — /gennetex/logo.png (relative path алдаа гарвал)
if (fs.existsSync(logo)) {
  fs.copyFileSync(logo, path.join(dist, 'gennetex', 'logo.png'));
  if (fs.existsSync(reportLogo)) {
    fs.copyFileSync(reportLogo, path.join(dist, 'gennetex', 'report-logo.png'));
  }
}

// 3) Апп татах хуудас → dist-web/app/index.html (adiya.site/app)
try {
  const versionSrc = fs.readFileSync(path.join(root, 'src/version.js'), 'utf8');
  const major = /major:\s*(\d+)/.exec(versionSrc);
  const minor = /minor:\s*(\d+)/.exec(versionSrc);
  const patch = /patch:\s*(\d+)/.exec(versionSrc);
  const appVer = major && minor && patch ? `${major[1]}.${minor[1]}.${patch[1]}` : '';
  const appDir = path.join(dist, 'app');
  fs.mkdirSync(appDir, { recursive: true });
  const apkUrl = 'https://github.com/ModulesoftLLC/gennetex/releases/latest/download/gennetex.apk';
  const page = buildAppDownloadPage(appVer, apkUrl);
  fs.writeFileSync(path.join(appDir, 'index.html'), page);
  if (fs.existsSync(logo)) fs.copyFileSync(logo, path.join(appDir, 'logo.png'));
  console.log('[build-web] Апп татах хуудас: /app');
} catch (e) {
  console.warn('[build-web] /app хуудас үүсгэж чадсангүй:', e.message);
}

console.log('[build-web] Бэлэн. Гаралт:', dist);

function buildAppDownloadPage(version, apkUrl) {
  const v = version ? `v${version}` : '';
  return `<!DOCTYPE html>
<html lang="mn">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Gennetex апп татах</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(160deg, #0b1220 0%, #101a2e 100%);
    color: #e8eefc; min-height: 100vh;
    display: flex; align-items: center; justify-content: center; padding: 24px;
  }
  .card {
    width: 100%; max-width: 440px; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08); border-radius: 24px;
    padding: 40px 28px; text-align: center; backdrop-filter: blur(10px);
  }
  .logo { width: 96px; height: 80px; object-fit: contain; margin-bottom: 20px; }
  h1 { font-size: 24px; font-weight: 800; margin-bottom: 6px; }
  .ver { color: #7c93b8; font-size: 13px; margin-bottom: 24px; }
  .btn {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    width: 100%; padding: 16px; border-radius: 14px; text-decoration: none;
    background: #2563eb; color: #fff; font-size: 17px; font-weight: 700;
    transition: transform .1s, background .2s;
  }
  .btn:active { transform: scale(.98); }
  .btn:hover { background: #1d4ed8; }
  .steps { text-align: left; margin-top: 28px; }
  .steps h2 { font-size: 14px; color: #9db2d6; margin-bottom: 12px; font-weight: 700; }
  .steps ol { padding-left: 20px; color: #c3d1ea; font-size: 14px; line-height: 1.9; }
  .note { margin-top: 20px; font-size: 12px; color: #6b81a6; line-height: 1.6; }
  .os { margin-top: 22px; font-size: 12px; color: #7c93b8; }
</style>
</head>
<body>
  <div class="card">
    <img class="logo" src="./logo.png" alt="Gennetex" onerror="this.style.display='none'" />
    <h1>Gennetex апп</h1>
    <div class="ver">${v ? 'Хувилбар ' + v : 'Android аппликейшн'}</div>
    <a class="btn" href="${apkUrl}">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Android APK татах
    </a>
    <div class="steps">
      <h2>СУУЛГАХ ЗААВАР</h2>
      <ol>
        <li>Дээрх товч дарж APK татна</li>
        <li>Татсан файл дээр дарна</li>
        <li>«Unknown sources / Тодорхойгүй эх сурвалж» гарвал зөвшөөрнө</li>
        <li>Суулгасны дараа нэвтэрч орно</li>
      </ol>
    </div>
    <div class="os">📱 Зөвхөн Android (7.0+). iOS удахгүй.</div>
    <div class="note">Modulesoft LLC · Gennetex ERP</div>
  </div>
</body>
</html>`;
}

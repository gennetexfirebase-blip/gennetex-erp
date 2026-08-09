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
const next = bumpVersion(current);
const nextStr = formatVersion(next);

writeVersionFile(next);
syncJson(APP_JSON, nextStr);
syncJson(PACKAGE_JSON, nextStr);
syncPackageLock(nextStr);
syncAdminHtml(nextStr);

console.log(`Version bumped: ${formatVersion(current)} → ${nextStr}`);

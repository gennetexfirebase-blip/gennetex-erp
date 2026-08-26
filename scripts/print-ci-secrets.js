#!/usr/bin/env node
/**
 * GitHub Actions-д хэрэгтэй secret-үүдийг бэлдэж хэвлэнэ.
 *
 * ЯАГААД: `.env`, `google-services.json`, keystore нь git-д ОРДОГГҮЙ
 * (зөв!). Тиймээс CI дээр build хийхэд эдгээрийг GitHub Secrets-ээр
 * дамжуулна. Энэ скрипт нь тэдгээрийг зөв хэлбэрт (base64 г.м.)
 * хөрвүүлж, хаана нь тавихыг хэлж өгнө.
 *
 * Ажиллуулах:  node scripts/print-ci-secrets.js
 *
 * ⚠️ Гаралтыг хэн нэгэнтэй ХУВААЛЦАХГҮЙ. Зөвхөн GitHub Secrets руу
 *    хуулна: репо → Settings → Secrets and variables → Actions.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const env = readEnv(path.join(ROOT, '.env'));
const rows = [];
const missing = [];

function addPlain(name) {
  if (env[name]) rows.push({ name, value: env[name], kind: 'текст' });
  else missing.push(name);
}

function addFileB64(name, file) {
  const p = path.join(ROOT, file);
  if (fs.existsSync(p)) {
    rows.push({ name, value: fs.readFileSync(p).toString('base64'), kind: `base64 (${file})` });
  } else {
    missing.push(`${name}  ← ${file} олдсонгүй`);
  }
}

addPlain('EXPO_PUBLIC_SUPABASE_URL');
addPlain('EXPO_PUBLIC_SUPABASE_ANON_KEY');
addPlain('EXPO_PUBLIC_DEVELOPER_EMAIL');
addFileB64('GOOGLE_SERVICES_JSON', 'google-services.json');
addFileB64('ANDROID_KEYSTORE_BASE64', 'credentials/gennetex-release.keystore');

const pwFile = path.join(ROOT, 'credentials', '.keystore-password.txt');
if (fs.existsSync(pwFile)) {
  rows.push({
    name: 'ANDROID_KEYSTORE_PASSWORD',
    value: fs.readFileSync(pwFile, 'utf8').trim(),
    kind: 'текст',
  });
} else {
  missing.push('ANDROID_KEYSTORE_PASSWORD  ← credentials/.keystore-password.txt олдсонгүй');
}

console.log('\n=== GitHub Secrets (Settings → Secrets and variables → Actions → New secret) ===\n');
for (const r of rows) {
  console.log(`--- ${r.name}  [${r.kind}] ---`);
  console.log(r.value);
  console.log('');
}

if (missing.length) {
  console.log('=== ДУТУУ ===');
  missing.forEach((m) => console.log(' •', m));
  console.log('\nANDROID_KEYSTORE_* нь зөвхөн release build-д хэрэгтэй.');
  console.log('debug build хийхэд эхний 4 secret хангалттай.\n');
}

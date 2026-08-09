#!/usr/bin/env node
/** .env -> admin-web/config.js (EXPO_PUBLIC_DEVELOPER_EMAIL) */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const outPath = path.join(root, 'admin-web', 'config.js');

function readDeveloperEmail() {
  if (!fs.existsSync(envPath)) {
    console.warn('.env олдсонгүй — developerEmail хоосон үлдэнэ');
    return '';
  }
  const text = fs.readFileSync(envPath, 'utf8');
  const m = text.match(/^EXPO_PUBLIC_DEVELOPER_EMAIL\s*=\s*(.+)$/m);
  if (!m) {
    console.warn('EXPO_PUBLIC_DEVELOPER_EMAIL .env дээр байхгүй');
    return '';
  }
  return m[1].trim().replace(/^['"]|['"]$/g, '');
}

const email = readDeveloperEmail();
const body = `/**
 * Admin-web тохиргоо — .env-ийн EXPO_PUBLIC_DEVELOPER_EMAIL-тай ижил байх ёстой.
 * Шинэчлэх: npm run sync:config
 */
window.GENNETEX_ADMIN_CONFIG = {
  developerEmail: ${JSON.stringify(email)},
};
`;

fs.writeFileSync(outPath, body, 'utf8');
console.log('admin-web/config.js шинэчлэгдлээ:', email || '(хоосон)');

#!/usr/bin/env node
/**
 * google-services.json → android/app/ хуулна.
 * EAS / local Gradle build дээр Google Services plugin шаардлагатай.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'google-services.json');
const DEST = path.join(ROOT, 'android/app/google-services.json');

if (!fs.existsSync(SRC)) {
  console.log('[sync-google-services] google-services.json олдсонгүй, алгасав');
  process.exit(0);
}

if (!fs.existsSync(path.join(ROOT, 'android/app'))) {
  console.log('[sync-google-services] android/app байхгүй, алгасав');
  process.exit(0);
}

fs.mkdirSync(path.dirname(DEST), { recursive: true });
fs.copyFileSync(SRC, DEST);
console.log('[sync-google-services] android/app/google-services.json шинэчлэгдлээ');

#!/usr/bin/env node
/**
 * Expo SDK 54 gives ngrok only 10 seconds to return its public URL. It also
 * assumes every @expo/ngrok error has a `body`, so intermittent network errors
 * can be replaced by `Cannot read properties of undefined (reading 'body')`.
 * Keep both workarounds local and reapply them after every npm install.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '../node_modules/@expo/cli/build/src/start/server/AsyncNgrok.js'
);

if (!fs.existsSync(file)) {
  console.log('[patch-expo-ngrok] Expo CLI not installed, skip');
  process.exit(0);
}

const replacements = [
  ['const TUNNEL_TIMEOUT = 10 * 1000;', 'const TUNNEL_TIMEOUT = 60 * 1000;'],
  [
    'error.body.msg,',
    'error.body?.msg || error.message || error.toString(),',
  ],
  [
    '(_error_body_details = error.body.details)',
    '(_error_body_details = error.body?.details)',
  ],
  [
    '(0, _NgrokResolver.isNgrokClientError)(error) && error.body.error_code === 103',
    '(0, _NgrokResolver.isNgrokClientError)(error) && error.body?.error_code === 103',
  ],
];

let source = fs.readFileSync(file, 'utf8');
let changed = false;
for (const [original, patched] of replacements) {
  if (!source.includes(original)) continue;
  source = source.replace(original, patched);
  changed = true;
}

if (changed) {
  fs.writeFileSync(file, source);
  console.log('[patch-expo-ngrok] timeout and body-safe error handling applied');
} else {
  console.log('[patch-expo-ngrok] already patched or patterns not present');
}

// ---------------------------------------------------------------------------
// `expo start --tunnel` бүрд гардаг "Log in / Proceed anonymously" сонголтыг
// алгасуулна.
// ---------------------------------------------------------------------------
// ЯАГААД: tunnel асаах бүрд Expo CLI нь Expo бүртгэлээр нэвтрэхийг санал
// болгож, сум товчоор сонголт хийхийг ШААРДДАГ. Бид зөвхөн дотоод багийн
// dev build дээр ажилладаг тул Expo бүртгэл хэрэггүй бөгөөд энэ асуулт нь
// зүгээр л нэмэлт алхам болдог. `tryGetUserAsync` нь нэвтрээгүй үед `null`
// буцаах нь хэвийн зан төлөв (анонимоор үргэлжилнэ) тул шууд `null`
// буцаалгана — CI=1 тавихаас ялгаатай нь дэлгэц дээрх интерактив
// товчлуурууд (r, s, m) хэвээр ажиллана.
const userActions = path.join(
  __dirname,
  '../node_modules/@expo/cli/build/src/api/user/actions.js'
);
if (fs.existsSync(userActions)) {
  let src = fs.readFileSync(userActions, 'utf8');
  const marker = 'async function tryGetUserAsync() {';
  const skip = `${marker}
    // [gennetex patch] Нэвтрэх сонголтыг алгасаж, анонимоор үргэлжилнэ.
    return await (0, _user.getUserAsync)().catch(() => null);
    // eslint-disable-next-line no-unreachable`;
  if (src.includes(marker) && !src.includes('[gennetex patch]')) {
    src = src.replace(marker, skip);
    fs.writeFileSync(userActions, src);
    console.log('[patch-expo-ngrok] tunnel-ийн нэвтрэх асуулт алгаслаа');
  }
}

// @expo/ngrok-ийн retry helper мөн body-г заавал байна гэж үздэг.
const ngrokUtils = path.join(__dirname, '../node_modules/@expo/ngrok/src/utils.js');
if (fs.existsSync(ngrokUtils)) {
  let utils = fs.readFileSync(ngrokUtils, 'utf8');
  const safeUtils = utils.replace(
    /(?:body && )*body\.details &&/g,
    'body && body.details &&'
  );
  if (safeUtils !== utils) {
    fs.writeFileSync(ngrokUtils, safeUtils);
    console.log('[patch-expo-ngrok] @expo/ngrok retry body guard applied');
  }
}

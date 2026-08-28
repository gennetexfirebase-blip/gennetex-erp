#!/usr/bin/env node
/**
 * Expo dev server дээрх `Must specify "expo-platform" header or "platform"
 * query parameter` алдааг арилгана.
 *
 * ЮУ БОЛДОГ ВЭ:
 *   Tunnel/LAN хаягийг КОМПЬЮТЕРИЙН браузераар нээхэд Expo-ийн
 *   `InterstitialPageMiddleware` (тэр "Open with…" завсрын хуудас) ба
 *   `RuntimeRedirectMiddleware` нь платформыг эхлээд query/header-ээс,
 *   дараа нь `user-agent`-аас хайдаг. Windows/macOS браузерын
 *   user-agent дотор `Android` ч, `iPhone` ч байхгүй тул хоёулаа
 *   `null` буцааж, дээрх алдааг шидэнэ. Терминал дээр QR код харах
 *   бүрд лог бохирдож, зогссон мэт харагдана (үнэндээ сервер
 *   ажилласаар байдаг).
 *
 * ЗАСВАР:
 *   `resolvePlatformFromUserAgentHeader` нь юу ч таньсангүй бол
 *   `android` гэж үзнэ. Энэ төсөл Android дээр тарааг­даг тул
 *   зөв таамаг бөгөөд утаснаас орсон хүсэлтэд огт нөлөөлөхгүй
 *   (тэнд user-agent зөв таагддаг).
 *
 * ⚠️ `node_modules` доторх файлыг засдаг тул `npm install` бүрийн
 *    дараа дахин ажиллана (postinstall + start script-д холбоотой).
 */
const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '../node_modules/@expo/cli/build/src/start/server/middleware/resolvePlatform.js'
);

if (!fs.existsSync(file)) {
  console.log('[patch-expo-platform] Expo CLI суулгаагүй, алгасав');
  process.exit(0);
}

const MARK = '/* gennetex: default platform */';
let src = fs.readFileSync(file, 'utf8');

if (src.includes(MARK)) {
  console.log('[patch-expo-platform] аль хэдийн засагдсан');
  process.exit(0);
}

const anchor =
  '    debug(`Resolved platform ${platform} from user-agent header: ${userAgent}`);\n    return platform;';

if (!src.includes(anchor)) {
  console.warn(
    '[patch-expo-platform] Expo CLI-ийн бүтэц өөрчлөгдсөн байна — алгасав.\n' +
      '                     (алдаа дахин гарвал энэ script-ийг шинэчилнэ үү)'
  );
  process.exit(0);
}

src = src.replace(
  anchor,
  '    debug(`Resolved platform ${platform} from user-agent header: ${userAgent}`);\n' +
    `    ${MARK}\n` +
    '    if (!platform) {\n' +
    '        platform = "android";\n' +
    '    }\n' +
    '    return platform;'
);

fs.writeFileSync(file, src);
console.log('[patch-expo-platform] засав — десктоп браузераас нээхэд алдаа гарахгүй');

#!/usr/bin/env node
/**
 * `expo start --tunnel` ажиллах нөхцөлийг урьдчилан шалгана.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ:
 *   ngrok нь 2023 оноос хойш нэргүй (authtoken-гүй) туннел зөвшөөрөхөө
 *   больсон — `ERR_NGROK_4018` буцаана. Гэвч Expo CLI нь ngrok-оос URL
 *   ирэхийг хүлээгээд хүлээгээд эцэст нь:
 *
 *       CommandError: ngrok tunnel took too long to connect.
 *
 *   гэж хэлдэг. Энэ нь жинхэнэ шалтгааныг БҮРЭН НУУНА — хүн сүлжээ удаан
 *   гэж бодоод timeout-оо уртасгаж цаг алддаг.
 *
 *   Тиймээс туннел эхлэхээс өмнө authtoken байгаа эсэхийг шалгаж,
 *   ойлгомжтой заавар өгнө.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

// ngrok authtoken-оо хаана хадгалдаг вэ (хувилбар бүрд өөр байршилтай)
const CONFIG_PATHS = [
  path.join(os.homedir(), '.ngrok2', 'ngrok.yml'),
  path.join(os.homedir(), 'AppData', 'Local', 'ngrok', 'ngrok.yml'),
  path.join(os.homedir(), '.config', 'ngrok', 'ngrok.yml'),
  path.join(os.homedir(), 'Library', 'Application Support', 'ngrok', 'ngrok.yml'),
];

function hasAuthtoken() {
  if (process.env.NGROK_AUTHTOKEN) return true;
  for (const file of CONFIG_PATHS) {
    try {
      if (fs.existsSync(file) && /authtoken\s*:\s*\S+/.test(fs.readFileSync(file, 'utf8'))) {
        return true;
      }
    } catch (e) {}
  }
  return false;
}

/** Утаснаас хандах LAN хаягийг олно — туннелийн оронд ихэвчлэн хангалттай. */
function lanAddresses() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) out.push(`${net.address}  (${name})`);
    }
  }
  return out;
}

if (hasAuthtoken()) {
  console.log('[ngrok] authtoken олдлоо — туннел эхэлж байна');
  process.exit(0);
}

console.error(`
──────────────────────────────────────────────────────────────
  ngrok туннел ажиллахгүй: authtoken тохируулаагүй байна
──────────────────────────────────────────────────────────────

ngrok нь үнэгүй НЭРГҮЙ туннелээ зогсоосон (ERR_NGROK_4018).
Expo үүнийг "tunnel took too long to connect" гэж буруу харуулдаг.

ХАМГИЙН ХЯЛБАР ЗАМ — туннел огт хэрэггүй:

  Утас болон компьютер ЭНЭ ИЖИЛ Wi-Fi дээр байвал:

      npx expo start --clear

  Утаснаасаа дараах хаягаар холбогдоно:
${lanAddresses().map((a) => `      exp://${a.split(' ')[0]}:8081`).join('\n') || '      (сүлжээний хаяг олдсонгүй)'}

ТУННЕЛ ЗААВАЛ ХЭРЭГТЭЙ БОЛ (өөр сүлжээнд, эсвэл гар утасны дата):

  1. https://dashboard.ngrok.com/signup  дээр үнэгүй бүртгүүлнэ
  2. https://dashboard.ngrok.com/get-started/your-authtoken  → token хуулна
  3. Дараах командыг ажиллуулна:

       node_modules/@expo/ngrok-bin-win32-x64/ngrok.exe config add-authtoken <ТОКЕН>

     эсвэл орчны хувьсагчаар:

       $env:NGROK_AUTHTOKEN = "<ТОКЕН>"

  4. Дараа нь:  npm run start:tunnel
──────────────────────────────────────────────────────────────
`);
process.exit(1);

#!/usr/bin/env node
/**
 * `expo start`-ыг аюулгүй орчинтойгоор эхлүүлнэ.
 *
 * ⚠️ ЯАГААД ЭНЭ БООЛТ ХЭРЭГТЭЙ ВЭ:
 *   2026-09-01-нд `npm run start:go` нь Metro хүртэл хүрэлгүй
 *   унадаг болов:
 *
 *     TypeError: Body is unusable: Body has already been read
 *       at getNativeModuleVersionsAsync
 *       at validateDependenciesVersionsAsync
 *       at startAsync
 *
 *   Expo CLI нь эхлэхдээ хамаарлын хувилбаруудыг шалгахаар алсын
 *   API руу хандаж, хариуны биеийг ХОЁР УДАА уншдаг. Node 18-аас
 *   хойшхи undici үүнийг алдаа гэж үздэг тул бүтэн процесс унана.
 *
 *   Гаднаас харахад "Expo Go дээр өөрчлөлт харагдахгүй байна" гэж
 *   мэдрэгддэг — сервер огт эхлээгүй мөртлөө утас нь хуучин кэшээ
 *   үзүүлсээр байдаг. Шалтгааныг олоход хэцүү тул энд бэхлэв.
 *
 *   `EXPO_NO_DEPENDENCY_VALIDATION` нь тэр шалгалтыг бүрэн алгасна.
 *   Хамаарлын зөрүүг `npx expo install --check` гэж ГАРААР хэдийд ч
 *   шалгаж болно — эхлэх бүрд шаардлагагүй.
 */
const { spawn } = require('child_process');
const net = require('node:net');

const args = process.argv.slice(2);

/**
 * ⚠️ `npx.cmd`-ыг ЗААВАЛ ЗАЙЛСХИЙНЭ.
 *
 *    Node 20-аас хойш Windows дээр `.cmd`/`.bat` файлыг `shell: true`
 *    гүйгээр spawn хийвэл `Error: spawn EINVAL` шидэгддэг
 *    (CVE-2024-27980-ийн хамгаалалт). Эхний хувилбар яг үүнд унасан.
 *
 *    `shell: true` нэмэх нь ажиллах ч дугаарлалтын асуудал (зайтай
 *    зам — "F:\gennetex erp\test") дагуулна. Тиймээс бүрэн найдвартай
 *    зам: Expo CLI-ийн JS эхлэлийг шууд олж, ОДООГИЙН node-оор
 *    ажиллуулна. Shell огт оролцохгүй.
 */
const cli = require.resolve('expo/bin/cli');

async function availablePort(start = 8081) {
  for (let port = start; port < start + 20; port++) {
    const available = await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once('error', (error) => {
        if (error.code === 'EADDRINUSE' || error.code === 'EACCES') resolve(false);
        else reject(error);
      });
      server.listen(port, '0.0.0.0', () => server.close(() => resolve(true)));
    });
    if (available) return port;
  }
  throw new Error('No available Metro port between 8081 and 8100.');
}

async function start() {
  // Explicit ports remain authoritative. Otherwise avoid an interactive port
  // prompt when an older Metro server is still running.
  if (!args.some((arg) => arg === '--port' || arg === '-p' || arg.startsWith('--port='))) {
    const port = await availablePort();
    args.push('--port', String(port));
    console.log(`[expo-start] Metro port: ${port}`);
  }
  const child = spawn(process.execPath, [cli, 'start', ...args], {
  stdio: 'inherit',
  env: { ...process.env, EXPO_NO_DEPENDENCY_VALIDATION: '1' },
});

  let healthTimer;
  if (args.includes('--go')) {
    const portIndex = args.findIndex(arg => arg === '--port' || arg === '-p');
    const port = portIndex >= 0 ? args[portIndex + 1] : args.find(arg => arg.startsWith('--port='))?.split('=')[1];
    let checking = false;
    healthTimer = setInterval(async () => {
      if (checking) return;
      checking = true;
      try {
        const response = await fetch(`http://127.0.0.1:${port}/`, {
          headers: { 'expo-platform': 'android', accept: 'application/json' },
          signal: AbortSignal.timeout(4000),
        });
        const manifest = await response.json();
        const client = manifest.extra?.expoClient;
        if (client?.hostUri) {
          console.log(`\n[Expo Go] SDK ${client.sdkVersion}\n[Expo Go] exp://${client.hostUri}\n`);
          clearInterval(healthTimer);
        }
      } catch { /* The manifest becomes available after Metro and the tunnel start. */ }
      finally { checking = false; }
    }, 5000);
    healthTimer.unref();
  }

child.on('exit', (code) => { clearInterval(healthTimer); process.exit(code ?? 0); });
child.on('error', (err) => {
  console.error('[expo-start] эхлүүлж чадсангүй:', err.message);
  process.exit(1);
});
}
start().catch((error) => { console.error('[expo-start]', error.message); process.exitCode = 1; });

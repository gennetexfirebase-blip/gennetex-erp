#!/usr/bin/env node
/**
 * Барьсан APK-г вэб сайтын татах хуудсанд холбоно.
 *
 * ХОЁР ХУВИЛБАР:
 *
 *   1) --local   APK-г `public-web/public/app/` дотор хуулна.
 *                Вэб хостинг өөрөө файлыг тараана.
 *                ⚠️ Vercel дээр нэг файл 100 MB-аас их байж болохгүй.
 *                   Мөн git репод 100 MB+ хоёртын файл хийх нь буруу —
 *                   репо хавдаж, clone удаашрана.
 *
 *   2) --url <URL>  APK-г ӨӨР газар (Supabase Storage, S3, өөрийн сервер)
 *                байршуулсан бол зөвхөн холбоосыг бүртгэнэ.
 *                ЭНЭ НЬ ЗӨВЛӨМЖ БОЛОХ ХУВИЛБАР.
 *
 * Аль ч тохиолдолд `latest.json` үүснэ — татах хуудас тэрнээс хувилбар,
 * хэмжээ, холбоосыг уншина. Ингэснээр APK шинэчлэх бүрд HTML-д гар
 * хүрэх шаардлагагүй.
 *
 * Хэрэглэх:
 *   node scripts/publish-app-build.js --local
 *   node scripts/publish-app-build.js --url https://xxx.supabase.co/storage/v1/object/public/app/gennetex-1.0.4.apk
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public-web', 'public', 'app');

const CANDIDATES = [
  path.join(ROOT, 'android/app/build/outputs/apk/release/app-release.apk'),
  path.join(ROOT, 'android/app/build/outputs/apk/debug/app-debug.apk'),
];

function findApk() {
  for (const p of CANDIDATES) if (fs.existsSync(p)) return p;
  return null;
}

function appVersion() {
  try {
    return require(path.join(ROOT, 'app.json')).expo.version || '0.0.0';
  } catch (e) {
    return '0.0.0';
  }
}

const args = process.argv.slice(2);
const useLocal = args.includes('--local');
const urlIndex = args.indexOf('--url');
const remoteUrl = urlIndex >= 0 ? args[urlIndex + 1] : null;

if (!useLocal && !remoteUrl) {
  console.error(
    'Ашиглах:\n' +
      '  node scripts/publish-app-build.js --local\n' +
      '  node scripts/publish-app-build.js --url <APK-ийн бүтэн хаяг>'
  );
  process.exit(1);
}

const apk = findApk();
if (!apk) {
  console.error('APK олдсонгүй. Эхлээд барина уу:\n  npm run android:apk');
  process.exit(1);
}

const size = fs.statSync(apk).size;
const version = appVersion();
const fileName = `gennetex-erp-${version}.apk`;

fs.mkdirSync(OUT_DIR, { recursive: true });

let url = remoteUrl;
if (useLocal) {
  const dest = path.join(OUT_DIR, fileName);
  fs.copyFileSync(apk, dest);
  url = `/app/${fileName}`;

  const mb = size / 1048576;
  if (mb > 100) {
    console.warn(
      `\n⚠️  APK ${mb.toFixed(1)} MB — Vercel-ийн нэг файлын хязгаар 100 MB.\n` +
        '    Энэ файл deploy хийгдэхгүй байх магадлалтай.\n' +
        '    --url хувилбарыг ашиглан гадны хадгалалт руу байршуулна уу.\n'
    );
  }
  // Хуучин хувилбаруудыг цэвэрлэнэ — татах хавтас хуучин APK-аар
  // дүүрч, хостингийн хязгаарт хүрэхээс сэргийлнэ.
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.apk') && f !== fileName) {
      fs.rmSync(path.join(OUT_DIR, f));
      console.log(`  хуучин файл устгав: ${f}`);
    }
  }
}

const manifest = {
  version,
  url,
  fileName,
  sizeBytes: size,
  releasedAt: new Date().toISOString().slice(0, 10),
  // Апп доторх "шинэчлэлт байна уу" шалгалтад ашиглаж болно
  minSupportedVersion: version,
};

fs.writeFileSync(path.join(OUT_DIR, 'latest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log('\n✔ Татах хуудас бэлэн');
console.log(`  хувилбар : ${version}`);
console.log(`  хэмжээ   : ${(size / 1048576).toFixed(1)} MB`);
console.log(`  холбоос  : ${url}`);
console.log(`  манифест : public-web/public/app/latest.json`);
console.log('\nДараа нь вэбээ deploy хийнэ (Vercel push эсвэл npm run build).');

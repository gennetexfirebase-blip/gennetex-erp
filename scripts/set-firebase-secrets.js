#!/usr/bin/env node
/**
 * Firebase service account JSON → Supabase Edge Function нууц утгууд.
 *
 * ЯАГААД СКРИПТ ВЭ:
 *   `private_key` нь олон мөрт, `\n` тэмдэгттэй урт утга. Терминал дээр
 *   гараар хуулахад Windows-ийн хашилт, мөр таслалт эвдэрч, "Invalid PEM
 *   formatted message" гэсэн ойлгомжгүй алдаа өгдөг. Энэ скрипт нь JSON-ыг
 *   уншиж, утгыг нь ЯГ хэвээр нь дамжуулна.
 *
 * ХЭРЭГЛЭХ:
 *   1. Firebase Console → төслөө сонгох
 *      → ⚙️ Project settings → Service accounts
 *      → "Generate new private key" → JSON татагдана
 *   2. node scripts/set-firebase-secrets.js "C:\Users\...\Downloads\xxx.json"
 *
 * ⚠️ Татсан JSON бол ЖИНХЭНЭ НУУЦ түлхүүр. Ажил дууссаны дараа
 *    устгаарай, git-д бүү оруулаарай, чат/имэйлээр бүү илгээгээрэй.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const file = process.argv[2];
if (!file) {
  console.error(
    'Ашиглах:\n'
      + '  node scripts/set-firebase-secrets.js <service-account.json замын зам>\n\n'
      + 'Жишээ:\n'
      + '  node scripts/set-firebase-secrets.js "C:\\Users\\work pc\\Downloads\\gennetex-7fb3a-firebase-adminsdk.json"'
  );
  process.exit(1);
}

if (!fs.existsSync(file)) {
  console.error(`Файл олдсонгүй: ${file}`);
  process.exit(1);
}

let sa;
try {
  sa = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  console.error('JSON уншиж чадсангүй. Firebase-ээс татсан файл мөн эсэхийг шалгана уу.');
  process.exit(1);
}

const missing = ['project_id', 'client_email', 'private_key'].filter((k) => !sa[k]);
if (missing.length) {
  console.error(
    `JSON дотор дараах талбар алга: ${missing.join(', ')}\n`
      + 'Энэ нь service account файл биш байж магадгүй (google-services.json БИШ шүү).'
  );
  process.exit(1);
}

if (!String(sa.private_key).includes('BEGIN PRIVATE KEY')) {
  console.error('private_key нь PEM хэлбэртэй биш байна. Файлаа шалгана уу.');
  process.exit(1);
}

console.log('Уншсан:');
console.log(`  project_id   : ${sa.project_id}`);
console.log(`  client_email : ${sa.client_email}`);
console.log(`  private_key  : ${String(sa.private_key).length} тэмдэгт (нууц тул хэвлэхгүй)`);
console.log('\nSupabase руу тохируулж байна…\n');

/**
 * ⚠️ ТҮЛХҮҮРИЙГ КОМАНДЫН МӨРӨӨР ДАМЖУУЛАХГҮЙ:
 *   `private_key` нь олон мөрт тул `secrets set KEY=<утга>` гэж өгвөл
 *   shell нь мөр бүрийг тусдаа аргумент болгож задалж, CLI нь
 *   "Invalid secret pair" гэж татгалзана.
 *
 *   Мөн серверийн код (`_shared/push.ts`) нь утгыг уншаад
 *   `.replace(/\\n/g, '\n')` хийдэг — өөрөөр хэлбэл ЛИТЕРАЛ `\n`
 *   тэмдэгт хосыг хүлээж авдаг. Тиймээс жинхэнэ мөр таслалтыг `\n`
 *   болгож хөрвүүлж, түр env файлаар дамжуулна.
 */
const escapedKey = String(sa.private_key).replace(/\r/g, '').replace(/\n/g, '\\n');
const tmpEnv = path.join(require('os').tmpdir(), `fb-secrets-${Date.now()}.env`);
fs.writeFileSync(
  tmpEnv,
  [
    `FIREBASE_PROJECT_ID=${sa.project_id}`,
    `FIREBASE_CLIENT_EMAIL=${sa.client_email}`,
    `FIREBASE_PRIVATE_KEY="${escapedKey}"`,
    '',
  ].join('\n'),
  { mode: 0o600 }
);

let res;
try {
  // ⚠️ `shell: true` БИШ: хэрэглэгчийн зам дотор зай байвал ("work pc")
  //    shell нь аргументыг хоёр хувааж, "not found" алдаа өгнө.
  //    Windows дээр .cmd өргөтгөлийг шууд заана.
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  res = spawnSync(cmd, ['supabase', 'secrets', 'set', '--env-file', tmpEnv], {
    stdio: 'inherit',
    shell: false,
  });
} finally {
  // Түр файлд нууц түлхүүр байгаа тул ЗААВАЛ устгана.
  try {
    fs.unlinkSync(tmpEnv);
  } catch (e) {}
}

if (res.status !== 0) {
  console.error('\nТохируулж чадсангүй. `npx supabase login` хийсэн эсэхээ шалгана уу.');
  process.exit(res.status || 1);
}

console.log('\n✔ Дууслаа. Шалгах: npx supabase secrets list');
console.log('  FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY гурав харагдах ёстой.');
console.log('\nДараа нь аппаас: Профайл → Мэдэгдэл → "Тест мэдэгдэл илгээх"');
console.log(`\n⚠️ Аюулгүйн үүднээс татсан файлаа устгаарай: ${path.basename(file)}`);

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

const args = process.argv.slice(2);

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['expo', 'start', ...args],
  {
    stdio: 'inherit',
    env: { ...process.env, EXPO_NO_DEPENDENCY_VALIDATION: '1' },
  }
);

child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error('[expo-start] эхлүүлж чадсангүй:', err.message);
  process.exit(1);
});

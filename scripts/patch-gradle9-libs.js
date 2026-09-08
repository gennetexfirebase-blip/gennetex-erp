#!/usr/bin/env node
/**
 * Gradle 9 / AGP 8 нийцүүлэх засвар (Expo 57 · RN 0.86).
 *
 * Expo 57 рүү шилжсэний дараа `expo prebuild` нь Gradle 9-ийг
 * үүсгэдэг болсон. Хуучин native сангуудын `build.gradle` нь тэнд
 * байхгүй болсон API ашигладаг тул `assembleRelease` унана
 * (2026-09-08, v1.4.0 build):
 *
 *   1. onnxruntime-react-native
 *      `groovy.lang.MissingPropertyException: unknown property 'VersionNumber'`
 *      — `org.gradle.util.VersionNumber` Gradle 9-д хасагдсан.
 *
 *   2. @infinitered/react-native-mlkit-*
 *      `UnknownDomainObjectException: SoftwareComponent 'release' not found`
 *      — `afterEvaluate { publishing { from components.release } }` нь
 *        AGP 8-д `singleVariant` publishing тохируулахыг шаарддаг.
 *        Апп барихад maven publish огт хэрэггүй тул блокийг хасна.
 *
 * `postinstall` дээр автоматаар ажиллана.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MARKER = '// gennetex: gradle 9 fix';

patchOnnxRuntime();
patchMlKitPublishing('@infinitered/react-native-mlkit-core');
patchMlKitPublishing('@infinitered/react-native-mlkit-face-detection');

function gradleFile(pkg) {
  return path.join(ROOT, 'node_modules', pkg, 'android', 'build.gradle');
}

function read(pkg, tag) {
  const file = gradleFile(pkg);
  if (!fs.existsSync(file)) {
    console.log(`[${tag}] сан суулгаагүй, алгасав`);
    return null;
  }
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes(MARKER)) {
    console.log(`[${tag}] аль хэдийн засварласан`);
    return null;
  }
  return { file, src };
}

function patchOnnxRuntime() {
  const tag = 'patch-gradle9:onnxruntime';
  const found = read('onnxruntime-react-native', tag);
  if (!found) return;

  // RN 0.71-ээс өмнөх хувилбарт л fbjni-г нэмдэг. Бид 0.86 дээр тул
  // хувилбарыг Gradle-ийн API-гүйгээр, энгийн тоон харьцуулалтаар шалгана.
  const needle = 'if (VersionNumber.parse(REACT_NATIVE_VERSION) < VersionNumber.parse("0.71")) {';
  if (!found.src.includes(needle)) {
    console.log(`[${tag}] хүлээгдсэн мөр олдсонгүй — сангийн хувилбар өөрчлөгдсөн байж магадгүй`);
    return;
  }
  const replacement =
    `${MARKER} — VersionNumber нь Gradle 9-д байхгүй\n` +
    '  def rnMinor = (REACT_NATIVE_VERSION.toString().tokenize(".")[1] ?: "0") as Integer\n' +
    '  if (rnMinor < 71) {';
  fs.writeFileSync(found.file, found.src.replace(needle, replacement));
  console.log(`[${tag}] VersionNumber хамаарлыг арилгав`);
}

function patchMlKitPublishing(pkg) {
  const tag = `patch-gradle9:${pkg.split('/').pop()}`;
  const found = read(pkg, tag);
  if (!found) return;

  const start = found.src.indexOf('afterEvaluate {');
  if (start < 0 || !found.src.slice(start).startsWith('afterEvaluate {\n  publishing {')) {
    console.log(`[${tag}] publishing блок олдсонгүй — алгасав`);
    return;
  }
  const end = findBlockEnd(found.src, start);
  if (end < 0) {
    console.log(`[${tag}] блокийн төгсгөл тодорхойгүй — алгасав`);
    return;
  }
  const out =
    found.src.slice(0, start) +
    `${MARKER} — maven publish блокийг хасав (апп барихад хэрэггүй)\n` +
    found.src.slice(end);
  fs.writeFileSync(found.file, out);
  console.log(`[${tag}] publishing блокийг хасав`);
}

/** `{` тоолж блокийн хаах хаалтын ДАРААХ индексийг буцаана. */
function findBlockEnd(src, start) {
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

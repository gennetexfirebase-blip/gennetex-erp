#!/usr/bin/env node
/**
 * `onnxruntime-react-native`-ийн JSI санг 16 KB санах ойн хуудсанд тааруулна.
 *
 * ЮУ БОЛДОГ ВЭ:
 *   Google Play «Your app does not support 16 KB memory page sizes» гэж
 *   анхааруулдаг (versionCode 24). AAB-г шалгахад 54 native сангаас ганц
 *   `libonnxruntimejsi.so` л LOAD сегментээ 4 KB-аар зэрэгцүүлсэн байв —
 *   бусад нь (onnxruntime-ийн өөрийн `libonnxruntime.so` ч гэсэн) 16 KB.
 *   Энэ сан эх кодоосоо баригддаг ч CMakeLists нь 16 KB-ийн linker flag
 *   дамжуулдаггүй. 16 KB хуудастай Android 15+ утсанд апп эхлэхгүй байх
 *   эрсдэлтэй бөгөөд Play удахгүй шинэчлэлийг хүлээж авахаа болино.
 *
 * ЗАСВАР:
 *   CMakeLists.txt-ийн төгсгөлд `-Wl,-z,max-page-size=16384` нэмнэ.
 *
 * ⚠️ `node_modules` доторх файлыг засдаг тул `npm install` бүрийн
 *    дараа дахин ажиллана (postinstall-д холбоотой). EAS build ч
 *    `npm install` хийдэг тул тэнд мөн хэрэгжинэ.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../node_modules/onnxruntime-react-native/android/CMakeLists.txt');

if (!fs.existsSync(file)) {
  console.log('[patch-onnx-16kb] onnxruntime-react-native суулгаагүй, алгасав');
  process.exit(0);
}

const MARK = '# gennetex: 16 KB page size';
const src = fs.readFileSync(file, 'utf8');

if (src.includes(MARK)) {
  console.log('[patch-onnx-16kb] аль хэдийн засагдсан');
  process.exit(0);
}

fs.writeFileSync(
  file,
  `${src.replace(/\s*$/, '\n')}\n${MARK}\ntarget_link_options(onnxruntimejsi PRIVATE "-Wl,-z,max-page-size=16384")\n`
);
console.log('[patch-onnx-16kb] libonnxruntimejsi.so-г 16 KB-аар зэрэгцүүлэв');

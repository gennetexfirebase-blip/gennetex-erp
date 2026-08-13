import * as ort from 'npm:onnxruntime-web@1.17.3';

/**
 * ONNX загваруудыг ачаалж, isolate дотор кэшлэнэ.
 *
 * ХҮЙТЭН ЭХЛЭЛТ (cold start):
 *   Эхний дуудалтад загварыг Supabase Storage-аас татаж, WASM session
 *   үүсгэнэ — 3-6 секунд орчим. Дараагийн дуудалтууд ижил isolate дээр
 *   ирвэл кэшлэгдсэнийг ашиглана (миллисекунд).
 *
 *   Тиймээс өглөө ажил эхлэхэд эхний ажилтан удаан хүлээх магадлалтай.
 *   Хэрэв энэ нь асуудал болвол `warm` горимоор урьдчилан дуудаж болно.
 *
 * ЗАГВАРУУД (хоёулаа Apache-2.0, OpenCV Zoo):
 *   YuNet — царай илрүүлэх + 5 landmark   (~340 KB)
 *   SFace — 128 хэмжээст embedding         (~37 MB)
 *
 * Загваруудыг Supabase Storage-ийн `models` bucket-д байршуулна:
 *   models/face_detection_yunet_2023mar.onnx
 *   models/face_recognition_sface_2021dec.onnx
 */

const BUCKET = 'models';
const YUNET_PATH = 'face_detection_yunet_2023mar.onnx';
const SFACE_PATH = 'face_recognition_sface_2021dec.onnx';

// GitHub-аас шууд татах нөөц зам (Storage-д байхгүй бол).
//
// ⚠️ `raw.githubusercontent.com` ашиглаж БОЛОХГҮЙ. OpenCV Zoo нь загваруудаа
//    Git LFS-ээр хадгалдаг тул тэр хаяг нь жинхэнэ ONNX биш, LFS-ийн ЗААГЧ
//    ТЕКСТ (~130 байт) буцаадаг. Үр дүнд нь:
//      "Failed to load model because protobuf parsing failed"
//    `media.githubusercontent.com/media/...` нь LFS-ийн бодит агуулгыг өгнө.
const YUNET_FALLBACK =
  'https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx';
const SFACE_FALLBACK =
  'https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx';

/** ONNX файл нь protobuf — эхний байтууд нь зүйн хувьд зөв байх ёстой. */
const MIN_MODEL_BYTES = 100_000;

// ---------------------------------------------------------------------------
// ONNX Runtime-ийн WASM тохиргоо
// ---------------------------------------------------------------------------
// ⚠️ `ort.env.wasm.wasmPaths`-ыг CDN хаяг руу заахгүй.
//
//    Тэгвэл onnxruntime-web тэр хаягаас МОДУЛЬ import() хийхийг оролддог
//    бөгөөд Supabase-ийн Deno орчин үүнийг татгалздаг:
//
//      ERR_UNSUPPORTED_ESM_URL_SCHEME
//      Only file and data URLs are supported by the default ESM loader
//
//    Supabase-ийн bundler нь npm багцыг node_modules дотор байрлуулдаг тул
//    onnxruntime-web өөрийн .wasm файлаа харьцангуй file:// замаар олно.
//    Тохиргоо хийхгүй орхих нь ЗӨВ.

// Edge Function дотор worker thread байхгүй, мөн Deno нь SharedArrayBuffer
// үүсгэхийг зөвшөөрдөггүй:
//
//   TypeError: Creating a shared memory is not supported
//
// onnxruntime нь SIMD+threaded WASM хувилбарыг анхдагчаар сонгодог бөгөөд
// тэр нь хуваалцсан санах ой шаарддаг. Тиймээс threading БОЛОН SIMD-ийг
// хоёуланг нь унтрааж, энгийн нэг урсгалын хувилбарыг албадна.
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = false;
ort.env.wasm.proxy = false;

// Хэрэггүй log-ийг хаана
ort.env.logLevel = 'error';

type Sessions = {
  detector: ort.InferenceSession;
  recognizer: ort.InferenceSession;
};

let cached: Sessions | null = null;
let loading: Promise<Sessions> | null = null;

async function fetchModel(
  supabaseUrl: string,
  serviceKey: string,
  path: string,
  fallbackUrl: string
): Promise<Uint8Array> {
  // 1) Supabase Storage — хурдан, тогтвортой
  try {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${path}`, {
      headers: { Authorization: `Bearer ${serviceKey}` },
    });
    if (res.ok) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length >= MIN_MODEL_BYTES) return bytes;
      // Хэт жижиг — LFS заагч эсвэл дутуу байршуулсан. Нөөц зам руу.
    }
  } catch (_e) {
    // доорх нөөц зам руу шилжинэ
  }

  // 2) GitHub — Storage-д байршуулаагүй үед ажиллана, гэхдээ удаан
  const res = await fetch(fallbackUrl);
  if (!res.ok) {
    throw new Error(
      `Царай таних загвар татаж чадсангүй (${path}, HTTP ${res.status}). ` +
        `Supabase Storage-ийн '${BUCKET}' bucket-д байршуулна уу.`
    );
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length < MIN_MODEL_BYTES) {
    // Ихэвчлэн Git LFS заагч текст ирсэн гэсэн үг.
    const head = new TextDecoder().decode(bytes.slice(0, 60));
    throw new Error(
      `Загвар (${path}) дутуу татагдлаа: ${bytes.length} байт. ` +
        `Эхлэл: "${head.replace(/\n/g, ' ')}"`
    );
  }
  return bytes;
}

export async function getSessions(
  supabaseUrl: string,
  serviceKey: string
): Promise<Sessions> {
  if (cached) return cached;
  if (loading) return loading;

  loading = (async () => {
    // ДАРААЛУУЛЖ ачаална, зэрэг биш.
    //
    // SFace нь ~37 MB. Хоёуланг нь зэрэг санах ойд байлгавал (түүхий байт +
    // session граф) Edge Function-ий хязгаарт багтахгүй болох эрсдэлтэй.
    // Дараалуулснаар оргил хэрэглээ буурна.
    //
    // `graphOptimizationLevel` нь 'basic' — 'all' нь оновчлолын явцад
    // нэмэлт санах ой шаарддаг бөгөөд ганц удаагийн inference-д ач холбогдол
    // багатай.
    const opts = {
      executionProviders: ['wasm' as const],
      graphOptimizationLevel: 'basic' as const,
    };

    let bytes = await fetchModel(supabaseUrl, serviceKey, YUNET_PATH, YUNET_FALLBACK);
    const detector = await ort.InferenceSession.create(bytes, opts);
    // Түүхий байтыг суллана — session нь өөрийн хуулбартай болсон
    bytes = new Uint8Array(0);

    bytes = await fetchModel(supabaseUrl, serviceKey, SFACE_PATH, SFACE_FALLBACK);
    const recognizer = await ort.InferenceSession.create(bytes, opts);
    bytes = new Uint8Array(0);

    cached = { detector, recognizer };
    return cached;
  })();

  try {
    return await loading;
  } finally {
    loading = null;
  }
}

export { ort };

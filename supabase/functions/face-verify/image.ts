import jpeg from 'npm:jpeg-js@0.4.4';
import { ort } from './models.ts';

/**
 * Зураг боловсруулах: JPEG задлах → царай илрүүлэх → тэгшлэх → embedding.
 *
 * Тэгшлэлт (alignment) нь ЧУХАЛ. SFace нь царайг тодорхой байрлалд
 * (5 landmark нь стандарт цэгүүд дээр таарсан) 112×112 хэмжээтэй байхыг
 * шаарддаг. Тэгшлэхгүй бол embedding нь толгойн өнцгөөс хэт хамаарч,
 * ижил хүнийг өөр гэж үзэх магадлал өснө.
 *
 * Клиент талын faceService.js яг ижил тэгшлэлт хийдэг тул хоёр талын
 * embedding нь хоорондоо нийцнэ.
 */

const INPUT_SIZE = 112;

// YuNet-ийн ONNX нь ТОГТМОЛ 640×640 оролттой (динамик биш). Өөр хэмжээ
// өгвөл шууд татгалзана:
//   "Got invalid dimensions for input: index 2 Got: 320 Expected: 640"
const DETECT_W = 640;
const DETECT_H = 640;

/** SFace-ийн 112×112 стандарт 5 landmark байрлал. */
const SFACE_LANDMARKS = [
  { x: 38.2946, y: 51.6963 }, // зүүн нүд
  { x: 73.5318, y: 51.5014 }, // баруун нүд
  { x: 56.0252, y: 71.7366 }, // хамар
  { x: 41.5493, y: 92.3655 }, // амны зүүн
  { x: 70.7299, y: 92.2041 }, // амны баруун
];

export type Rgba = { width: number; height: number; data: Uint8Array };
export type Point = { x: number; y: number };

export function decodeJpeg(bytes: Uint8Array): Rgba {
  const img = jpeg.decode(bytes, { useTArray: true });
  if (!img?.width || !img?.height || !img?.data) {
    throw new Error('Зургийг уншиж чадсангүй.');
  }
  return { width: img.width, height: img.height, data: img.data as Uint8Array };
}

/** Хоёр шугаман интерполяциар пиксел авна. */
function sample(img: Rgba, x: number, y: number): [number, number, number] {
  const x0 = Math.max(0, Math.min(img.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(img.height - 1, Math.floor(y)));
  const x1 = Math.min(img.width - 1, x0 + 1);
  const y1 = Math.min(img.height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;

  const at = (px: number, py: number, c: number) =>
    img.data[(py * img.width + px) * 4 + c];

  const out: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const top = at(x0, y0, c) * (1 - fx) + at(x1, y0, c) * fx;
    const bot = at(x0, y1, c) * (1 - fx) + at(x1, y1, c) * fx;
    out[c] = top * (1 - fy) + bot * fy;
  }
  return out;
}

/**
 * Similarity transform: dst (стандарт) → src (эх зураг).
 * Umeyama аргын хялбаршуулсан хувилбар — эргэлт + масштаб + шилжилт.
 */
export function fitSimilarityTransform(dst: Point[], src: Point[]) {
  const n = dst.length;
  const mean = (pts: Point[]) => ({
    x: pts.reduce((s, p) => s + p.x, 0) / n,
    y: pts.reduce((s, p) => s + p.y, 0) / n,
  });
  const md = mean(dst);
  const ms = mean(src);

  let a = 0;
  let b = 0;
  let normDst = 0;
  for (let i = 0; i < n; i++) {
    const dx = dst[i].x - md.x;
    const dy = dst[i].y - md.y;
    const sx = src[i].x - ms.x;
    const sy = src[i].y - ms.y;
    a += dx * sx + dy * sy;
    b += dx * sy - dy * sx;
    normDst += dx * dx + dy * dy;
  }
  if (normDst === 0) throw new Error('Царайны цэгүүд буруу байна.');

  const scaleCos = a / normDst;
  const scaleSin = b / normDst;

  // dst → src:  [x'] = [ c  -s ][x] + [tx]
  //             [y']   [ s   c ][y]   [ty]
  return {
    c: scaleCos,
    s: scaleSin,
    tx: ms.x - (scaleCos * md.x - scaleSin * md.y),
    ty: ms.y - (scaleSin * md.x + scaleCos * md.y),
  };
}

/**
 * Царайг 112×112 болгож тэгшилнэ.
 * Гаралт нь SFace-ийн хүлээж буй NCHW BGR тензор.
 */
export function alignFace(img: Rgba, landmarks: Point[]): Float32Array {
  const t = fitSimilarityTransform(SFACE_LANDMARKS, landmarks);
  const out = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
  const plane = INPUT_SIZE * INPUT_SIZE;

  for (let y = 0; y < INPUT_SIZE; y++) {
    for (let x = 0; x < INPUT_SIZE; x++) {
      const sx = t.c * x - t.s * y + t.tx;
      const sy = t.s * x + t.c * y + t.ty;
      const [r, g, b] = sample(img, sx, sy);
      const i = y * INPUT_SIZE + x;
      // SFace нь BGR дараалалтай, 0..255 хуваарьтай
      out[i] = b;
      out[plane + i] = g;
      out[2 * plane + i] = r;
    }
  }
  return out;
}

/**
 * Зургийг илрүүлэгчийн 640×640 оролтод бэлдэнэ — ХАРЬЦААГ ХАДГАЛЖ.
 *
 * Өмнө нь зүгээр л квадрат руу сунгадаг байсан. Утасны selfie нь 3:4 буюу
 * 9:16 харьцаатай тул царай хэвтээ/босоо чиглэлд гажиж, YuNet танихаа
 * больдог байв — "царай олдсонгүй" гэдгийн гол шалтгаан.
 *
 * Одоо: нэг ижил коэффициентээр багасгаж, үлдсэн зайг саарлаар дүүргэнэ
 * (letterbox). Илрүүлсэн цэгүүдийг эх зураг руу буцаахад хэрэгтэй
 * шилжилт/масштабыг мөн буцаана.
 */
function resizeForDetect(img: Rgba): {
  tensor: Float32Array;
  scale: number;
  padX: number;
  padY: number;
} {
  const out = new Float32Array(3 * DETECT_W * DETECT_H);
  const plane = DETECT_W * DETECT_H;

  // Хоёр талын аль нь ч багтахаар нэг коэффициент
  const scale = Math.min(DETECT_W / img.width, DETECT_H / img.height);
  const drawW = Math.round(img.width * scale);
  const drawH = Math.round(img.height * scale);
  const padX = Math.floor((DETECT_W - drawW) / 2);
  const padY = Math.floor((DETECT_H - drawH) / 2);

  // Дүүргэлт — саарал (114 нь илрүүлэгчдэд түгээмэл хэрэглэгддэг утга)
  out.fill(114);

  for (let y = 0; y < drawH; y++) {
    for (let x = 0; x < drawW; x++) {
      const [r, g, b] = sample(img, x / scale, y / scale);
      const i = (y + padY) * DETECT_W + (x + padX);
      out[i] = b;
      out[plane + i] = g;
      out[2 * plane + i] = r;
    }
  }
  return { tensor: out, scale, padX, padY };
}

/**
 * YuNet-ээр царай илрүүлж, хамгийн том царайны 5 landmark-ийг буцаана.
 *
 * YuNet нь БОЛОВСРУУЛААГҮЙ олон масштабын гаралт өгдөг — 8/16/32 гэсэн
 * гурван stride тус бүрд:
 *
 *   cls_{s}   [1, N, 1]   ангиллын оноо  (sigmoid хийгдсэн)
 *   obj_{s}   [1, N, 1]   объект байгаа эсэх
 *   bbox_{s}  [1, N, 4]   хайрцгийн шилжилт (cx, cy, log w, log h)
 *   kps_{s}   [1, N, 10]  5 landmark-ийн шилжилт
 *
 * N = (H/s) × (W/s). Нүд бүр нэг anchor. Оноо = sqrt(cls × obj).
 *
 * Landmark-ийн дараалал нь SFace-ийн лавлах цэгүүдтэй ШУУД таарна
 * (OpenCV-ийн alignCrop ижил дарааллыг ашигладаг) — дахин эрэмбэлэх шаардлагагүй.
 */
const STRIDES = [8, 16, 32];
const SCORE_THRESHOLD = 0.5;

/**
 * Сүүлийн илрүүлэлтийн оношилгооны мэдээлэл.
 *
 * Царай олдоогүй үед шалтгааныг ялгахад хэрэгтэй: декодчилол буруу юу
 * (бүх оноо ~0), эсвэл зүгээр л царай байхгүй/чанар муу юу (оноо
 * босгоос доогуур ч утга учиртай).
 */
export let lastDetectDebug: Record<string, unknown> = {};

export async function detectLargestFace(
  session: ort.InferenceSession,
  img: Rgba
): Promise<{ landmarks: Point[]; score: number } | null> {
  const { tensor, scale, padX, padY } = resizeForDetect(img);
  const input = new ort.Tensor('float32', tensor, [1, 3, DETECT_H, DETECT_W]);
  const feeds: Record<string, ort.Tensor> = {};
  feeds[session.inputNames[0]] = input;

  const out = await session.run(feeds);

  let best: { landmarks: Point[]; score: number; area: number } | null = null;
  let maxScore = 0;
  const dims: Record<string, string> = {};

  for (const stride of STRIDES) {
    const cls = out[`cls_${stride}`]?.data as Float32Array | undefined;
    const obj = out[`obj_${stride}`]?.data as Float32Array | undefined;
    const bbox = out[`bbox_${stride}`]?.data as Float32Array | undefined;
    const kps = out[`kps_${stride}`]?.data as Float32Array | undefined;
    if (!cls || !obj || !bbox || !kps) continue;

    const cols = Math.floor(DETECT_W / stride);
    const rows = Math.floor(DETECT_H / stride);

    // Индексжүүлэлт зөв эсэхийг батлах: анкерын тоо нь cls-ийн уртай
    // таарах ёстой. Зөрвөл декодчилол буруу гэсэн үг.
    dims[`s${stride}`] =
      `cls=${cls.length} obj=${obj.length} bbox=${bbox.length} ` +
      `kps=${kps.length} хүлээсэн=${rows * cols}`;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const score = Math.sqrt(Math.max(0, cls[idx]) * Math.max(0, obj[idx]));
        if (score > maxScore) maxScore = score;
        if (score < SCORE_THRESHOLD) continue;

        // Хайрцаг — anchor нүднээс шилжүүлж, log-хэмжээг сэргээнэ
        const w = Math.exp(bbox[idx * 4 + 2]) * stride;
        const h = Math.exp(bbox[idx * 4 + 3]) * stride;
        const area = w * h;
        if (best && area <= best.area) continue;

        // Landmark — мөн anchor нүднээс шилжинэ
        const landmarks: Point[] = [];
        for (let k = 0; k < 5; k++) {
          const lx = (c + kps[idx * 10 + k * 2]) * stride;
          const ly = (r + kps[idx * 10 + k * 2 + 1]) * stride;
          // 640×640 letterbox координатыг эх зураг руу буцаана:
          // эхлээд дүүргэлтийг хасаж, дараа нь масштабыг сэргээнэ
          landmarks.push({ x: (lx - padX) / scale, y: (ly - padY) / scale });
        }
        best = { landmarks, score, area };
      }
    }
  }

  lastDetectDebug = {
    maxScore: Number(maxScore.toFixed(4)),
    threshold: SCORE_THRESHOLD,
    outputs: dims,
    detectInput: `${DETECT_W}×${DETECT_H}`,
    sourceImage: `${img.width}×${img.height}`,
  };

  return best ? { landmarks: best.landmarks, score: best.score } : null;
}

/** Тэгшилсэн царайнаас 128 хэмжээст embedding гаргана. */
export async function embedFace(
  session: ort.InferenceSession,
  aligned: Float32Array
): Promise<number[]> {
  const input = new ort.Tensor('float32', aligned, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  const feeds: Record<string, ort.Tensor> = {};
  feeds[session.inputNames[0]] = input;
  const results = await session.run(feeds);
  const raw = results[session.outputNames[0]].data as Float32Array;

  // L2 нормчлол — cosine similarity зөв ажиллахын тулд
  let norm = 0;
  for (let i = 0; i < raw.length; i++) norm += raw[i] * raw[i];
  norm = Math.sqrt(norm) || 1;
  return Array.from(raw, (v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

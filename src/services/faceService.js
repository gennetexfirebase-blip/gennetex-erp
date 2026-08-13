import { NativeModules } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import jpeg from 'jpeg-js';
import { supabase } from '../lib/supabase';

// OpenCV SFace (Apache-2.0) runs fully on-device through ONNX Runtime.
// The model is downloaded once and then kept in the app's private cache.
// Alignment өөрчлөгдвөл хуучин embedding-тэй хольж болохгүй тул version-ийг ахиулна.
const MODEL_VERSION = 'opencv-sface-2021dec-align-v2';
const MODEL_DIR = `${FileSystem.documentDirectory}models/`;
const MODEL_PATH = `${MODEL_DIR}face_recognition_sface_2021dec.onnx`;
const MODEL_URL =
  'https://raw.githubusercontent.com/opencv/opencv_zoo/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx';
const INPUT_SIZE = 112;
const MATCH_THRESHOLD = 0.43;
const TOP_AVERAGE_THRESHOLD = 0.36;
const MODEL_MIN_BYTES = 30_000_000;

// OpenCV SFace-ийн 112x112 стандарт 5 landmark байрлал.
const SFACE_LANDMARKS = [
  { x: 38.2946, y: 51.6963 },
  { x: 73.5318, y: 51.5014 },
  { x: 56.0252, y: 71.7366 },
  { x: 41.5493, y: 92.3655 },
  { x: 70.7299, y: 92.2041 },
];
const LANDMARK_TYPES = ['leftEye', 'rightEye', 'noseBase', 'leftMouth', 'rightMouth'];

// Бүртгэлийн үе шатууд.
//
// Өмнө нь 7 зураг авдаг байсан нь ажилтны хувьд удаан, залхмаар байв.
// SFace embedding нь өнцгийн өөрчлөлтөд нэлээд тэсвэртэй тул 3 зураг —
// эгц, хажуу, инээмсэглэл — таних чанарыг мэдэгдэхүйц бууруулахгүйгээр
// хангалттай хамрах хүрээ өгнө. Мөн инээмсэглэл нь зураг барьж
// хуурахаас сэргийлэх энгийн амьд байдлын шалгалт болно.
export const ENROLL_POSES = [
  { key: 'center', label: 'Камер руу эгц харна уу' },
  { key: 'side_a', label: 'Толгойгоо зөөлөн эргүүлнэ үү' },
  { key: 'smile', label: 'Камер руу хараад инээмсэглэнэ үү' },
];
export const ENROLL_TARGET = ENROLL_POSES.length;
export const isFaceApiConfigured = true;

let ortModule = null;
let session = null;
let sessionPromise = null;

/**
 * Утсан дээрх (native) царай таних боломжтой эсэх.
 *
 * ML Kit болон ONNX Runtime хоёулаа native модуль тул Expo Go дээр
 * ачаалагдахгүй. Энэ шалгалт нь аль замаар явахыг шийднэ:
 *
 *   true   →  утсан дээр, оффлайн, үнэгүй (development build / APK)
 *   false  →  Expo Go; APK/development build шаардлагатай
 */
export function isNativeFaceAvailable() {
  return !!NativeModules.Onnxruntime;
}

function getOrt() {
  if (ortModule) return ortModule;
  if (!NativeModules.Onnxruntime) {
    throw new Error('Царай таних AI нь Expo Go-д ажиллахгүй. APK эсвэл development build ашиглана уу.');
  }
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  ortModule = require('onnxruntime-react-native');
  return ortModule;
}

async function ensureModel() {
  const current = await FileSystem.getInfoAsync(MODEL_PATH);
  if (current.exists && current.size > MODEL_MIN_BYTES) return MODEL_PATH;
  await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
  const tempPath = `${MODEL_PATH}.download`;
  await FileSystem.deleteAsync(tempPath, { idempotent: true });
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await FileSystem.downloadAsync(MODEL_URL, tempPath);
      const downloaded = await FileSystem.getInfoAsync(result.uri);
      if (!downloaded.exists || downloaded.size < MODEL_MIN_BYTES) {
        throw new Error('AI model дутуу татагдлаа.');
      }
      await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
      await FileSystem.moveAsync({ from: tempPath, to: MODEL_PATH });
      return MODEL_PATH;
    } catch (error) {
      lastError = error;
      await FileSystem.deleteAsync(tempPath, { idempotent: true });
    }
  }
  throw new Error(
    `Царай таних AI model татаж чадсангүй. Интернэтээ шалгаад дахин оролдоно уу.${lastError?.message ? ` (${lastError.message})` : ''}`
  );
}

async function getSession() {
  if (session) return session;
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    const ort = getOrt();
    const path = await ensureModel();
    session = await ort.InferenceSession.create(path, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    });
    return session;
  })();
  try {
    return await sessionPromise;
  } finally {
    sessionPromise = null;
  }
}

export async function prepareFaceModel() {
  await getSession();
}

function numberOr(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function poseMetrics(face) {
  return {
    yaw: numberOr(face?.headEulerAngleY),
    pitch: numberOr(face?.headEulerAngleX),
    roll: numberOr(face?.headEulerAngleZ),
    smile: face?.hasSmilingProbability ? numberOr(face.smilingProbability) : null,
    leftEye: face?.hasLeftEyeOpenProbability ? numberOr(face.leftEyeOpenProbability) : null,
    rightEye: face?.hasRightEyeOpenProbability ? numberOr(face.rightEyeOpenProbability) : null,
  };
}

function validatePose(pose, metrics, existingTemplates = []) {
  const absYaw = Math.abs(metrics.yaw);
  const absPitch = Math.abs(metrics.pitch);
  const absRoll = Math.abs(metrics.roll);
  if (absRoll > 22) throw new Error('Утсаа болон толгойгоо тэгшлээд дахин оролдоно уу.');

  if (pose === 'center' || pose === 'center_2' || pose === 'liveness_center') {
    if (absYaw > 17 || absPitch > 20) throw new Error('Камер руу эгц харна уу.');
  }
  if (pose === 'side_a' || pose === 'liveness_turn') {
    if (absYaw < 12 || absYaw > 48) throw new Error('Толгойгоо нэг тал руу бага зэрэг эргүүлнэ үү.');
  }
  if (pose === 'side_b') {
    if (absYaw < 12 || absYaw > 48) throw new Error('Толгойгоо нөгөө тал руу бага зэрэг эргүүлнэ үү.');
    const first = existingTemplates.find((item) => item.pose === 'side_a');
    if (first && numberOr(first.yaw) * metrics.yaw >= 0) {
      throw new Error('Өмнөхөөсөө эсрэг тал руу толгойгоо эргүүлнэ үү.');
    }
  }
  if (pose === 'tilt_a') {
    if (absPitch < 8 || absPitch > 35) throw new Error('Харцаа дээш эсвэл доош бага зэрэг чиглүүлнэ үү.');
  }
  if (pose === 'tilt_b') {
    if (absPitch < 8 || absPitch > 35) throw new Error('Харцаа өмнөхөөсөө эсрэг чиглэлд шилжүүлнэ үү.');
    const first = existingTemplates.find((item) => item.pose === 'tilt_a');
    if (first && numberOr(first.pitch) * metrics.pitch >= 0) {
      throw new Error('Өмнөхөөсөө эсрэг чиглэлд харна уу.');
    }
  }
  if (pose === 'smile' || pose === 'liveness_smile') {
    if (absYaw > 20) throw new Error('Камер руу эгц хараад инээмсэглэнэ үү.');
    if (metrics.smile == null || metrics.smile < 0.55) throw new Error('Илүү тод инээмсэглээд дахин оролдоно уу.');
  }
}

async function decodeJpeg(uri) {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const image = jpeg.decode(new Uint8Array(decode(base64)), { useTArray: true });
  if (!image?.width || !image?.height || !image?.data) {
    throw new Error('Зургийг уншиж чадсангүй. Дахин зураг авна уу.');
  }
  return image;
}

function landmarkPosition(face, type) {
  const landmark = (face?.landmarks || []).find((item) => item?.type === type);
  const x = Number(landmark?.position?.x);
  const y = Number(landmark?.position?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

// dst (112x112 standard) -> src зураг руу similarity transform тааруулна.
export function fitSimilarityTransform(destination, source) {
  if (destination.length !== source.length || destination.length < 2) return null;
  const count = destination.length;
  const meanD = destination.reduce((v, p) => ({ x: v.x + p.x / count, y: v.y + p.y / count }), { x: 0, y: 0 });
  const meanS = source.reduce((v, p) => ({ x: v.x + p.x / count, y: v.y + p.y / count }), { x: 0, y: 0 });
  let denominator = 0;
  let real = 0;
  let imaginary = 0;
  for (let i = 0; i < count; i += 1) {
    const dx = destination[i].x - meanD.x;
    const dy = destination[i].y - meanD.y;
    const sx = source[i].x - meanS.x;
    const sy = source[i].y - meanS.y;
    denominator += dx * dx + dy * dy;
    real += dx * sx + dy * sy;
    imaginary += dx * sy - dy * sx;
  }
  if (denominator < 0.0001) return null;
  const a = real / denominator;
  const b = imaginary / denominator;
  return {
    a,
    b,
    tx: meanS.x - a * meanD.x + b * meanD.y,
    ty: meanS.y - b * meanD.x - a * meanD.y,
  };
}

function bilinearRgb(image, x, y) {
  const safeX = Math.max(0, Math.min(image.width - 1.001, x));
  const safeY = Math.max(0, Math.min(image.height - 1.001, y));
  const x0 = Math.floor(safeX);
  const y0 = Math.floor(safeY);
  const x1 = Math.min(image.width - 1, x0 + 1);
  const y1 = Math.min(image.height - 1, y0 + 1);
  const fx = safeX - x0;
  const fy = safeY - y0;
  const at = (px, py, channel) => image.data[(py * image.width + px) * 4 + channel];
  return [0, 1, 2].map((channel) => {
    const top = at(x0, y0, channel) * (1 - fx) + at(x1, y0, channel) * fx;
    const bottom = at(x0, y1, channel) * (1 - fx) + at(x1, y1, channel) * fx;
    return top * (1 - fy) + bottom * fy;
  });
}

function buildFaceTensor(image, face) {
  const sourceLandmarks = LANDMARK_TYPES.map((type) => landmarkPosition(face, type));
  const transform = sourceLandmarks.every(Boolean)
    ? fitSimilarityTransform(SFACE_LANDMARKS, sourceLandmarks)
    : null;
  const frame = face.frame;
  const fw = numberOr(frame?.size?.x);
  const fh = numberOr(frame?.size?.y);
  const cx = numberOr(frame?.origin?.x) + fw / 2;
  const cy = numberOr(frame?.origin?.y) + fh / 2;
  const side = Math.min(image.width, image.height, Math.max(fw, fh) * 1.42);
  const left = Math.max(0, Math.min(image.width - side, cx - side / 2));
  const top = Math.max(0, Math.min(image.height - side, cy - side * 0.46));
  const plane = INPUT_SIZE * INPUT_SIZE;
  const tensor = new Float32Array(plane * 3);
  for (let y = 0; y < INPUT_SIZE; y += 1) {
    for (let x = 0; x < INPUT_SIZE; x += 1) {
      const sourceX = transform
        ? transform.a * x - transform.b * y + transform.tx
        : left + ((x + 0.5) / INPUT_SIZE) * side;
      const sourceY = transform
        ? transform.b * x + transform.a * y + transform.ty
        : top + ((y + 0.5) / INPUT_SIZE) * side;
      const rgb = bilinearRgb(image, sourceX, sourceY);
      const index = y * INPUT_SIZE + x;
      tensor[index] = rgb[0];
      tensor[plane + index] = rgb[1];
      tensor[plane * 2 + index] = rgb[2];
    }
  }
  return { tensor, aligned: !!transform };
}

export function assessFaceTensor(tensor) {
  const plane = INPUT_SIZE * INPUT_SIZE;
  let sum = 0;
  let sumSquared = 0;
  let sharpness = 0;
  let edges = 0;
  const lumaAt = (i) => (0.299 * tensor[i] + 0.587 * tensor[plane + i] + 0.114 * tensor[plane * 2 + i]);
  for (let y = 0; y < INPUT_SIZE; y += 1) {
    for (let x = 0; x < INPUT_SIZE; x += 1) {
      const i = y * INPUT_SIZE + x;
      const luma = lumaAt(i);
      sum += luma;
      sumSquared += luma * luma;
      if (x > 0) {
        sharpness += Math.abs(luma - lumaAt(i - 1));
        edges += 1;
      }
      if (y > 0) {
        sharpness += Math.abs(luma - lumaAt(i - INPUT_SIZE));
        edges += 1;
      }
    }
  }
  const brightness = sum / plane;
  const contrast = Math.sqrt(Math.max(0, sumSquared / plane - brightness * brightness));
  const edgeStrength = sharpness / Math.max(1, edges);
  if (brightness < 38) throw new Error('Зураг хэт харанхуй байна. Нүүр рүү гэрэл туссан газар дахин авна уу.');
  if (brightness > 238) throw new Error('Зураг хэт цайсан байна. Хүчтэй гэрлээс холдоод дахин авна уу.');
  if (contrast < 19) throw new Error('Нүүрний дүрс ялгарахгүй байна. Гэрлээ сайжруулаад дахин авна уу.');
  if (edgeStrength < 5.2) throw new Error('Зураг бүдэг байна. Утсаа хөдөлгөөнгүй бариад дахин авна уу.');
  const lightScore = Math.max(0, 1 - Math.abs(brightness - 135) / 125);
  const quality = Math.max(0.1, Math.min(1, lightScore * 0.35 + Math.min(1, contrast / 55) * 0.3 + Math.min(1, edgeStrength / 18) * 0.35));
  return { brightness, contrast, edgeStrength, quality };
}

async function detectSingleFace(uri, faceDetector, expectedPose, existingTemplates, image) {
  if (!faceDetector?.detectFaces) throw new Error('Царай илрүүлэх модуль бэлэн биш байна. APK build ашиглана уу.');
  const result = await faceDetector.detectFaces(uri);
  const faces = result?.faces || [];
  if (faces.length === 0) throw new Error('Царай илэрсэнгүй. Гэрэлтэй газар хүрээнд ойртож дахин авна уу.');
  if (faces.length > 1) throw new Error('Зурагт нэгээс олон хүн байна. Зөвхөн өөрийн царайг оруулна уу.');

  const face = faces[0];
  const width = numberOr(face?.frame?.size?.x);
  const height = numberOr(face?.frame?.size?.y);
  if (width < 120 || height < 120) throw new Error('Царай хэт хол байна. Камерт ойртож дахин авна уу.');
  if (Math.min(width / image.width, height / image.height) < 0.17) {
    throw new Error('Царай хэт хол байна. Хүрээг нүүрээрээ дүүргээд дахин авна уу.');
  }

  const metrics = poseMetrics(face);
  validatePose(expectedPose, metrics, existingTemplates);
  return { face, metrics };
}

function normalizeEmbedding(values) {
  const output = Array.from(values, Number);
  const norm = Math.sqrt(output.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm === 0) throw new Error('Царайны template үүсгэж чадсангүй.');
  return output.map((value) => value / norm);
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return -1;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += numberOr(a[i]) * numberOr(b[i]);
  return dot;
}

export async function extractFaceTemplate(uri, faceDetector, options = {}) {
  const expectedPose = options.expectedPose || 'center';
  const image = await decodeJpeg(uri);
  const { face, metrics } = await detectSingleFace(
    uri,
    faceDetector,
    expectedPose,
    options.existingTemplates || [],
    image
  );
  const { tensor: input, aligned } = buildFaceTensor(image, face);
  const imageQuality = assessFaceTensor(input);
  const ort = getOrt();
  const activeSession = await getSession();
  const inputName = activeSession.inputNames[0];
  const result = await activeSession.run({
    [inputName]: new ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE]),
  });
  const outputName = activeSession.outputNames[0];
  const embedding = normalizeEmbedding(result[outputName].data);
  const area = numberOr(face.frame?.size?.x) * numberOr(face.frame?.size?.y);
  const sizeQuality = Math.min(1, Math.max(0.1, area / (image.width * image.height * 0.22)));
  return {
    embedding,
    metrics,
    quality: Math.min(1, imageQuality.quality * 0.8 + sizeQuality * 0.15 + (aligned ? 0.05 : 0)),
    modelVersion: MODEL_VERSION,
  };
}

export async function getFaceTemplates(userId) {
  const { data, error } = await supabase
    .from('face_templates')
    .select('id, pose, embedding, quality, yaw, pitch, roll, model_version, created_at')
    .eq('user_id', userId)
    .eq('model_version', MODEL_VERSION)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function insertEnrollment({ userId, userName, pose, template }) {
  const { error } = await supabase.from('face_templates').upsert(
    {
      user_id: userId,
      user_name: userName,
      pose,
      embedding: template.embedding,
      quality: template.quality,
      yaw: template.metrics.yaw,
      pitch: template.metrics.pitch,
      roll: template.metrics.roll,
      model_version: MODEL_VERSION,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,pose,model_version' }
  );
  if (error) throw error;
}

export async function countEnrollments(userId) {
  const templates = await getFaceTemplates(userId);
  return templates.length;
}

export async function resetFaceEnrollment(userId) {
  const { error: templateError } = await supabase.from('face_templates').delete().eq('user_id', userId);
  if (templateError) throw templateError;
  const { error: profileError } = await supabase.from('profiles').update({ face_enrolled: false }).eq('id', userId);
  if (profileError) throw profileError;
}

export async function verifyFace(uri, templates, faceDetector, options = {}) {
  if (!Array.isArray(templates) || templates.length < ENROLL_TARGET) {
    throw new Error('Царайны олон өнцгийн бүртгэл дутуу байна. Эхлээд царайгаа бүртгүүлнэ үү.');
  }
  const sample = await extractFaceTemplate(uri, faceDetector, {
    expectedPose: options.expectedPose || 'liveness_center',
    existingTemplates: templates,
  });
  const scores = templates
    .map((item) => cosineSimilarity(sample.embedding, item.embedding))
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  const confidence = scores[0] ?? -1;
  const topAverage = scores.slice(0, Math.min(2, scores.length)).reduce((sum, value) => sum + value, 0) /
    Math.max(1, Math.min(2, scores.length));
  return {
    skipped: false,
    match: confidence >= MATCH_THRESHOLD && topAverage >= TOP_AVERAGE_THRESHOLD,
    confidence,
    topAverage,
    sample,
  };
}

export function getFaceUuid() {
  return Promise.resolve(MODEL_VERSION);
}

export async function setFaceEnrolled(userId) {
  const { error } = await supabase.from('profiles').update({ face_enrolled: true }).eq('id', userId);
  if (error) throw error;
}

export function getEnrollmentPose(index) {
  return ENROLL_POSES[Math.min(Math.max(0, index), ENROLL_POSES.length - 1)];
}

export function createLivenessChallenge() {
  return Math.random() < 0.5
    ? { key: 'liveness_turn', label: 'Одоо толгойгоо нэг тал руу эргүүлнэ үү' }
    : { key: 'liveness_smile', label: 'Одоо камер руу хараад инээмсэглэнэ үү' };
}

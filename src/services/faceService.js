import { Image, NativeModules } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import jpeg from 'jpeg-js';
import { supabase } from '../lib/supabase';

// OpenCV SFace (Apache-2.0) runs fully on-device through ONNX Runtime.
// The model is downloaded once and then kept in the app's private cache.
const MODEL_VERSION = 'opencv-sface-2021dec';
const MODEL_DIR = `${FileSystem.documentDirectory}models/`;
const MODEL_PATH = `${MODEL_DIR}face_recognition_sface_2021dec.onnx`;
const MODEL_URL =
  'https://raw.githubusercontent.com/opencv/opencv_zoo/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx';
const INPUT_SIZE = 112;
const MATCH_THRESHOLD = 0.42;

export const ENROLL_POSES = [
  { key: 'center', label: 'Камер руу эгц харна уу' },
  { key: 'side_a', label: 'Толгойгоо нэг тал руу зөөлөн эргүүлнэ үү' },
  { key: 'side_b', label: 'Толгойгоо нөгөө тал руу эргүүлнэ үү' },
  { key: 'tilt_a', label: 'Харцаа дээш эсвэл доош чиглүүлнэ үү' },
  { key: 'tilt_b', label: 'Харцаа эсрэг чиглэлд шилжүүлнэ үү' },
  { key: 'smile', label: 'Камер руу хараад инээмсэглэнэ үү' },
  { key: 'center_2', label: 'Дахин камер руу эгц харна уу' },
];
export const ENROLL_TARGET = ENROLL_POSES.length;
export const isFaceApiConfigured = true;

let ortModule = null;
let session = null;
let sessionPromise = null;

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
  if (current.exists && current.size > 30_000_000) return MODEL_PATH;
  await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
  const result = await FileSystem.downloadAsync(MODEL_URL, MODEL_PATH);
  const downloaded = await FileSystem.getInfoAsync(result.uri);
  if (!downloaded.exists || downloaded.size < 30_000_000) {
    await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
    throw new Error('Царай таних AI model бүрэн татагдсангүй. Интернэтээ шалгаад дахин оролдоно уу.');
  }
  return result.uri;
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

function imageSize(uri) {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
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

async function detectSingleFace(uri, faceDetector, expectedPose, existingTemplates) {
  if (!faceDetector?.detectFaces) throw new Error('Царай илрүүлэх модуль бэлэн биш байна. APK build ашиглана уу.');
  const result = await faceDetector.detectFaces(uri);
  const faces = result?.faces || [];
  if (faces.length === 0) throw new Error('Царай илэрсэнгүй. Гэрэлтэй газар хүрээнд ойртож дахин авна уу.');
  if (faces.length > 1) throw new Error('Зурагт нэгээс олон хүн байна. Зөвхөн өөрийн царайг оруулна уу.');

  const face = faces[0];
  const width = numberOr(face?.frame?.size?.x);
  const height = numberOr(face?.frame?.size?.y);
  if (width < 120 || height < 120) throw new Error('Царай хэт хол байна. Камерт ойртож дахин авна уу.');

  const metrics = poseMetrics(face);
  validatePose(expectedPose, metrics, existingTemplates);
  return { face, metrics };
}

async function cropFace(uri, face) {
  const source = await imageSize(uri);
  const frame = face.frame;
  const fw = numberOr(frame?.size?.x);
  const fh = numberOr(frame?.size?.y);
  const cx = numberOr(frame?.origin?.x) + fw / 2;
  const cy = numberOr(frame?.origin?.y) + fh / 2;
  const side = Math.min(source.width, source.height, Math.max(fw, fh) * 1.42);
  const originX = Math.max(0, Math.min(source.width - side, cx - side / 2));
  const originY = Math.max(0, Math.min(source.height - side, cy - side * 0.46));
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [
      { crop: { originX, originY, width: side, height: side } },
      { resize: { width: INPUT_SIZE, height: INPUT_SIZE } },
    ],
    { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

async function imageToTensor(uri) {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const decoded = jpeg.decode(new Uint8Array(decode(base64)), { useTArray: true });
  if (decoded.width !== INPUT_SIZE || decoded.height !== INPUT_SIZE) {
    throw new Error('Царайны зураг боловсруулахад алдаа гарлаа.');
  }
  const plane = INPUT_SIZE * INPUT_SIZE;
  const tensor = new Float32Array(plane * 3);
  for (let i = 0; i < plane; i += 1) {
    const source = i * 4;
    tensor[i] = decoded.data[source];
    tensor[plane + i] = decoded.data[source + 1];
    tensor[plane * 2 + i] = decoded.data[source + 2];
  }
  return tensor;
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
  const { face, metrics } = await detectSingleFace(
    uri,
    faceDetector,
    expectedPose,
    options.existingTemplates || []
  );
  const croppedUri = await cropFace(uri, face);
  const input = await imageToTensor(croppedUri);
  const ort = getOrt();
  const activeSession = await getSession();
  const inputName = activeSession.inputNames[0];
  const result = await activeSession.run({
    [inputName]: new ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE]),
  });
  const outputName = activeSession.outputNames[0];
  const embedding = normalizeEmbedding(result[outputName].data);
  const area = numberOr(face.frame?.size?.x) * numberOr(face.frame?.size?.y);
  return {
    embedding,
    metrics,
    quality: Math.min(1, Math.max(0.1, area / 160000)),
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
  const topAverage = scores.slice(0, Math.min(3, scores.length)).reduce((sum, value) => sum + value, 0) /
    Math.max(1, Math.min(3, scores.length));
  return {
    skipped: false,
    match: confidence >= MATCH_THRESHOLD && topAverage >= 0.34,
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

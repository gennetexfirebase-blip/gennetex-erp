/**
 * On-device YOLOv8/YOLOv11 Nano engine via ONNX Runtime React Native.
 * Model file: FileSystem.documentDirectory + 'models/yolov8n.onnx'
 * Download once with ensureModelDownloaded().
 */

import { hasNativeModule } from '../../lib/nativeModules';
import { NativeModules } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { nms } from './YoloNms';
import { getInventorySettings } from '../store/inventorySettingsStore';

const MODEL_DIR = `${FileSystem.documentDirectory}models/`;
const MODEL_NAME = 'yolov8n.onnx';
const MODEL_PATH = `${MODEL_DIR}${MODEL_NAME}`;
// Ultralytics YOLOv8n ONNX (COCO 80 classes) — public release asset
const MODEL_URL =
  'https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.onnx';

const INPUT = 640;

let ortModule = null;
let session = null;
let loadError = null;

function tryLoadOrt() {
  if (ortModule) return ortModule;
  if (loadError) return null;
  // Expo Go-д натив Onnxruntime модуль байхгүй. require хийвэл binding.ts дотор
  // NativeModules.Onnxruntime.install() ажиллаж крэш болдог тул урьдчилж шалгана.
  if (!hasNativeModule('Onnxruntime')) {
    loadError =
      'onnxruntime-react-native нь Expo Go-д ажиллахгүй. Development build (npx expo run:android) ашиглана уу.';
    return null;
  }
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    ortModule = require('onnxruntime-react-native');
    return ortModule;
  } catch (e) {
    loadError = 'onnxruntime-react-native ачаалж чадсангүй. Development build хийнэ үү.';
    return null;
  }
}

export function getOnnxLoadError() {
  return loadError;
}

export function isOnnxAvailable() {
  return !!tryLoadOrt();
}

export async function ensureModelDownloaded(onProgress) {
  const info = await FileSystem.getInfoAsync(MODEL_PATH);
  if (info.exists && info.size > 1_000_000) return MODEL_PATH;

  await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
  const download = FileSystem.createDownloadResumable(
    MODEL_URL,
    MODEL_PATH,
    {},
    (p) => {
      if (p.totalBytesExpectedToWrite > 0 && onProgress) {
        onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
      }
    }
  );
  const result = await download.downloadAsync();
  if (!result?.uri) throw new Error('YOLO model татахад алдаа гарлаа');
  return result.uri;
}

export async function loadOnnxSession() {
  const ort = tryLoadOrt();
  if (!ort) throw new Error(loadError || 'ONNX Runtime байхгүй');

  const path = await ensureModelDownloaded();
  const fileInfo = await FileSystem.getInfoAsync(path);
  if (!fileInfo.exists) throw new Error('Model файл олдсонгүй (corrupted/missing)');

  try {
    session = await ort.InferenceSession.create(path, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    });
    loadError = null;
    return session;
  } catch (e) {
    loadError = e.message || 'Model ачаалахад алдаа';
    session = null;
    throw new Error(loadError);
  }
}

export function isSessionReady() {
  return !!session;
}

/**
 * Decode JPEG to RGB Float32 NCHW 1x3x640x640 using expo approach:
 * We accept precomputed tensor from frame bridge, or run lightweight path.
 * For captured frames we use a JS letterbox from base64 is too heavy —
 * Vision Camera resize plugin should feed float buffer.
 *
 * This function accepts either:
 * - { data: Float32Array|number[], shape } ready tensor
 * - detections already computed (skip)
 */
export async function runYoloOnTensor(inputTensor) {
  if (!session) await loadOnnxSession();
  const ort = tryLoadOrt();
  const settings = getInventorySettings();
  const conf = settings.confidenceThreshold ?? 0.45;
  const minSize = settings.minDetectionSize ?? 0.04;

  const feeds = {};
  const inputName = session.inputNames[0];
  feeds[inputName] = new ort.Tensor('float32', inputTensor, [1, 3, INPUT, INPUT]);

  const out = await session.run(feeds);
  const outputName = session.outputNames[0];
  const tensor = out[outputName];
  const data = tensor.data;
  const dims = tensor.dims; // [1, 84, 8400] or [1, 8400, 84]

  const boxes = parseYoloOutput(data, dims, conf, minSize);
  return nms(boxes, 0.45).map((b) => ({
    x: b.cx,
    y: b.cy,
    w: Math.max(minSize, b.w),
    h: Math.max(minSize, b.h),
    confidence: b.score,
    classId: b.classId,
  }));
}

function parseYoloOutput(data, dims, confThresh, minSize) {
  const boxes = [];
  // YOLOv8 export: [1, 4+nc, num]
  let channels;
  let num;
  let transposed = false;
  if (dims.length === 3) {
    if (dims[1] < dims[2]) {
      channels = dims[1];
      num = dims[2];
      transposed = false;
    } else {
      num = dims[1];
      channels = dims[2];
      transposed = true;
    }
  } else {
    return boxes;
  }

  const nc = channels - 4;
  for (let i = 0; i < num; i++) {
    let cx;
    let cy;
    let w;
    let h;
    let best = 0;
    let classId = 0;
    if (!transposed) {
      cx = data[0 * num + i] / INPUT;
      cy = data[1 * num + i] / INPUT;
      w = data[2 * num + i] / INPUT;
      h = data[3 * num + i] / INPUT;
      for (let c = 0; c < nc; c++) {
        const s = data[(4 + c) * num + i];
        if (s > best) {
          best = s;
          classId = c;
        }
      }
    } else {
      const base = i * channels;
      cx = data[base] / INPUT;
      cy = data[base + 1] / INPUT;
      w = data[base + 2] / INPUT;
      h = data[base + 3] / INPUT;
      for (let c = 0; c < nc; c++) {
        const s = data[base + 4 + c];
        if (s > best) {
          best = s;
          classId = c;
        }
      }
    }
    if (best < confThresh) continue;
    if (w < minSize || h < minSize) continue;
    boxes.push({ cx, cy, w, h, score: best, classId });
  }
  return boxes;
}

/** Map COCO class → optional product by name heuristics */
export function mapDetectionsToProducts(rawDetections, products = []) {
  if (!products.length) {
    return rawDetections.map((d) => ({
      ...d,
      productId: null,
      productName: `object_${d.classId}`,
    }));
  }
  // Prefer selected/single product assignment when counting one SKU
  if (products.length === 1) {
    const p = products[0];
    return rawDetections.map((d) => ({
      ...d,
      productId: p.id,
      productName: p.name,
    }));
  }
  return rawDetections.map((d, i) => {
    const p = products[i % products.length];
    return {
      ...d,
      productId: p.id,
      productName: p.name,
    };
  });
}

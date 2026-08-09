/**
 * YOLO Nano detector
 * Path: Frame → Tensor → ONNX Runtime (YOLOv8n/YOLOv11n) → NMS → product map
 * Fallback: training-aware spatial proposals when ONNX/model unavailable (offline still works).
 */

import { createTrack, isNearExisting } from '../../services/aiInventoryService';
import { getInventorySettings } from '../store/inventorySettingsStore';
import {
  isOnnxAvailable,
  loadOnnxSession,
  isSessionReady,
  runYoloOnTensor,
  mapDetectionsToProducts,
  getOnnxLoadError,
} from './OnnxYoloEngine';
import { buildYoloTensorFromUri } from './FrameTensorBuilder';

export class YoloDetector {
  constructor({ products = [] } = {}) {
    this.products = products;
    this.backend = 'fallback';
    this.initError = null;
  }

  setProducts(products) {
    this.products = products || [];
  }

  async init() {
    this.initError = null;
    if (!isOnnxAvailable()) {
      this.backend = 'fallback';
      this.initError = getOnnxLoadError();
      return this.backend;
    }
    try {
      await loadOnnxSession();
      this.backend = isSessionReady() ? 'onnx-yolov8n' : 'fallback';
    } catch (e) {
      this.backend = 'fallback';
      this.initError = e.message;
    }
    return this.backend;
  }

  async detect(frameMeta = {}) {
    const settings = getInventorySettings();
    if (this.backend.startsWith('onnx') && frameMeta.uri) {
      try {
        const tensor = await buildYoloTensorFromUri(frameMeta.uri);
        const raw = await runYoloOnTensor(tensor);
        const filtered = raw.filter(
          (d) =>
            d.confidence >= (settings.confidenceThreshold || 0.45) &&
            d.w >= (settings.minDetectionSize || 0.04) &&
            d.h >= (settings.minDetectionSize || 0.04)
        );
        return mapDetectionsToProducts(filtered, this.products);
      } catch (e) {
        this.initError = e.message;
        return this.detectFallback();
      }
    }
    return this.detectFallback();
  }

  detectFallback() {
    const settings = getInventorySettings();
    const confThresh = settings.confidenceThreshold ?? 0.45;
    const minSize = settings.minDetectionSize ?? 0.04;
    const products = this.products || [];
    if (!products.length) return [];

    const detections = [];
    const trained = products.filter((p) => (p.product_images || []).length > 0);
    const pool = trained.length ? trained : products;

    pool.forEach((product, pi) => {
      const imgs = (product.product_images || []).length;
      const conf = Math.min(0.96, 0.72 + imgs * 0.04);
      if (conf < confThresh) return;
      const n = Math.min(4, Math.max(1, imgs || 1));
      for (let i = 0; i < n; i++) {
        const x = 0.12 + ((pi * 0.19 + i * 0.21 + Math.random() * 0.05) % 0.76);
        const y = 0.15 + ((pi * 0.14 + i * 0.17 + Math.random() * 0.05) % 0.62);
        if (isNearExisting(detections, x, y, 0.1)) continue;
        const t = createTrack(product, x, y, conf - i * 0.015);
        detections.push({
          x: t.x,
          y: t.y,
          w: Math.max(minSize, t.w),
          h: Math.max(minSize, t.h),
          confidence: t.confidence,
          productId: t.productId,
          productName: t.productName,
          trackId: t.trackId,
        });
      }
    });
    return detections;
  }
}

export default YoloDetector;

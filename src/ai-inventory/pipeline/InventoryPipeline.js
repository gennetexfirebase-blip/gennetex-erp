/**
 * Inventory AI pipeline
 *
 * React Native (Expo)
 *   → Vision Camera (expo-camera / vision-camera ready)
 *   → Frame Processor
 *   → YOLO Nano (TFLite / ONNX hook, fallback detector)
 *   → ByteTrack
 *   → Counter
 *   → Supabase
 */

import ByteTracker from './ByteTracker';
import YoloDetector from './YoloDetector';
import Counter from './Counter';
import * as aiApi from '../../services/aiInventoryService';
import * as activityApi from '../../services/activityLogService';
import { getInventorySettings } from '../store/inventorySettingsStore';

export default class InventoryPipeline {
  constructor(options = {}) {
    const settings = getInventorySettings();
    this.detector = new YoloDetector(options.detector);
    this.tracker = new ByteTracker({
      maxAge: settings.trackingTimeout || 30,
      matchThresh: settings.matchIou || 0.3,
      ...(options.tracker || {}),
    });
    this.counter = new Counter();
    this.backend = 'fallback';
    this.frameIndex = 0;
    this.lastTracks = [];
    this.initError = null;
  }

  async init(products = []) {
    this.detector.setProducts(products);
    this.backend = await this.detector.init();
    this.initError = this.detector.initError;
    const settings = getInventorySettings();
    this.tracker = new ByteTracker({
      maxAge: settings.trackingTimeout || 30,
      matchThresh: settings.matchIou || 0.3,
    });
    return this.backend;
  }

  setProducts(products) {
    this.detector.setProducts(products);
  }

  reset() {
    this.tracker.reset();
    this.counter.reset();
    this.frameIndex = 0;
    this.lastTracks = [];
  }

  /**
   * Process one frame (from Frame Processor or interval capture).
   * @param {object} frameMeta { width, height, uri? }
   */
  async processFrame(frameMeta = {}) {
    this.frameIndex += 1;
    const detections = await this.detector.detect(frameMeta);
    const tracks = this.tracker.update(detections);
    this.lastTracks = tracks;
    const summary = this.counter.ingest(tracks);
    return {
      frameIndex: this.frameIndex,
      backend: this.backend,
      detections,
      tracks,
      summary,
      totalCount: this.counter.totalCount(),
    };
  }

  /**
   * Manual tap count (still unique via tracker + counter).
   */
  addManualDetection(product, x, y, confidence = 0.97) {
    const det = {
      x,
      y,
      w: 0.12,
      h: 0.12,
      confidence,
      productId: product.id,
      productName: product.name,
    };
    const tracks = this.tracker.update([det]);
    this.lastTracks = tracks;
    return {
      tracks,
      summary: this.counter.ingest(tracks),
      totalCount: this.counter.totalCount(),
    };
  }

  getSnapshot() {
    return {
      backend: this.backend,
      tracks: this.lastTracks,
      summary: this.counter.summary(),
      totalCount: this.counter.totalCount(),
      allTracks: this.tracker.getCountedTracks(),
    };
  }

  async saveToSupabase({
    evidenceUri,
    employeeId,
    employeeName,
    notes,
  }) {
    const { summary, allTracks } = this.getSnapshot();
    let evidenceUrl = null;
    if (evidenceUri) {
      evidenceUrl = await aiApi.uploadEvidence(evidenceUri);
    }

    const products = this.detector.products || [];
    const saved = [];
    for (const row of summary) {
      const product = products.find((p) => p.id === row.productId);
      const expected = Number(product?.stock) || 0;
      const count = await aiApi.saveInventoryCount({
        productId: row.productId,
        productName: row.productName,
        expectedStock: expected,
        detectedStock: row.quantity,
        adjustedStock: row.quantity,
        confidence: row.confidence,
        evidenceUrl,
        employeeId,
        employeeName,
        warehouse: product?.warehouse,
        notes,
        detections: allTracks.filter(
          (t) => t.productId === row.productId || t.productName === row.productName
        ),
      });
      saved.push(count);
    }
    activityApi.logActivity({
      userId: employeeId,
      userName: employeeName,
      action: 'inventory',
      screen: 'InventoryCamera',
      detail: `AI тооллого: ${summary.map((s) => `${s.productName}=${s.quantity}`).join(', ')}`,
    });

    return { saved, evidenceUrl, summary };
  }
}

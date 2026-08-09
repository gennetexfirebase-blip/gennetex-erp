/**
 * Simplified ByteTrack-style multi-object tracker.
 * High-score detections associate first; low-score fill unmatched tracks.
 */

function iou(a, b) {
  const ax1 = a.x - a.w / 2;
  const ay1 = a.y - a.h / 2;
  const ax2 = a.x + a.w / 2;
  const ay2 = a.y + a.h / 2;
  const bx1 = b.x - b.w / 2;
  const by1 = b.y - b.h / 2;
  const bx2 = b.x + b.w / 2;
  const by2 = b.y + b.h / 2;
  const ix1 = Math.max(ax1, bx1);
  const iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const uni = a.w * a.h + b.w * b.h - inter;
  return uni <= 0 ? 0 : inter / uni;
}

function greedyMatch(tracks, detections, iouThresh) {
  const pairs = [];
  const usedT = new Set();
  const usedD = new Set();
  const scores = [];
  tracks.forEach((t, ti) => {
    detections.forEach((d, di) => {
      scores.push({ ti, di, score: iou(t, d) });
    });
  });
  scores.sort((a, b) => b.score - a.score);
  scores.forEach(({ ti, di, score }) => {
    if (score < iouThresh || usedT.has(ti) || usedD.has(di)) return;
    usedT.add(ti);
    usedD.add(di);
    pairs.push([ti, di]);
  });
  return { pairs, usedT, usedD };
}

let nextId = 1;

export default class ByteTracker {
  constructor({
    highThresh = 0.5,
    lowThresh = 0.15,
    matchThresh = 0.3,
    maxAge = 30,
  } = {}) {
    this.highThresh = highThresh;
    this.lowThresh = lowThresh;
    this.matchThresh = matchThresh;
    this.maxAge = maxAge;
    this.tracks = [];
  }

  reset() {
    this.tracks = [];
    nextId = 1;
  }

  /**
   * @param {Array<{x,y,w,h,confidence,productId,productName}>} detections normalized 0..1
   */
  update(detections = []) {
    const high = detections.filter((d) => (d.confidence ?? 0) >= this.highThresh);
    const low = detections.filter(
      (d) => (d.confidence ?? 0) >= this.lowThresh && (d.confidence ?? 0) < this.highThresh
    );

    this.tracks.forEach((t) => {
      t.age += 1;
      t.timeSinceUpdate += 1;
    });

    const active = this.tracks.filter((t) => t.timeSinceUpdate <= this.maxAge);
    const { pairs: highPairs, usedT: usedHighT, usedD: usedHighD } = greedyMatch(
      active,
      high,
      this.matchThresh
    );

    highPairs.forEach(([ti, di]) => {
      const track = active[ti];
      const det = high[di];
      Object.assign(track, {
        x: det.x,
        y: det.y,
        w: det.w ?? track.w,
        h: det.h ?? track.h,
        confidence: det.confidence,
        productId: det.productId ?? track.productId,
        productName: det.productName ?? track.productName,
        timeSinceUpdate: 0,
        hits: track.hits + 1,
      });
    });

    const unmatchedTracks = active.filter((_, i) => !usedHighT.has(i));
    const { pairs: lowPairs } = greedyMatch(unmatchedTracks, low, this.matchThresh);
    lowPairs.forEach(([ti, di]) => {
      const track = unmatchedTracks[ti];
      const det = low[di];
      Object.assign(track, {
        x: det.x,
        y: det.y,
        w: det.w ?? track.w,
        h: det.h ?? track.h,
        confidence: det.confidence,
        productId: det.productId ?? track.productId,
        productName: det.productName ?? track.productName,
        timeSinceUpdate: 0,
        hits: track.hits + 1,
      });
    });

    high.forEach((det, di) => {
      if (usedHighD.has(di)) return;
      this.tracks.push({
        trackId: `bt_${nextId++}`,
        x: det.x,
        y: det.y,
        w: det.w ?? 0.12,
        h: det.h ?? 0.12,
        confidence: det.confidence ?? 0.9,
        productId: det.productId,
        productName: det.productName,
        age: 1,
        hits: 1,
        timeSinceUpdate: 0,
        counted: true,
      });
    });

    this.tracks = this.tracks.filter((t) => t.timeSinceUpdate <= this.maxAge);
    return this.getActiveTracks();
  }

  getActiveTracks() {
    return this.tracks
      .filter((t) => t.hits >= 1 && t.timeSinceUpdate <= 2)
      .map((t) => ({ ...t }));
  }

  getCountedTracks() {
    // Unique objects that were stably tracked at least once
    return this.tracks.filter((t) => t.hits >= 1 && t.counted !== false);
  }
}

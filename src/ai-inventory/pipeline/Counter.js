/**
 * Counter — unique objects only (by ByteTrack trackId).
 */

export default class Counter {
  constructor() {
    this.seen = new Set();
    this.items = new Map(); // productId -> { productId, productName, quantity, confidenceSum, trackIds }
  }

  reset() {
    this.seen.clear();
    this.items.clear();
  }

  /**
   * Ingest active tracks from ByteTrack. Each trackId counted once.
   */
  ingest(tracks = []) {
    tracks.forEach((t) => {
      if (!t?.trackId || this.seen.has(t.trackId)) return;
      this.seen.add(t.trackId);
      const key = t.productId || t.productName || 'unknown';
      if (!this.items.has(key)) {
        this.items.set(key, {
          productId: t.productId,
          productName: t.productName || 'Unknown',
          quantity: 0,
          confidenceSum: 0,
          trackIds: [],
        });
      }
      const row = this.items.get(key);
      row.quantity += 1;
      row.confidenceSum += t.confidence || 0;
      row.trackIds.push(t.trackId);
    });
    return this.summary();
  }

  summary() {
    return [...this.items.values()].map((r) => ({
      productId: r.productId,
      productName: r.productName,
      quantity: r.quantity,
      confidence: r.quantity ? r.confidenceSum / r.quantity : 0,
      trackIds: [...r.trackIds],
    }));
  }

  totalCount() {
    return this.seen.size;
  }
}

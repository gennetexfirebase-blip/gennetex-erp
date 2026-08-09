/** Non-Maximum Suppression for YOLO boxes (normalized cx,cy,w,h). */

function iou(a, b) {
  const ax1 = a.cx - a.w / 2;
  const ay1 = a.cy - a.h / 2;
  const ax2 = a.cx + a.w / 2;
  const ay2 = a.cy + a.h / 2;
  const bx1 = b.cx - b.w / 2;
  const by1 = b.cy - b.h / 2;
  const bx2 = b.cx + b.w / 2;
  const by2 = b.cy + b.h / 2;
  const ix1 = Math.max(ax1, bx1);
  const iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
  const uni = a.w * a.h + b.w * b.h - inter;
  return uni <= 0 ? 0 : inter / uni;
}

export function nms(boxes, iouThresh = 0.45) {
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const keep = [];
  while (sorted.length) {
    const best = sorted.shift();
    keep.push(best);
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (iou(best, sorted[i]) >= iouThresh) sorted.splice(i, 1);
    }
  }
  return keep;
}

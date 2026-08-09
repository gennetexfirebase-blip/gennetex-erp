/**
 * JPEG URI → Float32 NCHW 1x3x640x640 for YOLO (letterbox, /255).
 * Runs fully on-device (no server).
 */

import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import jpeg from 'jpeg-js';

const INPUT = 640;

export async function buildYoloTensorFromUri(uri) {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = new Uint8Array(decode(base64));
  const decoded = jpeg.decode(bytes, { useTArray: true });
  const { width, height, data } = decoded;
  return letterboxToTensor(data, width, height);
}

function letterboxToTensor(rgba, srcW, srcH) {
  const scale = Math.min(INPUT / srcW, INPUT / srcH);
  const newW = Math.round(srcW * scale);
  const newH = Math.round(srcH * scale);
  const padX = Math.floor((INPUT - newW) / 2);
  const padY = Math.floor((INPUT - newH) / 2);

  const out = new Float32Array(3 * INPUT * INPUT);
  // fill gray 114/255
  const fill = 114 / 255;
  out.fill(fill);

  for (let y = 0; y < newH; y++) {
    const srcY = Math.min(srcH - 1, Math.floor(y / scale));
    for (let x = 0; x < newW; x++) {
      const srcX = Math.min(srcW - 1, Math.floor(x / scale));
      const si = (srcY * srcW + srcX) * 4;
      const dx = x + padX;
      const dy = y + padY;
      const di = dy * INPUT + dx;
      out[di] = rgba[si] / 255;
      out[INPUT * INPUT + di] = rgba[si + 1] / 255;
      out[2 * INPUT * INPUT + di] = rgba[si + 2] / 255;
    }
  }
  return out;
}

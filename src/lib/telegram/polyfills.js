/**
 * GramJS (MTProto) ажиллуулахад шаардлагатай глобал polyfill-үүд.
 * index.js дотор БУСАД импортоос ӨМНӨ хамгийн эхэнд импортлоно.
 */
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import {
  createHash as shimCreateHash,
  pbkdf2Sync as shimPbkdf2Sync,
} from './cryptoShim';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

if (typeof global.process === 'undefined') {
  global.process = require('process');
}
if (global.process && !global.process.env) {
  global.process.env = {};
}

// crypto.getRandomValues-ийг react-native-get-random-values хангасан.
// Дутуу байгаа subtle-ийг цэвэр-JS-ээр нөхнө (SHA digest + PBKDF2).
const g = globalThis;
if (!g.crypto) g.crypto = {};

function toU8(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (data && data.buffer instanceof ArrayBuffer) {
    return new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength);
  }
  return new Uint8Array(Buffer.from(data));
}

if (!g.crypto.subtle) {
  g.crypto.subtle = {
    async digest(algorithm, data) {
      const name = (typeof algorithm === 'string' ? algorithm : algorithm.name).toUpperCase();
      const map = { 'SHA-1': 'sha1', 'SHA-256': 'sha256', 'SHA-512': 'sha512' };
      const alg = map[name];
      if (!alg) throw new Error(`Unsupported digest ${name}`);
      const out = shimCreateHash(alg).update(toU8(data)).digest();
      return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
    },
    async importKey(_format, keyData) {
      return { _raw: toU8(keyData) };
    },
    async deriveBits(params, key, bits) {
      const hashName = (typeof params.hash === 'string' ? params.hash : params.hash.name).toUpperCase();
      const map = { 'SHA-1': 'sha1', 'SHA-256': 'sha256', 'SHA-512': 'sha512' };
      const digest = map[hashName] || 'sha512';
      const out = shimPbkdf2Sync(
        key._raw,
        toU8(params.salt),
        params.iterations,
        bits / 8,
        digest,
      );
      return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
    },
  };
}

// GramJS зарим газар `self` ашигладаг.
if (typeof g.self === 'undefined') {
  g.self = g;
}

// GramJS модуль ачаалагдах үедээ window.location.protocol уншдаг (useWSS default).
// React Native дээр window байгаа ч location байхгүй тул нөхнө.
if (typeof g.window === 'undefined') {
  g.window = g;
}
if (!g.window.location) {
  g.window.location = { protocol: 'https:', href: '', host: '', hostname: '' };
}
if (!g.location) {
  g.location = g.window.location;
}
// PromisedWebSockets.connect() → window.addEventListener("offline", ...) дууддаг.
if (typeof g.window.addEventListener !== 'function') {
  g.window.addEventListener = () => {};
}
if (typeof g.window.removeEventListener !== 'function') {
  g.window.removeEventListener = () => {};
}

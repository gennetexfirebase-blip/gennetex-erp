/**
 * React Native дээр GramJS-д хэрэгтэй Node `crypto` модулийн цэвэр-JS хувилбар.
 * Metro-оор `crypto` → энэ файл руу mapping хийгдэнэ (metro.config.js).
 * Native module шаардахгүй, зөвхөн js-sha* + getRandomValues ашиглана.
 */
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import sha1 from 'js-sha1';
import { sha256 as sha256mod } from 'js-sha256';
import { sha512 as sha512mod } from 'js-sha512';

const HASHERS = {
  sha1,
  sha256: sha256mod,
  sha512: sha512mod,
};

function toBytes(data) {
  if (data == null) return new Uint8Array(0);
  if (typeof data === 'string') return new Uint8Array(Buffer.from(data, 'utf8'));
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data)) return new Uint8Array(data);
  return new Uint8Array(Buffer.from(data));
}

export function randomBytes(size) {
  const arr = new Uint8Array(size);
  globalThis.crypto.getRandomValues(arr);
  return Buffer.from(arr);
}

export function randomFillSync(buf) {
  globalThis.crypto.getRandomValues(buf);
  return buf;
}

class Hash {
  constructor(algorithm) {
    const key = String(algorithm).toLowerCase();
    const mod = HASHERS[key];
    if (!mod) throw new Error(`Unsupported hash: ${algorithm}`);
    this._hasher = mod.create();
  }
  update(data) {
    this._hasher.update(toBytes(data));
    return this;
  }
  digest(encoding) {
    const bytes = this._hasher.array();
    if (encoding === 'hex') return Buffer.from(bytes).toString('hex');
    if (encoding === 'base64') return Buffer.from(bytes).toString('base64');
    return Buffer.from(bytes);
  }
}

class Hmac {
  constructor(algorithm, key) {
    const name = String(algorithm).toLowerCase();
    const mod = HASHERS[name];
    if (!mod || !mod.hmac) throw new Error(`Unsupported hmac: ${algorithm}`);
    this._hasher = mod.hmac.create(toBytes(key));
  }
  update(data) {
    this._hasher.update(toBytes(data));
    return this;
  }
  digest(encoding) {
    const bytes = this._hasher.array();
    if (encoding === 'hex') return Buffer.from(bytes).toString('hex');
    if (encoding === 'base64') return Buffer.from(bytes).toString('base64');
    return Buffer.from(bytes);
  }
}

export function createHash(algorithm) {
  return new Hash(algorithm);
}

export function createHmac(algorithm, key) {
  return new Hmac(algorithm, key);
}

/** Стандарт PBKDF2 (HMAC суурьтай), цэвэр JS. */
export function pbkdf2Sync(password, salt, iterations, keylen, digest = 'sha512') {
  const name = String(digest).toLowerCase();
  const mod = HASHERS[name];
  if (!mod || !mod.hmac) throw new Error(`Unsupported pbkdf2 digest: ${digest}`);
  const pw = toBytes(password);
  const saltBytes = toBytes(salt);
  const hLen = mod.hmac.create(pw).array().length;
  const numBlocks = Math.ceil(keylen / hLen);
  const out = Buffer.alloc(numBlocks * hLen);

  const block = new Uint8Array(saltBytes.length + 4);
  block.set(saltBytes, 0);

  for (let i = 1; i <= numBlocks; i++) {
    block[saltBytes.length] = (i >>> 24) & 0xff;
    block[saltBytes.length + 1] = (i >>> 16) & 0xff;
    block[saltBytes.length + 2] = (i >>> 8) & 0xff;
    block[saltBytes.length + 3] = i & 0xff;

    let u = Uint8Array.from(mod.hmac.create(pw).update(block).array());
    const t = Uint8Array.from(u);
    for (let iter = 1; iter < iterations; iter++) {
      u = Uint8Array.from(mod.hmac.create(pw).update(u).array());
      for (let k = 0; k < t.length; k++) t[k] ^= u[k];
    }
    Buffer.from(t).copy(out, (i - 1) * hLen);
  }
  return out.slice(0, keylen);
}

export function pbkdf2(password, salt, iterations, keylen, digest, cb) {
  try {
    const res = pbkdf2Sync(password, salt, iterations, keylen, digest);
    setTimeout(() => cb(null, res), 0);
  } catch (e) {
    setTimeout(() => cb(e), 0);
  }
}

export default {
  randomBytes,
  randomFillSync,
  createHash,
  createHmac,
  pbkdf2Sync,
  pbkdf2,
};

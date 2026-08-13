/**
 * Уншсан кодыг задлах.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ:
 *   Сүлжээний төхөөрөмжийн (ONT, router, switch) хайрцаг дээрх QR нь
 *   ихэвчлэн НЭГ код биш, доторх бүх төхөөрөмжийн MAC/SN-ийг мөр мөрөөр
 *   агуулдаг. Жишээ нь:
 *
 *       48575443F2E92EB8
 *       48575443F2E8BBB8
 *       48575443F2EA73B8
 *       ... (10 ширхэг)
 *
 *   Өмнөх код нь уншсан утгыг БҮТНЭЭР нь нэг талбарт хийдэг байсан тул
 *   "48575443F2E92EB8\n48575443F2E8BBB8\n..." гэсэн утга нэг барааны
 *   MAC болж бүртгэгдэж, хайлт хэзээ ч тохирохгүй болно.
 */

/** Хэрэгтэй биш тэмдэгтүүдийг цэвэрлэнэ. */
function clean(s) {
  return String(s || '')
    .replace(/\u0000/g, '')
    .trim();
}

/**
 * Уншсан утгыг тусдаа кодуудад задална.
 *
 * Салгагч: мөр таслалт, таслал, цэг таслал, tab, хоосон зай (2+).
 * Нэг хоосон зайг салгагч гэж үзэхгүй — зарим сериал дотор зай байдаг.
 *
 * @returns {string[]} давхардалгүй, дарааллаа хадгалсан жагсаалт
 */
export function splitScannedCodes(raw) {
  const text = clean(raw);
  if (!text) return [];

  const parts = text
    .split(/[\r\n,;\t]+|\s{2,}/)
    .map(clean)
    .filter(Boolean);

  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/**
 * MAC хаяг мэт харагдаж байна уу.
 *
 * 12 оронтой hex (48575443F2E92EB8 нь 16 орон — Huawei-ийн SN формат) —
 * хоёуланг нь зөвшөөрнө. Цэвэр тоо биш, hex байх нь чухал.
 */
export function looksLikeMacOrSn(code) {
  const c = clean(code).replace(/[:-]/g, '');
  return /^[0-9A-Fa-f]{12,20}$/.test(c);
}

/** Харуулахад тохиромжтой богино хэлбэр. */
export function shortCode(code, keep = 6) {
  const c = clean(code);
  return c.length > keep * 2 + 3 ? `${c.slice(0, keep)}…${c.slice(-keep)}` : c;
}

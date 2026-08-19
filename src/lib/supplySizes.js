/**
 * Хангамжийн размер.
 *
 * Хангамжид хувцас, гутал ордог бөгөөд эдгээр нь размертай. Бусад
 * хангамж (цавуу, шураг, алчуур г.м.) размергүй.
 *
 * Размер бүр ТУСДАА мөр болж бүртгэгддэг — тус бүр өөрийн үлдэгдэлтэй.
 * Ажилтанд XL олгоход зөвхөн XL-ийн тоо хасагдана.
 */

export const SIZE_KINDS = [
  {
    key: 'none',
    label: 'Размергүй',
    hint: 'Цавуу, шураг, алчуур гэх мэт',
    sizes: [],
  },
  {
    key: 'clothing',
    label: 'Хувцас',
    hint: 'Хантааз, хүрэм, өмд',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'],
  },
  {
    key: 'shoes',
    label: 'Гутал',
    hint: '39-өөс 46 хүртэл',
    // 39-46 — ажлын гутлын түгээмэл хэмжээ.
    sizes: Array.from({ length: 8 }, (_, i) => String(39 + i)),
  },
];

export function sizeKind(key) {
  return SIZE_KINDS.find((k) => k.key === key) || SIZE_KINDS[0];
}

/** Размерын жагсаалтаас түүний төрлийг таана (засварлах үед хэрэгтэй). */
export function detectSizeKind(size) {
  if (!size) return 'none';
  const s = String(size).trim().toUpperCase();
  if (sizeKind('clothing').sizes.includes(s)) return 'clothing';
  if (sizeKind('shoes').sizes.includes(s)) return 'shoes';
  return 'none';
}

/**
 * Размерыг эрэмбэлэх түлхүүр.
 *
 * Цагаан толгойн дарааллаар эрэмбэлбэл `L` нь `M`-ийн өмнө, `XL` нь
 * `XS`-ийн дараа орж будлиантай харагдана. Гутал ч мөн `40` нь `9`-ийн
 * өмнө орно. Тиймээс тодорхойлсон дарааллыг ашиглана.
 */
export function sizeOrder(size) {
  if (!size) return 999;
  const s = String(size).trim().toUpperCase();
  const clothing = sizeKind('clothing').sizes.indexOf(s);
  if (clothing >= 0) return clothing;
  const num = Number(s);
  if (Number.isFinite(num)) return 100 + num;
  return 900;
}

/**
 * Нэг бүлгийн размеруудыг эрэмбэлж, нийт үлдэгдлийг тооцно.
 *
 * @param {Array} rows нэг `size_group`-т харьяалагдах мөрүүд
 */
export function summarizeGroup(rows = []) {
  const sorted = [...rows].sort((a, b) => sizeOrder(a.size) - sizeOrder(b.size));
  const total = sorted.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  return { sizes: sorted, total };
}

/**
 * Жагсаалтыг размерын бүлгээр бүлэглэнэ.
 *
 * Размергүй бараа өөрөө нэг бүлэг болно — ингэснээр дэлгэц нэг л
 * төрлийн бүтэцтэй ажиллана.
 */
export function groupBySize(items = []) {
  const groups = new Map();
  for (const it of items) {
    const key = it.size_group || `single:${it.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  return [...groups.entries()].map(([key, rows]) => {
    const { sizes, total } = summarizeGroup(rows);
    return {
      key,
      name: rows[0]?.name || '',
      image_url: rows[0]?.image_url || null,
      unit: rows[0]?.unit || 'ширхэг',
      hasSizes: rows.length > 1 || !!rows[0]?.size,
      rows: sizes,
      total,
    };
  });
}

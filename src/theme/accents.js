// Модулийн онцлох өнгө — брэндтэй зохицсон хязгаарлагдмал багц.
//
// Өмнө нь дэлгэц бүр 25 орчим санамсаргүй hex өнгө хатуу бичдэг байсан
// (#b45309, #229ED9, #db2777, #7c3aed …). Үр дүнд нь нүүр хуудас солонго
// шиг харагдаж, юу чухал болох нь ялгарахгүй байв.
//
// Оронд нь утга илэрхийлсэн 8 өнгө үлдээв. Өнгө бүр НЭГ салбарыг төлөөлнө —
// хэрэглэгч удалгүй "шар = тээвэр" гэж сурна. Бүгд ижил гэрэлтэлт/ханалттай
// тул хажуу хажуудаа байхад аль нэг нь дуугарахгүй.
//
// Хоёр горимд AA хангана: light утга нь цагаан дээр, dark утга нь #131315 дээр.

const ACCENTS = {
  // Үндсэн брэнд — агуулах, бараа, ерөнхий үйлдэл
  brand: { light: '#007cb4', dark: '#33b0e4' },
  // Харилцаа — чат, дуудлага, хурал, Telegram
  teal: { light: '#0f766e', dark: '#45c8bb' },
  // Хүний нөөц — ажилтан, ирц, хуваарь, гэрээ
  indigo: { light: '#4054b2', dark: '#8fa3f0' },
  // AI боломжууд
  violet: { light: '#6d4aa8', dark: '#b79ae8' },
  // Тээвэр — машин, бензин, парк
  amber: { light: '#b45309', dark: '#f5b544' },
  // Байршил, ажлын байр, талбай
  green: { light: '#0b7a44', dark: '#3fcf8e' },
  // Анхаарал шаардсан — бага үлдэгдэл, гомдол, ослын хяналт
  rose: { light: '#d92d20', dark: '#ff6b60' },
  // Туслах — тайлан, тохиргоо, техникийн хэсэг
  slate: { light: '#5c5c64', dark: '#9c9ca4' },
};

export const ACCENT_KEYS = Object.keys(ACCENTS);

/**
 * Онцлох өнгийг горимд тааруулж буцаана.
 * @param {string} key ACCENT_KEYS-ийн нэг
 * @param {boolean} isDark useTheme()-ээс ирнэ
 */
export function accent(key, isDark) {
  const entry = ACCENTS[key] || ACCENTS.brand;
  return isDark ? entry.dark : entry.light;
}

/** Бүх онцлох өнгийг нэг горимд бэлдэж өгнө — render дотор дахин тооцохгүй. */
export function accentMap(isDark) {
  const out = {};
  for (const k of ACCENT_KEYS) out[k] = ACCENTS[k][isDark ? 'dark' : 'light'];
  return out;
}

export default ACCENTS;

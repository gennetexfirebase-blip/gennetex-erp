/** Монгол улсын 15×30 см дугаарын формат (4 тоо + 3 үсэг). */

const CYR = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯӨҮ';

const LATIN_TO_CYR = {
  A: 'А', B: 'В', C: 'С', D: 'Д', E: 'Е', F: 'Ф', G: 'Г', H: 'Х', I: 'И', J: 'Ж',
  K: 'К', L: 'Л', M: 'М', N: 'Н', O: 'О', P: 'П', Q: 'К', R: 'Р', S: 'С', T: 'Т',
  U: 'У', V: 'В', W: 'В', X: 'Х', Y: 'Ы', Z: 'З',
};

function toCyrLetter(ch) {
  const u = String(ch || '').toUpperCase();
  if (CYR.includes(u)) return u;
  return LATIN_TO_CYR[u] || u;
}

/** Оруулалтыг 1234 УБА хэлбэрт шүүж форматлана. */
export function formatPlateInput(value) {
  const raw = String(value || '');
  let digits = '';
  let letters = '';

  for (const ch of raw.toUpperCase()) {
    if (/\d/.test(ch) && digits.length < 4 && !letters.length) {
      digits += ch;
    } else if (/[A-ZА-ЯӨҮЁ]/.test(ch) && digits.length > 0 && letters.length < 3) {
      letters += toCyrLetter(ch);
    }
  }

  if (letters) return `${digits} ${letters}`;
  return digits;
}

/** Дугаарыг задлах. */
export function parseMongoliaPlate(raw) {
  const formatted = formatPlateInput(raw);
  if (!formatted) {
    return { digits: '', letters: '', display: '', valid: false };
  }

  const [digits = '', letters = ''] = formatted.split(' ');
  const display = letters ? `${digits} ${letters}` : digits;
  const compact = `${digits}${letters}`;
  const valid = digits.length === 4 && letters.length === 3;

  return { digits, letters, display, compact, valid };
}

/** Дугаарын дэлгэцийн текст (5394УКК). */
export function plateCompactText(raw) {
  const { digits, letters, compact } = parseMongoliaPlate(raw);
  if (!digits && !letters) return '····';
  if (digits.length === 4 && !letters) return `${digits}···`;
  return compact || digits || '····';
}

/** Autobox.mn URL-д ашиглах (5394 УКК → 5394укк). */
export function plateToAutoboxQuery(raw) {
  const { digits, letters } = parseMongoliaPlate(raw);
  if (!digits) return '';
  return digits + (letters || '').toLowerCase();
}

export function autoboxPageUrl(raw) {
  const q = plateToAutoboxQuery(raw);
  return q ? `https://www.autobox.mn/Autobox?plateNo=${encodeURIComponent(q)}` : '';
}

/** Хадгалах/хайлтын нэгдсэн дугаар (1234 УБА). */
export function normalizePlateNumber(raw) {
  const { display } = parseMongoliaPlate(raw);
  return display || String(raw || '').trim();
}

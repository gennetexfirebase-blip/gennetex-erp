/**
 * Латинаар бичсэн монгол текстийг кирилл болгоно (ж: «Adiyasuren» → «Адъяасүрэн»).
 * Чат дээрх түгээмэл бичлэгийг дагана: sh→ш, ch→ч, ts→ц, kh/h→х, w/v→в, q/ö→ө, ü→ү, y→ү,
 * ya/yo/yu/ye→я/ё/ю/е, ai/oi/ui/ei→ай/ой/уй/эй, үгийн төгсгөлийн ii→ий.
 * Латин үсэггүй текст өөрчлөгдөхгүй.
 */

const MULTI: [string, string][] = [
  ['shch', 'щ'], ['sh', 'ш'], ['ch', 'ч'], ['ts', 'ц'], ['kh', 'х'],
  ['ya', 'я'], ['yo', 'ё'], ['yu', 'ю'], ['ye', 'е'],
  ['ai', 'ай'], ['oi', 'ой'], ['ui', 'уй'], ['ei', 'эй'],
];
const ONE: Record<string, string> = {
  a: 'а', b: 'б', c: 'ц', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м',
  n: 'н', o: 'о', p: 'п', q: 'ө', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'х', y: 'ү', z: 'з',
  ö: 'ө', ü: 'ү',
};

const VOWEL = /[aeiouyöü]/;

function word(w: string) {
  const lower = w.toLowerCase();
  // Эгшиг зохицох ёс: e-тэй (эм) үгэнд u → ү, o → ө (Erdene → Эрдэнэ, Adiyasuren → Адъяасүрэн).
  const front = /[eöü]/.test(lower);
  let out = '';
  for (let i = 0; i < lower.length; ) {
    // гийгүүлэгчийн дараах iya → ъя (Adiyasuren → Адъяасүрэн)
    if (i > 0 && lower.startsWith('iya', i) && !VOWEL.test(lower[i - 1])) {
      out += 'ъя';
      i += 3;
      continue;
    }
    if (lower[i] === 'e' && lower[i + 1] !== 'i' && (i === 0 || lower[i - 1] !== 'y')) {
      out += 'э';
      i++;
      continue;
    }
    if (front && (lower[i] === 'u' || lower[i] === 'o') && lower[i + 1] !== 'y' && !(i > 0 && lower[i - 1] === 'y')) {
      out += lower[i] === 'u' ? 'ү' : 'ө';
      i++;
      continue;
    }
    if (lower.slice(i) === 'ii') {
      out += 'ий';
      break;
    }
    const m = MULTI.find(([k]) => lower.startsWith(k, i));
    if (m) {
      out += m[1];
      i += m[0].length;
      continue;
    }
    out += ONE[lower[i]] ?? lower[i];
    i++;
  }
  // Том үсгийг хадгална: «BAT» → «БАТ», «Bat» → «Бат».
  if (w.length > 1 && w === w.toUpperCase()) return out.toUpperCase();
  return w[0] !== lower[0] ? out[0].toUpperCase() + out.slice(1) : out;
}

export const hasLatin = (s: string) => /[a-zöü]/i.test(s);

export function toCyrillic(s: string) {
  if (!hasLatin(s)) return s;
  return s.replace(/[A-Za-zÖÜöü]+/g, word);
}

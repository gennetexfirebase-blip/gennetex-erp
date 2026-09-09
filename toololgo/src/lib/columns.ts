import { isMissingMarker, normalizeHeader, normalizeLoose } from './normalize';

/** Excel style column letters: 0 -> A, 25 -> Z, 26 -> AA */
export function columnLetter(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

const SERIAL_EXACT = [
  'SERIAL',
  'SERIAL_NO',
  'SERIAL_NO.',
  'SERIALNO',
  'SERIAL_NUMBER',
  'SERIAL_NUM',
  'SN',
  'S/N',
  'DEVICE_SERIAL',
  'DEVICE_SERIAL_NO',
  'SERIAL_ID',
  'СЕРИАЛ',
  'СЕРИАЛ_ДУГААР',
];

const DEVC_EXACT = [
  'DEVC_NO',
  'DEVC_NO.',
  'DEVCNO',
  'DEVC',
  'DEV_NO',
  'DEV_NO.',
  'DEVICE_NO',
  'DEVICE_NO.',
  'DEVICE_NUMBER',
  'DEVICE_ID',
  'DEVICEID',
  'DEVICE_CODE',
  'ТӨХӨӨРӨМЖ',
  'ТӨХӨӨРӨМЖИЙН_ДУГААР',
];

const INVENTORY_EXACT = ['TOOLLOGO', 'TOOLOGO', 'TOOLSON', 'ТООЛЛОГО', 'ТООЛСОН'];

function scoreHeader(header: string, exact: string[], tokens: string[]): number {
  const key = normalizeHeader(header);
  if (!key) return 0;
  const idx = exact.indexOf(key);
  if (idx >= 0) return 1000 - idx;
  let score = 0;
  for (const t of tokens) {
    if (key === t) score = Math.max(score, 700);
    else if (key.startsWith(t)) score = Math.max(score, 500);
    else if (key.includes(t)) score = Math.max(score, 300);
  }
  return score;
}

export function detectSerialColumn(headers: readonly string[], exclude: number[] = []): number {
  return bestMatch(headers, SERIAL_EXACT, ['SERIAL', 'SERIEL', 'SERIA', 'S/N', 'SN'], exclude);
}

export function detectDevcColumn(headers: readonly string[], exclude: number[] = []): number {
  return bestMatch(headers, DEVC_EXACT, ['DEVC', 'DEVICE', 'DEV_NO', 'DEVICE_NO'], exclude);
}

export function detectInventoryColumn(
  headers: readonly string[],
  rows: readonly unknown[][] = [],
  exclude: number[] = [],
  referenceValues: readonly unknown[] = [],
): number {
  const named = bestMatch(headers, INVENTORY_EXACT, [], exclude);
  if (named >= 0) return named;

  for (let col = 0; col < headers.length; col++) {
    if (exclude.includes(col)) continue;
    if (rows.some((row) => isMissingMarker(row[col]))) return col;
  }

  if (!referenceValues.length || !rows.length) return -1;
  const referenceSet = new Set(referenceValues.map(normalizeLoose).filter(Boolean));
  let best = -1;
  let bestMatches = 0;
  for (let col = 0; col < headers.length; col++) {
    if (exclude.includes(col)) continue;
    let matches = 0;
    for (const row of rows) if (referenceSet.has(normalizeLoose(row[col]))) matches++;
    if (matches > bestMatches) {
      best = col;
      bestMatches = matches;
    }
  }
  return best;
}

function bestMatch(
  headers: readonly string[],
  exact: string[],
  tokens: string[],
  exclude: number[],
): number {
  let best = -1;
  let bestScore = 0;
  for (let i = 0; i < headers.length; i++) {
    if (exclude.includes(i)) continue;
    const score = scoreHeader(headers[i], exact, tokens);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/**
 * Two SERIAL-ish columns inside one sheet (MODE A):
 * e.g. "SERIAL" (ours) + "SERIAL2" / "REF SERIAL" (received).
 */
export function detectColumnPair(
  headers: readonly string[],
  kind: 'serial' | 'devc',
  rows: readonly unknown[][] = [],
  exclude: number[] = [],
): { source: number; reference: number } {
  if (kind === 'devc') {
    // МАНАЙ ТАЛ = тооллогын багана (toollogo / тоолсон), ЦААНААС ИРСЭН = DEVC_NO.
    const devc = detectDevcColumn(headers, exclude);
    const inventory = detectInventoryColumn(
      headers,
      rows,
      devc >= 0 ? [...exclude, devc] : exclude,
      devc >= 0 ? rows.map((row) => row[devc]) : [],
    );
    const detectedDevc =
      devc >= 0 ? devc : detectDevcColumn(headers, inventory >= 0 ? [...exclude, inventory] : exclude);
    if (inventory >= 0 && detectedDevc >= 0 && inventory !== detectedDevc) {
      return { source: inventory, reference: detectedDevc };
    }
  }
  const detect = kind === 'serial' ? detectSerialColumn : detectDevcColumn;
  const source = detect(headers, exclude);
  if (source < 0) return { source: -1, reference: -1 };
  const reference = detect(headers, [...exclude, source]);
  if (reference < 0) return { source: -1, reference: -1 };
  return { source, reference };
}

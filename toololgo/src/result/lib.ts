/** RESULT sheet-ийн нэг мөр — багана бүр нэрээрээ хадгалагдана. */
export type Row = Record<string, string>;

export const STATUS_COL = 'DEVC ЦААНААС';

/** Whitespace / жижиг-том үсгийг тэгшитгэх. */
export const normalize = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

export const PRESENT = 'БАЙНА';
export const MISSING = 'БАЙХГҮЙ';

/** "БАЙНА (3)" гэх мэт тоо агуулсан утгыг ч зөв таних. */
export function statusOf(row: Row): string {
  const v = normalize(row[STATUS_COL]);
  if (v.startsWith(MISSING)) return MISSING;
  if (v.startsWith(PRESENT)) return PRESENT;
  return v;
}

/** Хүснэгтэд эхэлж харагдах баганууд. */
export const PRIORITY_COLUMNS = [
  'DEVC_NO',
  'toollogo',
  'STAFF_ID',
  'INV_STATE',
  'MANUFACTURER_NAME',
  'CLASSIFICATION_NAME',
  'MODEL_NAME',
  'MODEL_SKU',
  'DEVC ТООЛЛОГО',
  'DEVC ДАВТАЛТ (цаанаас)',
  'DEVC ДАВТАЛТ (манай)',
  'DEVC REF МӨР',
  'DEVC ЦААНААС',
];

/** Нэмэлт filter (dropdown) тавигдах баганууд. */
export const FILTER_COLUMNS = [
  'DEVC_NO',
  'STAFF_ID',
  'INV_STATE',
  'MANUFACTURER_NAME',
  'CLASSIFICATION_NAME',
  'MODEL_NAME',
  'MODEL_SKU',
  'DEVC ТООЛЛОГО',
  'DEVC ЦААНААС',
];

/** Багануудыг: эхэлж PRIORITY, дараа нь файлд байсан бусад бүх багана. */
export function orderColumns(all: string[]): string[] {
  const priority = PRIORITY_COLUMNS.filter((c) => all.includes(c));
  const rest = all.filter((c) => !priority.includes(c));
  return [...priority, ...rest];
}

export const MAX_FILTER_OPTIONS = 500;

/** Нэг баганын давхардалгүй утгууд (dropdown-д). */
export function uniqueValues(rows: Row[], column: string): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const v = String(row[column] ?? '').trim();
    if (v) seen.add(v);
    if (seen.size > MAX_FILTER_OPTIONS) break;
  }
  return [...seen].sort((a, b) => a.localeCompare(b, 'mn'));
}

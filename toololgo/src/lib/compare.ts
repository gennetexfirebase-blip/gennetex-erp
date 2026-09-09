import type { ColumnResult, DuplicateEntry, NormalizeOptions } from '../types';
import { DEFAULT_NORMALIZE, STATUS_EMPTY, STATUS_FOUND, STATUS_MISSING } from '../types';
import { isMissingMarker, normalizeValue } from './normalize';

/** Hard cap on stored reference row indices per source row (used for navigation). */
export const MAX_STORED_MATCHES = 200;
const MAX_TOP_DUPLICATES = 300;

export type CompareProgress = (phase: string, pct: number) => void;

/**
 * Build a `value -> reference row indices` index in O(n).
 * Empty values are skipped so "" can never match "".
 */
export function buildReferenceIndex(
  reference: readonly unknown[],
  opt: NormalizeOptions,
  onProgress?: CompareProgress,
): { index: Map<string, number[]>; emptyCount: number } {
  const index = new Map<string, number[]>();
  let emptyCount = 0;
  const n = reference.length;
  const step = Math.max(1, Math.floor(n / 20));

  for (let i = 0; i < n; i++) {
    if (isMissingMarker(reference[i])) {
      emptyCount++;
      continue;
    }
    const v = normalizeValue(reference[i], opt);
    if (v === '') {
      emptyCount++;
    } else {
      const bucket = index.get(v);
      if (bucket === undefined) index.set(v, [i]);
      else if (bucket.length < MAX_STORED_MATCHES) bucket.push(i);
      else bucket.push(-1); // keeps the true count without unbounded memory
    }
    if (onProgress && i % step === 0) onProgress('index', i / n);
  }
  return { index, emptyCount };
}

/** `value -> occurrence count` inside a single column. O(n). */
export function buildOccurrenceMap(
  values: readonly unknown[],
  opt: NormalizeOptions,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i < values.length; i++) {
    const v = normalizeValue(values[i], opt);
    if (v === '') continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
}

function summariseDuplicates(counts: Map<string, number>): {
  unique: number;
  duplicateValues: number;
  top: DuplicateEntry[];
} {
  let duplicateValues = 0;
  const top: DuplicateEntry[] = [];
  for (const [value, count] of counts) {
    if (count > 1) {
      duplicateValues++;
      top.push({ value, count });
    }
  }
  top.sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : 1));
  return { unique: counts.size, duplicateValues, top: top.slice(0, MAX_TOP_DUPLICATES) };
}

/**
 * THE CORE RULE
 * -------------
 * Every SOURCE value is searched against the ENTIRE REFERENCE column,
 * never against the value that happens to sit on the same row.
 *
 * Complexity: O(sourceLen + referenceLen) — Set/Map lookups only, no nested loops.
 */
export function compareColumn(
  source: readonly unknown[],
  reference: readonly unknown[],
  opt: NormalizeOptions,
  onProgress?: CompareProgress,
): ColumnResult {
  const n = source.length;
  const { index: refIndex, emptyCount: referenceEmpty } = buildReferenceIndex(
    reference,
    opt,
    onProgress,
  );

  const srcCounts = buildOccurrenceMap(source, opt);
  onProgress?.('source-index', 1);

  const status = new Uint8Array(n);
  const refOccurrences = new Uint32Array(n);
  const srcOccurrences = new Uint32Array(n);
  const matchOffsets = new Int32Array(n + 1);

  // Pass 1 — statuses, counts and CSR sizes.
  let found = 0;
  let missing = 0;
  let empty = 0;
  let totalStored = 0;
  const normalized = new Array<string>(n);
  const step = Math.max(1, Math.floor(n / 20));

  for (let i = 0; i < n; i++) {
    if (isMissingMarker(source[i])) {
      status[i] = STATUS_MISSING;
      missing++;
      matchOffsets[i + 1] = totalStored;
      continue;
    }
    const v = normalizeValue(source[i], opt);
    normalized[i] = v;
    if (v === '') {
      // Хоосон нүд = тухайн зүйл манай талд бүртгэгдээгүй → ТООЛСОН гэж тооцно.
      status[i] = STATUS_MISSING;
      empty++;
      missing++;
      matchOffsets[i + 1] = totalStored;
      continue;
    }
    srcOccurrences[i] = srcCounts.get(v) ?? 1;
    const bucket = refIndex.get(v);
    if (bucket === undefined) {
      status[i] = STATUS_MISSING;
      missing++;
    } else {
      status[i] = STATUS_FOUND;
      found++;
      refOccurrences[i] = bucket.length;
      totalStored += Math.min(bucket.length, MAX_STORED_MATCHES);
    }
    matchOffsets[i + 1] = totalStored;
    if (onProgress && i % step === 0) onProgress('compare', i / n);
  }

  // Pass 2 — fill the flat match list (CSR layout).
  const matchRows = new Int32Array(totalStored);
  for (let i = 0; i < n; i++) {
    if (status[i] !== STATUS_FOUND) continue;
    const bucket = refIndex.get(normalized[i]);
    if (!bucket) continue;
    let w = matchOffsets[i];
    const limit = Math.min(bucket.length, MAX_STORED_MATCHES);
    for (let k = 0; k < limit; k++) {
      const row = bucket[k];
      if (row < 0) break;
      matchRows[w++] = row;
    }
  }
  onProgress?.('compare', 1);

  const srcStats = summariseDuplicates(srcCounts);
  const refCounts = new Map<string, number>();
  for (const [value, rows] of refIndex) refCounts.set(value, rows.length);
  const refStats = summariseDuplicates(refCounts);

  let sourceDuplicateRows = 0;
  for (let i = 0; i < n; i++) if (srcOccurrences[i] > 1) sourceDuplicateRows++;

  return {
    status,
    refOccurrences,
    srcOccurrences,
    matchOffsets,
    matchRows,
    found,
    missing,
    empty,
    sourceUniqueValues: srcStats.unique,
    sourceDuplicateValues: srcStats.duplicateValues,
    sourceDuplicateRows,
    referenceUniqueValues: refStats.unique,
    referenceDuplicateValues: refStats.duplicateValues,
    referenceEmpty,
    topSourceDuplicates: srcStats.top,
    topReferenceDuplicates: refStats.top,
  };
}

/** Builds a result for explicit count-only markers when no reference column exists. */
export function compareMissingMarkers(source: readonly unknown[]): ColumnResult {
  const n = source.length;
  const status = new Uint8Array(n);
  const refOccurrences = new Uint32Array(n);
  const srcOccurrences = new Uint32Array(n);
  const matchOffsets = new Int32Array(n + 1);
  let missing = 0;
  let empty = 0;

  for (let i = 0; i < n; i++) {
    status[i] = STATUS_MISSING;
    missing++;
    if (!isMissingMarker(source[i]) && normalizeValue(source[i], DEFAULT_NORMALIZE) === '') empty++;
  }

  return {
    status,
    refOccurrences,
    srcOccurrences,
    matchOffsets,
    matchRows: new Int32Array(0),
    found: 0,
    missing,
    empty,
    sourceUniqueValues: 0,
    sourceDuplicateValues: 0,
    sourceDuplicateRows: 0,
    referenceUniqueValues: 0,
    referenceDuplicateValues: 0,
    referenceEmpty: 0,
    topSourceDuplicates: [],
    topReferenceDuplicates: [],
  };
}

/** Reference row indices stored for a given source row. */
export function matchesForRow(result: ColumnResult, row: number): Int32Array {
  return result.matchRows.subarray(result.matchOffsets[row], result.matchOffsets[row + 1]);
}

export function statusLabel(code: number, refOccurrences: number): string {
  if (code === STATUS_EMPTY) return '—';
  if (code === STATUS_MISSING) return 'БАЙХГҮЙ';
  return refOccurrences > 1 ? `БАЙНА (${refOccurrences})` : 'БАЙНА';
}

export { STATUS_EMPTY, STATUS_FOUND, STATUS_MISSING };

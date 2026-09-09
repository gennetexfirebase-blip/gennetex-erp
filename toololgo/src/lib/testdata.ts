import type { CellValue } from '../types';
import type { ParsedSheet } from '../workers/excel.worker';

/**
 * Development / performance test data only.
 * Never used as normal application data — it is generated on demand from the
 * empty state so the 100,000 row path can be exercised without a real file.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MODELS = ['GX-200', 'GX-350', 'RT-100', 'RT-900', 'ZN-45'];
const BRANCHES = ['УБ төв', 'Дархан', 'Эрдэнэт', 'Чойбалсан', 'Ховд'];

export interface TestDataOptions {
  rows: number;
  /** share of source rows that also exist in the reference (0..1) */
  matchRate: number;
  duplicateRate: number;
  emptyRate: number;
}

export const DEFAULT_TEST_OPTIONS: TestDataOptions = {
  rows: 100_000,
  matchRate: 0.9,
  duplicateRate: 0.015,
  emptyRate: 0.005,
};

const serialOf = (i: number) => `SN-${String(i).padStart(7, '0')}`;
const devcOf = (i: number) => `DEV${String(i).padStart(6, '0')}`;

/** Two sheets: SOURCE (манай тал) and REFERENCE (цаанаас ирсэн). */
export function generateTestSheets(opts: TestDataOptions = DEFAULT_TEST_OPTIONS): ParsedSheet[] {
  const rnd = mulberry32(20260903);
  const n = opts.rows;

  const sourceHeader: CellValue[] = ['SERIAL', 'DEVC_NO', 'MODEL', 'BRANCH', 'DATE'];
  const refHeader: CellValue[] = ['SERIAL', 'DEVC_NO', 'STATUS'];

  const source: CellValue[][] = [sourceHeader];
  const reference: CellValue[][] = [refHeader];

  const matchable: number[] = [];

  for (let i = 0; i < n; i++) {
    const r = rnd();
    let serial: CellValue = serialOf(i);
    let devc: CellValue = devcOf(i);

    if (r < opts.emptyRate) {
      serial = i % 2 === 0 ? '' : null;
    } else if (r < opts.emptyRate + opts.duplicateRate && i > 10) {
      // duplicate an earlier serial inside the source column itself
      const dupIdx = Math.floor(rnd() * i);
      serial = serialOf(dupIdx);
      devc = devcOf(dupIdx);
    }

    source.push([
      serial,
      devc,
      MODELS[i % MODELS.length],
      BRANCHES[i % BRANCHES.length],
      `2026-0${(i % 9) + 1}-1${i % 9}`,
    ]);

    if (rnd() < opts.matchRate) matchable.push(i);
  }

  // Reference rows are written in a deliberately different order so the
  // "row position must not matter" rule is actually exercised.
  for (let k = matchable.length - 1; k >= 0; k--) {
    const j = Math.floor(rnd() * (k + 1));
    const t = matchable[k];
    matchable[k] = matchable[j];
    matchable[j] = t;
  }

  for (const i of matchable) {
    const messy = rnd() < 0.03;
    reference.push([
      messy ? `  ${serialOf(i).toLowerCase()} ` : serialOf(i),
      devcOf(i),
      'OK',
    ]);
    if (rnd() < opts.duplicateRate) {
      reference.push([serialOf(i), devcOf(i), 'OK']); // duplicate in reference
    }
  }

  // Reference-only devices (not in our list at all).
  const extra = Math.floor(n * 0.02);
  for (let i = 0; i < extra; i++) {
    reference.push([serialOf(n + i), devcOf(n + i), 'OK']);
  }

  return [
    { name: 'SOURCE', matrix: source, maxCols: sourceHeader.length },
    { name: 'REFERENCE', matrix: reference, maxCols: refHeader.length },
  ];
}

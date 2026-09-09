import { compareColumn, compareMissingMarkers, statusLabel } from './compare';
import { DEFAULT_NORMALIZE, STATUS_FOUND, STATUS_MISSING } from '../types';
import { generateTestSheets } from './testdata';
import { findMatches } from './grid';

export interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

function labels(source: unknown[], reference: unknown[]): string[] {
  const r = compareColumn(source, reference, DEFAULT_NORMALIZE);
  return source.map((_, i) => statusLabel(r.status[i], r.refOccurrences[i]));
}

/** Acceptance tests from the specification (section 57). */
export function runSelfTests(): TestResult[] {
  const tests: TestResult[] = [];
  const check = (name: string, actual: unknown, expected: unknown) => {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    tests.push({ name, passed: a === e, detail: a === e ? a : `${a}  ≠  ${e}` });
  };

  // Test 1 — same order
  check('1. Ижил дараалал', labels(['A', 'B', 'C'], ['A', 'B', 'C']), ['БАЙНА', 'БАЙНА', 'БАЙНА']);

  // Test 2 — different order (the core rule)
  check('2. Өөр дараалал', labels(['A', 'B', 'C'], ['C', 'A', 'B']), ['БАЙНА', 'БАЙНА', 'БАЙНА']);

  // Test 3 — missing value
  check('3. БАЙХГҮЙ утга', labels(['A', 'B', 'C', 'D'], ['C', 'A', 'B']), [
    'БАЙНА',
    'БАЙНА',
    'БАЙНА',
    'БАЙХГҮЙ',
  ]);

  // Explicit unavailable markers are always count-only, regardless of reference contents.
  {
    const r = compareColumn(['A', 'байхгүй', 'БАЙХГҮЙ', 'toolson', 'B'], ['A', 'байхгүй', 'B'], DEFAULT_NORMALIZE);
    check(
      '3a. БАЙХГҮЙ тэмдэглэгээ',
      [r.found, r.missing, r.empty, labels(['байхгүй', 'БАЙХГҮЙ', 'toolson'], ['байхгүй'])],
      [2, 3, 0, ['БАЙХГҮЙ', 'БАЙХГҮЙ', 'БАЙХГҮЙ']],
    );
  }

  // Test 4 — duplicate in reference
  check('4. Давхардал', labels(['A'], ['A', 'A', 'B', 'C']), ['БАЙНА (2)']);

  // Normalisation: case + surrounding spaces + preserved separators
  check('5. Нормалчлал', labels([' abc-001 ', 'abc_002'], ['ABC-001', 'ABC_002']), [
    'БАЙНА',
    'БАЙНА',
  ]);

  // Empty values must never be reported as found; they count as ТООЛСОН.
  {
    const r = compareColumn(['', null, '   ', 'A'], ['', 'A'], DEFAULT_NORMALIZE);
    check(
      '6. Хоосон утга = Тоолсон',
      [r.status[0], r.status[1], r.status[2], r.status[3], r.empty, r.missing],
      [STATUS_MISSING, STATUS_MISSING, STATUS_MISSING, STATUS_FOUND, 3, 3],
    );
  }

  // Row position independence on a large shuffled set
  {
    const n = 5000;
    const source = Array.from({ length: n }, (_, i) => `S${i}`);
    const reference = [...source].reverse();
    reference.splice(0, 10); // remove 10 -> 10 missing
    const r = compareColumn(source, reference, DEFAULT_NORMALIZE);
    check('7. 5,000 мөр холилдсон', [r.found, r.missing], [n - 10, 10]);
  }

  // DEVC_NO behaves identically
  check('8. DEVC_NO', labels(['DEV001', 'DEV002', 'DEV003'], ['DEV003', 'DEV001']), [
    'БАЙНА',
    'БАЙХГҮЙ',
    'БАЙНА',
  ]);

  // Source-side duplicate detection
  {
    const r = compareColumn(['A', 'A', 'B'], ['A', 'B'], DEFAULT_NORMALIZE);
    check(
      '9. Source давхардал',
      [r.srcOccurrences[0], r.srcOccurrences[1], r.sourceDuplicateValues, r.sourceDuplicateRows],
      [2, 2, 1, 2],
    );
  }

  // Missing status code sanity
  check('10. Статус код', compareColumn(['X'], ['Y'], DEFAULT_NORMALIZE).status[0], STATUS_MISSING);

  {
    const r = compareMissingMarkers(['A', 'БАЙХГҮЙ', 'байхгүй', 'B']);
    check('10a. Багана сонголтгүй Тоолсон', [r.found, r.missing, r.empty], [0, 4, 0]);
  }

  {
    const dataset = {
      id: 'search', fileId: 'search', fileName: 'search', sheetName: 'Sheet1',
      headers: ['VALUE'], rows: [['AA'], ['BB'], ['CC']], rowCount: 3,
    };
    const rows = new Int32Array([0, 1, 2]);
    const columns = [{ id: 'd0', label: 'VALUE', kind: 'data' as const, dataIndex: 0, width: 100 }];
    check('10b. Олон Find утга', findMatches('AA,CC', rows, columns, dataset, undefined, null).length, 2);
  }

  return tests;
}

/** Section 46 — 100,000 row performance probe. */
export function runPerformanceTest(rows = 100_000): TestResult {
  const t0 = performance.now();
  const [src, ref] = generateTestSheets({
    rows,
    matchRate: 0.9,
    duplicateRate: 0.015,
    emptyRate: 0.005,
  });
  const genMs = performance.now() - t0;

  const sourceSerial = src.matrix.slice(1).map((r) => r[0]);
  const refSerial = ref.matrix.slice(1).map((r) => r[0]);

  const t1 = performance.now();
  const result = compareColumn(sourceSerial, refSerial, DEFAULT_NORMALIZE);
  const cmpMs = performance.now() - t1;

  return {
    name: `${rows.toLocaleString()} мөр`,
    passed: result.found + result.missing === sourceSerial.length,
    detail: `үүсгэх ${genMs.toFixed(0)}ms · харьцуулах ${cmpMs.toFixed(0)}ms · БАЙНА ${result.found.toLocaleString()} · Тоолсон ${result.missing.toLocaleString()}`,
  };
}

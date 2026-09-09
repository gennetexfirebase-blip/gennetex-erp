import type { CellValue, Dataset } from '../types';
import type { ParsedSheet } from '../workers/excel.worker';
import { columnLetter } from './columns';

export interface ParseProgress {
  (phase: string, pct: number, detail?: string): void;
}

export const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

export function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/** Parses a workbook off the main thread. Nothing ever leaves the browser. */
export function parseWorkbook(file: File, onProgress?: ParseProgress): Promise<ParsedSheet[]> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('../workers/excel.worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      reject(new Error('Боловсруулагч ажиллуулж чадсангүй.'));
      return;
    }

    const cleanup = () => worker.terminate();

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        onProgress?.(msg.phase, msg.pct, msg.detail);
      } else if (msg.type === 'parsed') {
        cleanup();
        resolve(msg.sheets as ParsedSheet[]);
      } else if (msg.type === 'error') {
        cleanup();
        reject(new Error(msg.message));
      }
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error('Excel файл уншиж чадсангүй.'));
    };

    file
      .arrayBuffer()
      .then((buffer) => {
        onProgress?.('upload', 0.02, 'Файл ачааллаж байна...');
        worker.postMessage({ type: 'parse', buffer, fileName: file.name }, [buffer]);
      })
      .catch(() => {
        cleanup();
        reject(new Error('Файлыг нээж чадсангүй.'));
      });
  });
}

/** Turns a raw matrix into headers + data rows without touching the values. */
export function buildDataset(
  sheet: ParsedSheet,
  opts: { fileId: string; fileName: string; hasHeaderRow: boolean },
): Dataset {
  const { matrix, maxCols } = sheet;
  const cols = Math.max(maxCols, 1);
  let headers: string[];
  let rows: CellValue[][];

  if (opts.hasHeaderRow && matrix.length > 0) {
    const headerRow = matrix[0];
    headers = new Array(cols);
    for (let c = 0; c < cols; c++) {
      const raw = headerRow[c];
      const text = raw === null || raw === undefined ? '' : String(raw).trim();
      headers[c] = text || columnLetter(c);
    }
    rows = matrix.slice(1);
  } else {
    headers = new Array(cols);
    for (let c = 0; c < cols; c++) headers[c] = columnLetter(c);
    rows = matrix;
  }

  // Pad short rows once so cell access never needs a bounds check later.
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < cols) {
      for (let c = r.length; c < cols; c++) r[c] = null;
    }
  }

  return {
    id: `${opts.fileId}::${sheet.name}`,
    fileId: opts.fileId,
    fileName: opts.fileName,
    sheetName: sheet.name,
    headers,
    rows,
    rowCount: rows.length,
  };
}

/** Column values of a dataset, with any in-grid edits applied. */
export function columnValues(
  dataset: Dataset,
  colIndex: number,
  overrides?: Map<string, CellValue>,
): CellValue[] {
  const out = new Array<CellValue>(dataset.rowCount);
  const rows = dataset.rows;
  if (!overrides || overrides.size === 0) {
    for (let i = 0; i < rows.length; i++) out[i] = rows[i][colIndex] ?? null;
    return out;
  }
  for (let i = 0; i < rows.length; i++) {
    const key = `${i}:${colIndex}`;
    const edited = overrides.get(key);
    out[i] = edited !== undefined ? edited : (rows[i][colIndex] ?? null);
  }
  return out;
}

/// <reference lib="webworker" />
import * as XLSX from 'xlsx';
import type { CellValue } from '../types';

export interface ParsedSheet {
  name: string;
  matrix: CellValue[][];
  maxCols: number;
}

type Incoming = { type: 'parse'; buffer: ArrayBuffer; fileName: string };

type Outgoing =
  | { type: 'progress'; phase: string; pct: number; detail?: string }
  | { type: 'parsed'; sheets: ParsedSheet[] }
  | { type: 'error'; message: string };

const post = (msg: Outgoing) => (self as unknown as Worker).postMessage(msg);

self.onmessage = (event: MessageEvent<Incoming>) => {
  const data = event.data;
  if (data.type !== 'parse') return;

  try {
    post({ type: 'progress', phase: 'read', pct: 0.05, detail: 'Excel уншиж байна...' });

    const wb = XLSX.read(new Uint8Array(data.buffer), {
      type: 'array',
      dense: true,
      cellDates: true,
      cellStyles: false,
      sheetStubs: false,
    });

    if (!wb.SheetNames.length) {
      post({ type: 'error', message: 'Файл хоосон байна.' });
      return;
    }

    const sheets: ParsedSheet[] = [];
    const total = wb.SheetNames.length;

    wb.SheetNames.forEach((name, i) => {
      post({
        type: 'progress',
        phase: 'sheet',
        pct: 0.1 + (0.85 * i) / total,
        detail: `"${name}" хуудсыг боловсруулж байна...`,
      });

      const ws = wb.Sheets[name];
      if (!ws) {
        sheets.push({ name, matrix: [], maxCols: 0 });
        return;
      }

      const rows = XLSX.utils.sheet_to_json<CellValue[]>(ws, {
        header: 1,
        raw: true,
        defval: null,
        blankrows: false,
      });

      let maxCols = 0;
      const matrix: CellValue[][] = [];
      for (const row of rows) {
        const r = Array.isArray(row) ? row : [];
        // Drop rows that are entirely empty.
        let hasValue = false;
        for (let c = 0; c < r.length; c++) {
          const v = r[c];
          if (v !== null && v !== undefined && String(v).trim() !== '') {
            hasValue = true;
            break;
          }
        }
        if (!hasValue) continue;
        if (r.length > maxCols) maxCols = r.length;
        matrix.push(normaliseRow(r));
      }

      sheets.push({ name, matrix, maxCols });
      // Free the parsed sheet as we go, large workbooks otherwise double up.
      delete wb.Sheets[name];
    });

    post({ type: 'progress', phase: 'done', pct: 1 });
    post({ type: 'parsed', sheets });
  } catch (err) {
    post({
      type: 'error',
      message:
        err instanceof Error && /password|encrypt/i.test(err.message)
          ? 'Нууц үгтэй файл дэмжигдэхгүй.'
          : 'Excel файл уншиж чадсангүй. Файл гэмтсэн эсвэл дэмжигдээгүй хэлбэртэй байна.',
    });
  }
};

function normaliseRow(row: unknown[]): CellValue[] {
  const out: CellValue[] = new Array(row.length);
  for (let i = 0; i < row.length; i++) {
    const v = row[i];
    if (v === null || v === undefined) out[i] = null;
    else if (v instanceof Date) out[i] = formatDate(v);
    else if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') out[i] = v;
    else out[i] = String(v);
  }
  return out;
}

function formatDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const time = d.getHours() || d.getMinutes() || d.getSeconds();
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return time ? `${date} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` : date;
}

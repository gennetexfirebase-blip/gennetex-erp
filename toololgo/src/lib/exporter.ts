import type {
  CellValue,
  ColumnResult,
  ComparisonConfig,
  ComparisonResults,
  Dataset,
} from '../types';
import { STATUS_EMPTY, STATUS_FOUND } from '../types';
import { statusLabel } from './compare';
import { cellRaw, refRowText } from './grid';
import { columnLetter } from './columns';

export interface ExportOptions {
  source: Dataset;
  reference: Dataset;
  config: ComparisonConfig;
  results: ComparisonResults;
  visibleRows: Int32Array;
  overrides?: Map<string, CellValue>;
  /** Apply green / red / yellow fills. Slower on very large sheets. */
  styled: boolean;
  /**
   * 'compact' — зөвхөн тооллого/цаанаас багана + статусууд.
   * 'full'    — эх файлын бүх багана.
   * Аль ч тохиолдолд дэлгэц дээр ШҮҮГДСЭН мөрүүд л татагдана.
   * compact үед БАЙНА статустай мөрүүд бүрэн хасагдана.
   */
  mode?: 'compact' | 'full';
  fileName?: string;
  onProgress?: (pct: number, label: string) => void;
}

const FILL = {
  found: 'E6F4EA',
  missing: 'FCE8E6',
  dup: 'FEF7E0',
  header: 'F1F3F4',
  title: 'E8F0FE',
};
const FONT = {
  found: '0D652D',
  missing: 'C5221F',
  dup: 'A05A00',
};

type AnyCell = { v?: unknown; t?: string; s?: unknown };

const solid = (rgb: string) => ({ patternType: 'solid', fgColor: { rgb } });

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

/** @returns экспортлогдсон мөрийн тоо */
export async function exportComparison(opts: ExportOptions): Promise<number> {
  const { source, reference, config, results, overrides, styled } = opts;
  let visibleRows = opts.visibleRows;
  const progress = opts.onProgress ?? (() => undefined);

  progress(0.02, 'Excel сан ачааллаж байна...');
  const XLSX = await import('xlsx-js-style');

  const serial = results.serial;
  const devc = results.devc;
  const hasSerial = !!serial && config.sourceSerialCol >= 0;
  const hasDevc = !!devc && config.sourceDevcCol >= 0;
  const sameSheet = config.sourceDatasetId === config.referenceDatasetId;
  const serialRef = sameSheet ? results.serialRef : null;
  const devcRef = sameSheet ? results.devcRef : null;

  // ---- багануудын бүтэц --------------------------------------------------
  const compact = (opts.mode ?? 'full') === 'compact';

  /** Нэг баганын гаралт: гарчиг + мөр бүрийн утга. */
  type ColSpec = {
    header: string;
    value: (r: number) => string | number | boolean | null;
    result?: ColumnResult;
  };

  const specs: ColSpec[] = [];
  const dataSpec = (dataset: Dataset, col: number, ov?: Map<string, CellValue>): ColSpec => ({
    header: dataset.headers[col] ?? columnLetter(col),
    value: (r) => cellRaw(dataset, ov, r, col),
  });
  const statusSpec = (header: string, result: ColumnResult): ColSpec => ({
    header,
    value: (r) => statusLabel(result.status[r], result.refOccurrences[r]),
    result,
  });

  if (compact) {
    // toollogo | ТООЛЛОГО | DEVC_NO | ЦААНААС | ЦААНААС МӨР
    if (hasDevc && devc) {
      specs.push(dataSpec(source, config.sourceDevcCol, overrides));
      specs.push(statusSpec('ТООЛЛОГО', devc));
      if (sameSheet && config.refDevcCol >= 0) {
        specs.push(dataSpec(source, config.refDevcCol, overrides));
      }
      if (devcRef) specs.push(statusSpec('ЦААНААС', devcRef));
      specs.push({ header: 'ЦААНААС МӨР', value: (r) => refRowText(devc, r) });
    }
    if (hasSerial && serial) {
      specs.push(dataSpec(source, config.sourceSerialCol, overrides));
      specs.push(statusSpec('SERIAL ТООЛЛОГО', serial));
      if (sameSheet && config.refSerialCol >= 0) {
        specs.push(dataSpec(source, config.refSerialCol, overrides));
      }
      if (serialRef) specs.push(statusSpec('SERIAL ЦААНААС', serialRef));
      specs.push({ header: 'SERIAL ЦААНААС МӨР', value: (r) => refRowText(serial, r) });
    }
  } else {
    for (let c = 0; c < source.headers.length; c++) specs.push(dataSpec(source, c, overrides));
    if (hasSerial && serial) {
      specs.push(statusSpec('SERIAL ТООЛЛОГО', serial));
      specs.push({ header: 'SERIAL ДАВТАЛТ (цаанаас)', value: (r) => serial.refOccurrences[r] });
      specs.push({ header: 'SERIAL ДАВТАЛТ (манай)', value: (r) => serial.srcOccurrences[r] });
      specs.push({ header: 'SERIAL REF МӨР', value: (r) => refRowText(serial, r) });
      if (serialRef) specs.push(statusSpec('SERIAL ЦААНААС', serialRef));
    }
    if (hasDevc && devc) {
      specs.push(statusSpec('DEVC ТООЛЛОГО', devc));
      specs.push({ header: 'DEVC ДАВТАЛТ (цаанаас)', value: (r) => devc.refOccurrences[r] });
      specs.push({ header: 'DEVC ДАВТАЛТ (манай)', value: (r) => devc.srcOccurrences[r] });
      specs.push({ header: 'DEVC REF МӨР', value: (r) => refRowText(devc, r) });
      if (devcRef) specs.push(statusSpec('DEVC ЦААНААС', devcRef));
    }
  }

  // compact — БАЙНА мөрүүд ХЭЗЭЭ Ч татагдахгүй. Зөвхөн БАЙХГҮЙ мөрүүд.
  if (compact) {
    const primary = devcRef ?? serialRef ?? devc ?? serial;
    if (primary) {
      const kept = new Int32Array(visibleRows.length);
      let n = 0;
      for (let i = 0; i < visibleRows.length; i++) {
        const r = visibleRows[i];
        if (r < primary.status.length && primary.status[r] !== STATUS_FOUND) kept[n++] = r;
      }
      visibleRows = kept.subarray(0, n);
    }
  }

  const header: string[] = specs.map((sp) => sp.header);
  const statusCols: { index: number; result: ColumnResult }[] = [];
  specs.forEach((sp, i) => {
    if (sp.result) statusCols.push({ index: i, result: sp.result });
  });

  // ---- rows --------------------------------------------------------------
  progress(0.06, 'Мөрүүдийг бэлдэж байна...');
  const aoa: (string | number | boolean | null)[][] = [header];

  for (let i = 0; i < visibleRows.length; i++) {
    const r = visibleRows[i];
    const row: (string | number | boolean | null)[] = new Array(specs.length);
    for (let c = 0; c < specs.length; c++) row[c] = specs[c].value(r);
    aoa.push(row);

    if (i % 20000 === 0) {
      progress(0.06 + 0.4 * (i / Math.max(1, visibleRows.length)), 'Мөрүүдийг бэлдэж байна...');
      await yieldToUi();
    }
  }

  progress(0.5, 'RESULT хуудсыг үүсгэж байна...');
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  (ws as Record<string, unknown>)['!cols'] = header.map((h) => ({
    wch: Math.min(28, Math.max(11, h.length + 3)),
  }));
  (ws as Record<string, unknown>)['!freeze'] = { xSplit: 0, ySplit: 1 };
  (ws as Record<string, unknown>)['!autofilter'] = {
    ref: `A1:${columnLetter(header.length - 1)}${aoa.length}`,
  };

  // header style
  for (let c = 0; c < header.length; c++) {
    const cell = (ws as Record<string, AnyCell>)[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) {
      cell.s = {
        font: { bold: true, sz: 11 },
        fill: solid(FILL.header),
        alignment: { vertical: 'center' },
        border: thinBorder(),
      };
    }
  }

  if (styled) {
    progress(0.6, 'Өнгө оруулж байна...');
    for (let i = 0; i < visibleRows.length; i++) {
      const r = visibleRows[i];
      for (const { index, result } of statusCols) {
        const code = result.status[r];
        const dup = result.refOccurrences[r] > 1 || result.srcOccurrences[r] > 1;
        let bg = '';
        let fg = '';
        if (code === STATUS_EMPTY) {
          continue;
        } else if (code === STATUS_FOUND) {
          bg = dup ? FILL.dup : FILL.found;
          fg = dup ? FONT.dup : FONT.found;
        } else {
          bg = FILL.missing;
          fg = FONT.missing;
        }
        const cell = (ws as Record<string, AnyCell>)[
          XLSX.utils.encode_cell({ r: i + 1, c: index })
        ];
        if (cell) cell.s = { fill: solid(bg), font: { color: { rgb: fg }, bold: true } };
      }
      if (i % 20000 === 0) {
        progress(0.6 + 0.2 * (i / Math.max(1, visibleRows.length)), 'Өнгө оруулж байна...');
        await yieldToUi();
      }
    }
  }

  // ---- summary sheet -----------------------------------------------------
  progress(0.84, 'SUMMARY хуудсыг үүсгэж байна...');
  const summary: (string | number)[][] = [
    ['ХАРЬЦУУЛАЛТЫН ДҮН', ''],
    ['', ''],
    ['Огноо', new Date().toLocaleString()],
    ['Манай тал (source)', `${source.fileName} · ${source.sheetName}`],
    ['Цаанаас ирсэн (reference)', `${reference.fileName} · ${reference.sheetName}`],
    ['', ''],
    ['Нийт манай мөр', results.sourceTotal],
    ['Нийт цаанаас ирсэн мөр', results.referenceTotal],
    ['Зөрүү (манай − цаанаас)', results.sourceTotal - results.referenceTotal],
    ['Экспортлосон мөр', visibleRows.length],
    ['', ''],
  ];

  if (serial) {
    summary.push(
      ['SERIAL', ''],
      ['  Багана (манай)', source.headers[config.sourceSerialCol] ?? ''],
      ['  Багана (цаанаас)', reference.headers[config.refSerialCol] ?? ''],
      ['  БАЙНА', serial.found],
      ['  Байхгүй (зөвхөн манай тал)', serial.missing],
      ['  Хоосон', serial.empty],
      ['  Давхардсан утга (манай)', serial.sourceDuplicateValues],
      ['  Давхардсан мөр (манай)', serial.sourceDuplicateRows],
      ['  Давхардсан утга (цаанаас)', serial.referenceDuplicateValues],
      ['  Ялгаатай утга (манай)', serial.sourceUniqueValues],
      ['  Ялгаатай утга (цаанаас)', serial.referenceUniqueValues],
      ['', ''],
    );
  }
  if (devc) {
    summary.push(
      ['DEVC_NO', ''],
      ['  Багана (манай)', source.headers[config.sourceDevcCol] ?? ''],
      ['  Багана (цаанаас)', reference.headers[config.refDevcCol] ?? ''],
      ['  БАЙНА', devc.found],
      ['  Байхгүй (зөвхөн манай тал)', devc.missing],
      ['  Хоосон', devc.empty],
      ['  Давхардсан утга (манай)', devc.sourceDuplicateValues],
      ['  Давхардсан мөр (манай)', devc.sourceDuplicateRows],
      ['  Давхардсан утга (цаанаас)', devc.referenceDuplicateValues],
      ['', ''],
    );
  }
  summary.push(
    ['Нормалчлал', ''],
    ['  Урд/хойд зай үл тооцох', config.normalize.trim ? 'ТИЙМ' : 'ҮГҮЙ'],
    ['  Том/жижиг үсэг үл ялгах', config.normalize.caseInsensitive ? 'ТИЙМ' : 'ҮГҮЙ'],
    ['  Дотоод зай үл тооцох', config.normalize.ignoreInnerSpaces ? 'ТИЙМ' : 'ҮГҮЙ'],
  );

  const wsSummary = XLSX.utils.aoa_to_sheet(summary);
  (wsSummary as Record<string, unknown>)['!cols'] = [{ wch: 32 }, { wch: 42 }];
  const titleCell = (wsSummary as Record<string, AnyCell>)['A1'];
  if (titleCell) titleCell.s = { font: { bold: true, sz: 14 }, fill: solid(FILL.title) };
  for (let r = 0; r < summary.length; r++) {
    const label = String(summary[r][0] ?? '');
    if (label && !label.startsWith(' ') && r > 0) {
      const cell = (wsSummary as Record<string, AnyCell>)[XLSX.utils.encode_cell({ r, c: 0 })];
      if (cell) cell.s = { font: { bold: true } };
    }
  }

  // ---- duplicates sheet --------------------------------------------------
  const dupRows: (string | number)[][] = [['ТӨРӨЛ', 'УТГА', 'ДАВТАЛТ', 'ТАЛ']];
  const pushDups = (kind: string, result: ColumnResult | null) => {
    if (!result) return;
    for (const d of result.topSourceDuplicates) dupRows.push([kind, d.value, d.count, 'Манай тал']);
    for (const d of result.topReferenceDuplicates)
      dupRows.push([kind, d.value, d.count, 'Цаанаас ирсэн']);
  };
  pushDups('SERIAL', serial);
  pushDups('DEVC_NO', devc);
  const wsDup = XLSX.utils.aoa_to_sheet(dupRows);
  (wsDup as Record<string, unknown>)['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 18 }];
  for (let c = 0; c < 4; c++) {
    const cell = (wsDup as Record<string, AnyCell>)[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = { font: { bold: true }, fill: solid(FILL.header) };
  }

  // ---- workbook ----------------------------------------------------------
  progress(0.9, 'Файл бичиж байна...');
  await yieldToUi();

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'RESULT');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'SUMMARY');
  XLSX.utils.book_append_sheet(wb, wsDup, 'DUPLICATES');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
  const blob = new Blob([out as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  progress(1, 'Бэлэн');
  downloadBlob(blob, opts.fileName ?? 'comparison_result.xlsx');
  return visibleRows.length;
}

/**
 * ЗӨВХӨН "цаанаас ирсэн БАЙХГҮЙ" жагсаалт:
 * цаанаас ирсэн DEVC_NO утгуудаас манай тооллогод БАЙХГҮЙ нь.
 * БАЙНА мөр огт орохгүй, манай талын багана ч орохгүй.
 *
 * @returns татагдсан мөрийн тоо
 */
export async function exportMissing(opts: ExportOptions): Promise<number> {
  const { source, reference, config, results, visibleRows, overrides } = opts;
  const progress = opts.onProgress ?? (() => undefined);

  progress(0.05, 'Excel сан ачааллаж байна...');
  const XLSX = await import('xlsx-js-style');

  const sameSheet = config.sourceDatasetId === config.referenceDatasetId;
  const refDataset = sameSheet ? source : reference;
  const refOverrides = sameSheet ? overrides : undefined;

  type SheetSpec = {
    name: string;
    valueHeader: string;
    statusHeader: string;
    dataset: Dataset;
    ov?: Map<string, CellValue>;
    col: number;
    result: ColumnResult;
    /** Аль мөрийн жагсаалтаар явах вэ. */
    rows: Int32Array;
  };

  const allRows = (n: number) => {
    const out = new Int32Array(n);
    for (let i = 0; i < n; i++) out[i] = i;
    return out;
  };

  const sheets: SheetSpec[] = [];
  if (results.devcRef && config.refDevcCol >= 0) {
    sheets.push({
      name: 'ЦААНААС_БАЙХГҮЙ',
      valueHeader: refDataset.headers[config.refDevcCol] ?? 'DEVC_NO',
      statusHeader: 'ЦААНААС',
      dataset: refDataset,
      ov: refOverrides,
      col: config.refDevcCol,
      result: results.devcRef,
      // Урвуу үр дүн нь ЦААНААС ИРСЭН мөрийн дугаараар индексждэг.
      rows: sameSheet ? visibleRows : allRows(results.devcRef.status.length),
    });
  }

  const wb = XLSX.utils.book_new();
  let exported = 0;

  for (const spec of sheets) {
    const aoa: (string | number | boolean | null)[][] = [
      ['№', spec.valueHeader, spec.statusHeader],
    ];
    for (let i = 0; i < spec.rows.length; i++) {
      const r = spec.rows[i];
      if (r >= spec.result.status.length) continue;
      // БАЙНА мөрүүд огт орохгүй.
      if (spec.result.status[r] === STATUS_FOUND) continue;
      aoa.push([
        r + 1,
        cellRaw(spec.dataset, spec.ov, r, spec.col),
        statusLabel(spec.result.status[r], spec.result.refOccurrences[r]),
      ]);
    }
    exported += aoa.length - 1;

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    (ws as Record<string, unknown>)['!cols'] = [{ wch: 8 }, { wch: 26 }, { wch: 14 }];
    (ws as Record<string, unknown>)['!freeze'] = { xSplit: 0, ySplit: 1 };
    (ws as Record<string, unknown>)['!autofilter'] = { ref: `A1:C${aoa.length}` };
    for (let c = 0; c < 3; c++) {
      const cell = (ws as Record<string, AnyCell>)[XLSX.utils.encode_cell({ r: 0, c })];
      if (cell) {
        cell.s = {
          font: { bold: true, sz: 11 },
          fill: solid(FILL.header),
          border: thinBorder(),
        };
      }
    }
    for (let r = 1; r < aoa.length; r++) {
      const cell = (ws as Record<string, AnyCell>)[XLSX.utils.encode_cell({ r, c: 2 })];
      if (cell) {
        cell.s = { fill: solid(FILL.missing), font: { color: { rgb: FONT.missing }, bold: true } };
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, spec.name);
    await yieldToUi();
  }

  progress(0.9, 'Файл бичиж байна...');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
  const blob = new Blob([out as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  progress(1, 'Бэлэн');
  downloadBlob(blob, opts.fileName ?? 'baihgui.xlsx');
  return exported;
}

function thinBorder() {
  const side = { style: 'thin', color: { rgb: 'D0D3D6' } };
  return { top: side, bottom: side, left: side, right: side };
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

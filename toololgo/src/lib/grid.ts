import type {
  CellValue,
  ColumnResult,
  ComparisonConfig,
  ComparisonResults,
  Dataset,
  FilterState,
  GridColumn,
  StatusFilterKey,
} from '../types';
import { STATUS_EMPTY, STATUS_FOUND, STATUS_MISSING } from '../types';
import { displayValue, normalizeLoose } from './normalize';
import { statusLabel } from './compare';

export const ROW_HEIGHT = 26;
export const LETTER_ROW_HEIGHT = 20;
export const HEADER_ROW_HEIGHT = 30;
export const HEADER_HEIGHT = LETTER_ROW_HEIGHT + HEADER_ROW_HEIGHT;
export const ROW_NUMBER_WIDTH = 58;

const DEFAULT_WIDTH = 140;

/** Columns shown for the SOURCE sheet: original columns + injected result columns. */
export function buildSourceColumns(
  dataset: Dataset,
  config: ComparisonConfig,
  results: ComparisonResults | null,
): GridColumn[] {
  const cols: GridColumn[] = [];
  const hasSerial = !!results?.serial && config.sourceSerialCol >= 0;
  const hasDevc = !!results?.devc && config.sourceDevcCol >= 0;
  // MODE A — эх сурвалж ба лавлах нэг хуудсанд байвал хос багануудыг хажуу хажууд нь тавина.
  const sameSheet = config.sourceDatasetId === config.referenceDatasetId;
  const pairedSerial = sameSheet && hasSerial && config.refSerialCol >= 0;
  const pairedDevc = sameSheet && hasDevc && config.refDevcCol >= 0;

  const dataCol = (i: number, sublabel?: string): GridColumn => ({
    id: `d${i}`,
    label: dataset.headers[i],
    sublabel,
    kind: 'data',
    dataIndex: i,
    width: sublabel ? 165 : DEFAULT_WIDTH,
  });

  const ourStatus = (kind: 'serialStatus' | 'devcStatus'): GridColumn => ({
    id: kind === 'serialStatus' ? 'st-serial' : 'st-devc',
    label: 'ТООЛЛОГО',
    sublabel: 'манай тал',
    kind,
    dataIndex: -1,
    width: 150,
  });
  const refStatus = (kind: 'serialRefStatus' | 'devcRefStatus'): GridColumn => ({
    id: kind === 'serialRefStatus' ? 'st-serial-ref' : 'st-devc-ref',
    label: 'ЦААНААС',
    sublabel: 'ирсэн жагсаалт',
    kind,
    dataIndex: -1,
    width: 150,
  });
  const refRow = (kind: 'refRowSerial' | 'refRowDevc'): GridColumn => ({
    id: kind === 'refRowSerial' ? 'ref-serial' : 'ref-devc',
    label: 'ЦААНААС МӨР',
    sublabel: 'олдсон мөр',
    kind,
    dataIndex: -1,
    width: 110,
  });

  for (let i = 0; i < dataset.headers.length; i++) {
    const isSerial = i === config.sourceSerialCol;
    const isDevc = i === config.sourceDevcCol;

    // Хосолсон лавлах багана нь өөрийн байрандаа дахин гарахгүй.
    if (pairedSerial && i === config.refSerialCol && i !== config.sourceSerialCol) continue;
    if (pairedDevc && i === config.refDevcCol && i !== config.sourceDevcCol) continue;

    // Багана бүр өөрийн БАЙНА/БАЙХГҮЙ статустайгаа хажуу хажуудаа зогсоно.
    if (isSerial) {
      cols.push(dataCol(i, 'МАНАЙ ТООЛЛОГО'));
      if (hasSerial) cols.push(ourStatus('serialStatus'));
      if (pairedSerial) {
        cols.push(dataCol(config.refSerialCol, 'ЦААНААС ИРСЭН'));
        if (results?.serialRef) cols.push(refStatus('serialRefStatus'));
      }
      if (hasSerial) cols.push(refRow('refRowSerial'));
      continue;
    }
    if (isDevc) {
      cols.push(dataCol(i, 'МАНАЙ ТООЛЛОГО'));
      if (hasDevc) cols.push(ourStatus('devcStatus'));
      if (pairedDevc) {
        cols.push(dataCol(config.refDevcCol, 'ЦААНААС ИРСЭН'));
        if (results?.devcRef) cols.push(refStatus('devcRefStatus'));
      }
      if (hasDevc) cols.push(refRow('refRowDevc'));
      continue;
    }
    cols.push(dataCol(i));
  }
  return cols;
}

export function buildPlainColumns(dataset: Dataset): GridColumn[] {
  return dataset.headers.map((label, i) => ({
    id: `d${i}`,
    label,
    kind: 'data' as const,
    dataIndex: i,
    width: DEFAULT_WIDTH,
  }));
}

export function cellRaw(
  dataset: Dataset,
  overrides: Map<string, CellValue> | undefined,
  row: number,
  col: number,
): CellValue {
  const edited = overrides?.get(`${row}:${col}`);
  if (edited !== undefined) return edited;
  return dataset.rows[row]?.[col] ?? null;
}

export interface StatusInfo {
  code: number;
  refOccurrences: number;
  srcOccurrences: number;
  label: string;
  className: string;
}

export function statusInfo(result: ColumnResult | null, row: number): StatusInfo | null {
  if (!result || row >= result.status.length) return null;
  const code = result.status[row];
  const refOcc = result.refOccurrences[row];
  const srcOcc = result.srcOccurrences[row];
  const duplicated = refOcc > 1 || srcOcc > 1;
  let className = 'ec-status-empty';
  if (code === STATUS_MISSING) className = 'ec-status-missing';
  else if (code === STATUS_FOUND) className = duplicated ? 'ec-status-dup' : 'ec-status-found';
  return {
    code,
    refOccurrences: refOcc,
    srcOccurrences: srcOcc,
    label: statusLabel(code, refOcc),
    className,
  };
}

/**
 * Мөр бүрийн ерөнхий төлөв:
 *  - 'found'   → манай талд ч, цаанаас ирсэн жагсаалтад ч БАЙНА
 *  - 'missing' → зөвхөн манай талд байна → ТООЛСОН (улаан)
 */
export function rowStatusClass(results: ComparisonResults | null, row: number): string {
  if (!results) return '';
  const cols = [results.devc, results.serial];
  let sawMissing = false;
  let sawAny = false;
  for (const r of cols) {
    if (!r || row >= r.status.length) continue;
    sawAny = true;
    if (r.status[row] === STATUS_FOUND) return 'ec-row-found';
    if (r.status[row] === STATUS_MISSING) sawMissing = true;
  }
  if (sawMissing) return 'ec-row-missing';
  return sawAny ? '' : '';
}

/** Text rendered inside a cell — also used by search and by the exporter. */
export function cellText(
  column: GridColumn,
  row: number,
  dataset: Dataset,
  overrides: Map<string, CellValue> | undefined,
  results: ComparisonResults | null,
): string {
  switch (column.kind) {
    case 'data':
      return displayValue(cellRaw(dataset, overrides, row, column.dataIndex));
    case 'serialStatus': {
      const info = statusInfo(results?.serial ?? null, row);
      return info ? info.label : '';
    }
    case 'devcStatus': {
      const info = statusInfo(results?.devc ?? null, row);
      return info ? info.label : '';
    }
    case 'serialRefStatus': {
      const info = statusInfo(results?.serialRef ?? null, row);
      return info ? info.label : '';
    }
    case 'devcRefStatus': {
      const info = statusInfo(results?.devcRef ?? null, row);
      return info ? info.label : '';
    }
    case 'refRowSerial':
      return refRowText(results?.serial ?? null, row);
    case 'refRowDevc':
      return refRowText(results?.devc ?? null, row);
    default:
      return '';
  }
}

export function refRowText(result: ColumnResult | null, row: number): string {
  if (!result || row >= result.status.length) return '';
  if (result.status[row] !== STATUS_FOUND) return '—';
  const from = result.matchOffsets[row];
  const to = result.matchOffsets[row + 1];
  if (to <= from) return '—';
  const first = result.matchRows[from] + 1;
  const extra = result.refOccurrences[row] - 1;
  return extra > 0 ? `${first} +${extra}` : `${first}`;
}

function passesStatusFilter(
  result: ColumnResult | null,
  row: number,
  keys: Set<StatusFilterKey>,
): boolean {
  if (keys.size === 0) return true; // "Бүгд"
  if (!result || row >= result.status.length) return false;
  const code = result.status[row];
  const dup = result.refOccurrences[row] > 1 || result.srcOccurrences[row] > 1;
  if (keys.has('found') && code === STATUS_FOUND) return true;
  if (keys.has('missing') && code === STATUS_MISSING) return true;
  if (keys.has('duplicate') && dup && code !== STATUS_EMPTY) return true;
  return false;
}

export function filterRows(
  rowCount: number,
  results: ComparisonResults | null,
  filters: FilterState,
): Int32Array {
  const noFilter =
    filters.serial.size === 0 &&
    filters.devc.size === 0 &&
    filters.serialRef.size === 0 &&
    filters.devcRef.size === 0 &&
    !filters.onlyDuplicates;
  if (noFilter) {
    const all = new Int32Array(rowCount);
    for (let i = 0; i < rowCount; i++) all[i] = i;
    return all;
  }

  const serial = results?.serial ?? null;
  const devc = results?.devc ?? null;
  const serialRef = results?.serialRef ?? null;
  const devcRef = results?.devcRef ?? null;
  const out = new Int32Array(rowCount);
  let n = 0;

  for (let i = 0; i < rowCount; i++) {
    if (!passesStatusFilter(serial, i, filters.serial)) continue;
    if (!passesStatusFilter(devc, i, filters.devc)) continue;
    if (!passesStatusFilter(serialRef, i, filters.serialRef)) continue;
    if (!passesStatusFilter(devcRef, i, filters.devcRef)) continue;
    if (filters.onlyDuplicates) {
      const dupSerial =
        serial && i < serial.status.length &&
        serial.status[i] !== STATUS_EMPTY &&
        (serial.srcOccurrences[i] > 1 || serial.refOccurrences[i] > 1);
      const dupDevc =
        devc && i < devc.status.length &&
        devc.status[i] !== STATUS_EMPTY &&
        (devc.srcOccurrences[i] > 1 || devc.refOccurrences[i] > 1);
      if (!dupSerial && !dupDevc) continue;
    }
    out[n++] = i;
  }
  return out.subarray(0, n);
}

export interface SearchHit {
  rowIndex: number; // index inside the visible row list
  col: number; // index inside the column list
}

export const MAX_SEARCH_HITS = 100000;

export function findMatches(
  query: string,
  visibleRows: Int32Array,
  columns: GridColumn[],
  dataset: Dataset,
  overrides: Map<string, CellValue> | undefined,
  results: ComparisonResults | null,
): SearchHit[] {
  const queries = query
    .split(/[\n,;\t]+/)
    .map((part) => normalizeLoose(part))
    .filter(Boolean);
  if (!queries.length) return [];
  const hits: SearchHit[] = [];
  for (let r = 0; r < visibleRows.length && hits.length < MAX_SEARCH_HITS; r++) {
    const row = visibleRows[r];
    for (let c = 0; c < columns.length; c++) {
      const text = cellText(columns[c], row, dataset, overrides, results);
      if (text && queries.some((q) => text.toUpperCase().includes(q))) {
        hits.push({ rowIndex: r, col: c });
        if (hits.length >= MAX_SEARCH_HITS) break;
      }
    }
  }
  return hits;
}

/** Raw cell value as parsed from the workbook. Never mutated. */
export type CellValue = string | number | boolean | null;

export interface LoadedFile {
  id: string;
  name: string;
  size: number;
  sheetNames: string[];
}

/** One sheet of one file, flattened into headers + rows. Immutable. */
export interface Dataset {
  id: string; // `${fileId}::${sheetName}`
  fileId: string;
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: CellValue[][];
  rowCount: number;
}

export interface NormalizeOptions {
  /** Ignore leading/trailing whitespace. */
  trim: boolean;
  /** Ignore upper/lower case difference. */
  caseInsensitive: boolean;
  /** Ignore spaces inside the value ("AB 001" === "AB001"). */
  ignoreInnerSpaces: boolean;
}

export const DEFAULT_NORMALIZE: NormalizeOptions = {
  trim: true,
  caseInsensitive: true,
  ignoreInnerSpaces: false,
};

export interface ComparisonConfig {
  sourceDatasetId: string | null;
  referenceDatasetId: string | null;
  /** Column index inside the dataset row array. -1 = not used. */
  sourceSerialCol: number;
  refSerialCol: number;
  sourceDevcCol: number;
  refDevcCol: number;
  normalize: NormalizeOptions;
}

/** 0 = empty source value, 1 = found in reference, 2 = missing from reference. */
export const STATUS_EMPTY = 0;
export const STATUS_FOUND = 1;
export const STATUS_MISSING = 2;

export type StatusCode = 0 | 1 | 2;

export interface DuplicateEntry {
  value: string;
  count: number;
}

/** Result of comparing one source column against one reference column. */
export interface ColumnResult {
  /** per source row: STATUS_* */
  status: Uint8Array;
  /** per source row: how many times the value occurs in the REFERENCE column */
  refOccurrences: Uint32Array;
  /** per source row: how many times the value occurs in the SOURCE column itself */
  srcOccurrences: Uint32Array;
  /** CSR offsets into matchRows, length = sourceLen + 1 */
  matchOffsets: Int32Array;
  /** reference row indices (0-based), capped per row by MAX_STORED_MATCHES */
  matchRows: Int32Array;

  found: number;
  missing: number;
  empty: number;

  sourceUniqueValues: number;
  sourceDuplicateValues: number;
  sourceDuplicateRows: number;
  referenceUniqueValues: number;
  referenceDuplicateValues: number;
  referenceEmpty: number;

  topSourceDuplicates: DuplicateEntry[];
  topReferenceDuplicates: DuplicateEntry[];
}

export interface ComparisonResults {
  serial: ColumnResult | null;
  devc: ColumnResult | null;
  /** Урвуу харьцуулалт: цаанаас ирсэн утга манай тооллогод байна уу. */
  serialRef: ColumnResult | null;
  devcRef: ColumnResult | null;
  sourceTotal: number;
  referenceTotal: number;
  durationMs: number;
  computedAt: number;
}

export interface WorkerProgress {
  phase: string;
  pct: number;
  detail?: string;
}

export type StatusFilterKey = 'found' | 'missing' | 'duplicate';

/** Аль статус баганаар шүүх вэ. *Ref = "цаанаас ирсэн" талын статус. */
export type FilterKind = 'serial' | 'devc' | 'serialRef' | 'devcRef';

export interface FilterState {
  serial: Set<StatusFilterKey>;
  devc: Set<StatusFilterKey>;
  serialRef: Set<StatusFilterKey>;
  devcRef: Set<StatusFilterKey>;
  onlyDuplicates: boolean;
}

export type ColumnKind =
  | 'data'
  | 'serialStatus'
  | 'devcStatus'
  | 'serialRefStatus'
  | 'devcRefStatus'
  | 'refRowSerial'
  | 'refRowDevc';

export interface GridColumn {
  id: string;
  label: string;
  sublabel?: string;
  kind: ColumnKind;
  /** index into Dataset.rows[i] — only for kind === 'data' */
  dataIndex: number;
  width: number;
  hidden?: boolean;
}
export type Theme = 'light' | 'dark' | 'system';
export interface CellRef {
  row: number; // index into visible row list
  col: number; // index into visible column list
}


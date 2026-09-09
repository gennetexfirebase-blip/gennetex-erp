import { create } from 'zustand';
import type {
  CellValue,
  ComparisonConfig,
  ComparisonResults,
  Dataset,
  FilterState,
  LoadedFile,
  FilterKind,
  StatusFilterKey,
  Theme,
} from '../types';
import { DEFAULT_NORMALIZE } from '../types';
import { buildDataset, columnValues, isSupportedFile, parseWorkbook } from '../lib/excel';
import { detectColumnPair, detectDevcColumn, detectInventoryColumn, detectSerialColumn } from '../lib/columns';
import type { ParsedSheet } from '../workers/excel.worker';
import type { CompareRequest, CompareResponse } from '../workers/comparison.worker';
import { generateTestSheets, type TestDataOptions } from '../lib/testdata';
import { compareMissingMarkers } from '../lib/compare';
import { isMissingMarker } from '../lib/normalize';

export type SheetTab = 'source' | 'reference' | 'duplicates';

/** Түүхээс буцаан сэргээх өгөгдөл (`lib/history.ts` → SessionPayload). */
export interface RestorePayload {
  hasHeaderRow: boolean;
  config: ComparisonConfig;
  source: Dataset;
  reference: Dataset | null;
}

/**
 * Хадгалсан Dataset-ээс түүхий хуудсыг эргүүлэн угсарна.
 *
 * `rawSheets` нь толгойн мөрийн тохиргоо солигдоход датасетийг дахин
 * барихад хэрэгтэй. Түүхэнд зөвхөн Dataset хадгалдаг (хоёуланг нь
 * хадгалбал өгөгдөл 2 дахин том болно) тул эндээс сэргээнэ.
 */
function sheetFromDataset(ds: Dataset, hasHeaderRow: boolean): ParsedSheet {
  return {
    name: ds.sheetName,
    matrix: hasHeaderRow ? [ds.headers as CellValue[], ...ds.rows] : ds.rows,
    maxCols: ds.headers.length,
  };
}

export interface BusyState {
  label: string;
  detail: string;
  pct: number; // 0..1, negative = indeterminate
}

export interface CellEdit {
  datasetId: string;
  row: number;
  col: number;
  prev: CellValue;
  next: CellValue;
}

export interface Selection {
  row: number;
  col: number;
  anchorRow: number;
  anchorCol: number;
}

export interface JumpTarget {
  tab: SheetTab;
  row: number;
  token: number;
}

interface AppState {
  // ---- data -------------------------------------------------------------
  files: LoadedFile[];
  rawSheets: Record<string, ParsedSheet>;
  datasets: Record<string, Dataset>;
  hasHeaderRow: boolean;

  // ---- comparison -------------------------------------------------------
  config: ComparisonConfig;
  results: ComparisonResults | null;
  stale: boolean;

  // ---- edits ------------------------------------------------------------
  overrides: Record<string, Map<string, CellValue>>;
  undoStack: CellEdit[][];
  redoStack: CellEdit[][];

  // ---- ui ---------------------------------------------------------------
  theme: Theme;
  busy: BusyState | null;
  error: string | null;
  notice: string | null;
  importOpen: boolean;
  settingsOpen: boolean;
  activeTab: SheetTab;
  filters: FilterState;
  search: string;
  searchIndex: number;
  frozenColumns: number;
  selection: Selection | null;
  jump: JumpTarget | null;

  // ---- actions ----------------------------------------------------------
  setTheme: (t: Theme) => void;
  setError: (message: string | null) => void;
  setNotice: (message: string | null) => void;
  openImport: () => void;
  closeImport: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  setActiveTab: (tab: SheetTab) => void;
  setFilter: (kind: FilterKind, keys: Set<StatusFilterKey>) => void;
  toggleOnlyDuplicates: () => void;
  clearFilters: () => void;
  setSearch: (q: string) => void;
  setSearchIndex: (i: number) => void;
  setFrozenColumns: (n: number) => void;
  setSelection: (s: Selection | null) => void;
  jumpTo: (tab: SheetTab, row: number) => void;

  loadFiles: (files: FileList | File[]) => Promise<void>;
  loadTestData: (opts?: Partial<TestDataOptions>) => void;
  setHasHeaderRow: (v: boolean) => void;
  updateConfig: (patch: Partial<ComparisonConfig>) => void;
  runComparison: () => Promise<void>;
  restoreSession: (payload: RestorePayload) => Promise<void>;
  applyEdits: (edits: CellEdit[]) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

const EMPTY_CONFIG: ComparisonConfig = {
  sourceDatasetId: null,
  referenceDatasetId: null,
  sourceSerialCol: -1,
  refSerialCol: -1,
  sourceDevcCol: -1,
  refDevcCol: -1,
  normalize: { ...DEFAULT_NORMALIZE },
};

const allFilters = (): Set<StatusFilterKey> => new Set<StatusFilterKey>();

function readTheme(): Theme {
  try {
    const t = localStorage.getItem('ec-theme');
    if (t === 'light' || t === 'dark' || t === 'system') return t;
  } catch {
    /* storage unavailable */
  }
  return 'system';
}

export function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

let comparisonWorker: Worker | null = null;
let comparisonToken = 0;

function getComparisonWorker(): Worker | null {
  if (comparisonWorker) return comparisonWorker;
  try {
    comparisonWorker = new Worker(new URL('../workers/comparison.worker.ts', import.meta.url), {
      type: 'module',
    });
    return comparisonWorker;
  } catch {
    return null;
  }
}

export const useApp = create<AppState>((set, get) => ({
  files: [],
  rawSheets: {},
  datasets: {},
  hasHeaderRow: true,

  config: { ...EMPTY_CONFIG },
  results: null,
  stale: false,

  overrides: {},
  undoStack: [],
  redoStack: [],

  theme: readTheme(),
  busy: null,
  error: null,
  notice: null,
  importOpen: false,
  settingsOpen: false,
  activeTab: 'source',
  filters: {
      serial: allFilters(),
      devc: allFilters(),
      serialRef: allFilters(),
      devcRef: allFilters(),
      onlyDuplicates: false,
    },
  search: '',
  searchIndex: 0,
  frozenColumns: 1,
  selection: null,
  jump: null,

  setTheme: (theme) => {
    try {
      localStorage.setItem('ec-theme', theme);
    } catch {
      /* ignore */
    }
    applyTheme(theme);
    set({ theme });
  },
  setError: (error) => set({ error }),
  setNotice: (notice) => set({ notice }),
  openImport: () => set({ importOpen: true }),
  closeImport: () => set({ importOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  setActiveTab: (activeTab) => set({ activeTab, selection: null }),
  setFilter: (kind, keys) =>
    set((s) => ({ filters: { ...s.filters, [kind]: keys }, selection: null })),
  toggleOnlyDuplicates: () =>
    set((s) => ({
      filters: { ...s.filters, onlyDuplicates: !s.filters.onlyDuplicates },
      selection: null,
    })),
  clearFilters: () =>
    set({ filters: {
      serial: allFilters(),
      devc: allFilters(),
      serialRef: allFilters(),
      devcRef: allFilters(),
      onlyDuplicates: false,
    } }),
  setSearch: (search) => set({ search, searchIndex: 0 }),
  setSearchIndex: (searchIndex) => set({ searchIndex }),
  setFrozenColumns: (frozenColumns) => set({ frozenColumns }),
  setSelection: (selection) => set({ selection }),
  jumpTo: (tab, row) =>
    set({ activeTab: tab, jump: { tab, row, token: Date.now() + Math.random() } }),

  // -----------------------------------------------------------------------
  loadFiles: async (fileList) => {
    const files = Array.from(fileList);
    if (!files.length) return;

    const unsupported = files.find((f) => !isSupportedFile(f));
    if (unsupported) {
      set({ error: `Дэмжигдээгүй файл байна: ${unsupported.name} (.xlsx, .xls, .csv)` });
      return;
    }

    set({ error: null, busy: { label: 'Excel уншиж байна...', detail: '', pct: 0 } });

    const nextFiles: LoadedFile[] = [];
    const nextRaw: Record<string, ParsedSheet> = {};
    const nextDatasets: Record<string, Dataset> = {};

    try {
      for (const file of files) {
        const fileId = `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const sheets = await parseWorkbook(file, (_phase, pct, detail) =>
          set({ busy: { label: 'Excel уншиж байна...', detail: detail ?? '', pct } }),
        );
        const usable = sheets.filter((s) => s.matrix.length > 0);
        if (!usable.length) {
          set({ busy: null, error: `Файл хоосон байна: ${file.name}` });
          return;
        }
        nextFiles.push({ id: fileId, name: file.name, size: file.size, sheetNames: usable.map((s) => s.name) });
        for (const sheet of usable) {
          const ds = buildDataset(sheet, {
            fileId,
            fileName: file.name,
            hasHeaderRow: get().hasHeaderRow,
          });
          nextRaw[ds.id] = sheet;
          nextDatasets[ds.id] = ds;
        }
      }
    } catch (err) {
      set({
        busy: null,
        error: err instanceof Error ? err.message : 'Excel файл уншиж чадсангүй.',
      });
      return;
    }

    const nextConfig = autoConfigure(
      { ...get().datasets, ...nextDatasets },
      get().config,
      Object.keys(nextDatasets),
    );
    set((s) => {
      const files = [...s.files, ...nextFiles];
      const rawSheets = { ...s.rawSheets, ...nextRaw };
      const datasets = { ...s.datasets, ...nextDatasets };
      return {
        files,
        rawSheets,
        datasets,
        config: nextConfig,
        busy: null,
        importOpen: !canCompare(nextConfig, datasets),
      };
    });

    if (canCompare(nextConfig, { ...get().datasets, ...nextDatasets })) {
      setTimeout(() => void get().runComparison(), 0);
    }
  },

  loadTestData: (opts) => {
    const sheets = generateTestSheets({
      rows: 100_000,
      matchRate: 0.9,
      duplicateRate: 0.015,
      emptyRate: 0.005,
      ...opts,
    });
    const fileId = 'test-data';
    const rawSheets: Record<string, ParsedSheet> = {};
    const datasets: Record<string, Dataset> = {};
    for (const sheet of sheets) {
      const ds = buildDataset(sheet, {
        fileId,
        fileName: 'test-data.xlsx',
        hasHeaderRow: true,
      });
      rawSheets[ds.id] = sheet;
      datasets[ds.id] = ds;
    }
    const rowCount = sheets[0].matrix.length - 1;
    set((s) => ({
      files: [
        ...s.files.filter((f) => f.id !== fileId),
        {
          id: fileId,
          name: `test-data.xlsx (${rowCount.toLocaleString()} мөр)`,
          size: 0,
          sheetNames: sheets.map((x) => x.name),
        },
      ],
      rawSheets: { ...s.rawSheets, ...rawSheets },
      datasets: { ...s.datasets, ...datasets },
      config: autoConfigure({ ...s.datasets, ...datasets }, s.config, Object.keys(datasets)),
      importOpen: true,
      error: null,
    }));
  },

  setHasHeaderRow: (hasHeaderRow) => {
    set((s) => {
      const datasets: Record<string, Dataset> = {};
      for (const [id, sheet] of Object.entries(s.rawSheets)) {
        const prev = s.datasets[id];
        datasets[id] = buildDataset(sheet, {
          fileId: prev.fileId,
          fileName: prev.fileName,
          hasHeaderRow,
        });
      }
      return {
        hasHeaderRow,
        datasets,
        config: autoConfigure(datasets, s.config, Object.keys(datasets), true),
      };
    });
  },

  updateConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch }, stale: true })),

  runComparison: async () => {
    const { config, datasets, overrides } = get();
    const source = config.sourceDatasetId ? datasets[config.sourceDatasetId] : null;
    const reference = config.referenceDatasetId ? datasets[config.referenceDatasetId] : null;

    if (!source) {
      set({ error: 'Эх өгөгдөл (манай тал) сонгогдоогүй байна.' });
      return;
    }
    if (!reference) {
      set({ error: 'Харьцуулах өгөгдөл (цаанаас ирсэн) сонгогдоогүй байна.' });
      return;
    }
    const hasSerial = config.sourceSerialCol >= 0 && config.refSerialCol >= 0;
    const hasDevc = config.sourceDevcCol >= 0 && config.refDevcCol >= 0;
    if (!hasSerial && !hasDevc) {
      const markerCol = findMissingMarkerColumn(source);
      if (markerCol >= 0) {
        set({
          config: { ...config, sourceDevcCol: markerCol },
          results: {
            serial: null,
            devc: compareMissingMarkers(columnValues(source, markerCol)),
            serialRef: null,
            devcRef: null,
            sourceTotal: source.rowCount,
            referenceTotal: reference.rowCount,
            durationMs: 0,
            computedAt: Date.now(),
          },
          busy: null,
          error: null,
          stale: false,
          importOpen: false,
          settingsOpen: false,
          activeTab: 'source',
        });
        return;
      }
      set({ error: 'SERIAL багана олдсонгүй. Тохиргооноос багануудаа сонгоно уу.' });
      return;
    }

    const srcOv = overrides[source.id];
    const refOv = overrides[reference.id];

    const request: CompareRequest = {
      type: 'compare',
      sourceSerial: hasSerial ? columnValues(source, config.sourceSerialCol, srcOv) : null,
      refSerial: hasSerial ? columnValues(reference, config.refSerialCol, refOv) : null,
      sourceDevc: hasDevc ? columnValues(source, config.sourceDevcCol, srcOv) : null,
      refDevc: hasDevc ? columnValues(reference, config.refDevcCol, refOv) : null,
      sourceTotal: source.rowCount,
      referenceTotal: reference.rowCount,
      options: config.normalize,
    };

    set({
      busy: { label: 'Харьцуулж байна...', detail: 'Индекс бэлдэж байна...', pct: 0 },
      error: null,
    });

    const worker = getComparisonWorker();
    const token = ++comparisonToken;

    if (!worker) {
      // Fallback: run on the main thread (small datasets only).
      const { compareColumn } = await import('../lib/compare');
      const started = performance.now();
      const results: ComparisonResults = {
        serial: hasSerial
          ? compareColumn(request.sourceSerial!, request.refSerial!, config.normalize)
          : null,
        devc: hasDevc ? compareColumn(request.sourceDevc!, request.refDevc!, config.normalize) : null,
        serialRef: hasSerial
          ? compareColumn(request.refSerial!, request.sourceSerial!, config.normalize)
          : null,
        devcRef: hasDevc
          ? compareColumn(request.refDevc!, request.sourceDevc!, config.normalize)
          : null,
        sourceTotal: source.rowCount,
        referenceTotal: reference.rowCount,
        durationMs: performance.now() - started,
        computedAt: Date.now(),
      };
      set({ results, busy: null, stale: false, importOpen: false, settingsOpen: false });
      return;
    }

    await new Promise<void>((resolve) => {
      const onMessage = (e: MessageEvent<CompareResponse>) => {
        if (token !== comparisonToken) return;
        const msg = e.data;
        if (msg.type === 'progress') {
          set({
            busy: {
              label: 'Харьцуулж байна...',
              detail: msg.detail ?? '',
              pct: Math.min(0.99, msg.pct),
            },
          });
        } else if (msg.type === 'result') {
          worker.removeEventListener('message', onMessage);
          set({
            results: {
              serial: msg.serial,
              devc: msg.devc,
              serialRef: msg.serialRef,
              devcRef: msg.devcRef,
              sourceTotal: msg.sourceTotal,
              referenceTotal: msg.referenceTotal,
              durationMs: msg.durationMs,
              computedAt: Date.now(),
            },
            busy: null,
            stale: false,
            importOpen: false,
            settingsOpen: false,
            activeTab: 'source',
          });
          resolve();
        } else if (msg.type === 'error') {
          worker.removeEventListener('message', onMessage);
          set({ busy: null, error: msg.message });
          resolve();
        }
      };
      worker.addEventListener('message', onMessage);
      worker.postMessage(request);
    });
  },

  restoreSession: async (payload) => {
    comparisonToken++;
    if (comparisonWorker) {
      comparisonWorker.terminate();
      comparisonWorker = null;
    }

    const rawSheets: Record<string, ParsedSheet> = {};
    const datasets: Record<string, Dataset> = {};
    const files: LoadedFile[] = [];

    for (const ds of [payload.source, payload.reference]) {
      if (!ds) continue;
      datasets[ds.id] = ds;
      rawSheets[ds.id] = sheetFromDataset(ds, payload.hasHeaderRow);
      const existing = files.find((f) => f.id === ds.fileId);
      if (existing) existing.sheetNames.push(ds.sheetName);
      else files.push({ id: ds.fileId, name: ds.fileName, size: 0, sheetNames: [ds.sheetName] });
    }

    set({
      files,
      rawSheets,
      datasets,
      hasHeaderRow: payload.hasHeaderRow,
      config: payload.config,
      results: null,
      stale: false,
      overrides: {},
      undoStack: [],
      redoStack: [],
      busy: null,
      error: null,
      importOpen: false,
      settingsOpen: false,
      activeTab: 'source',
      filters: {
        serial: allFilters(),
        devc: allFilters(),
        serialRef: allFilters(),
        devcRef: allFilters(),
        onlyDuplicates: false,
      },
      search: '',
      searchIndex: 0,
      selection: null,
      jump: null,
    });

    await get().runComparison();
  },

  applyEdits: (edits) => {
    if (!edits.length) return;
    set((s) => {
      const overrides = { ...s.overrides };
      for (const e of edits) {
        const map = new Map(overrides[e.datasetId] ?? []);
        map.set(`${e.row}:${e.col}`, e.next);
        overrides[e.datasetId] = map;
      }
      return {
        overrides,
        undoStack: [...s.undoStack.slice(-99), edits],
        redoStack: [],
        stale: isComparedEdit(s.config, edits),
      };
    });
  },

  undo: () =>
    set((s) => {
      const batch = s.undoStack[s.undoStack.length - 1];
      if (!batch) return s;
      const overrides = { ...s.overrides };
      for (const e of batch) {
        const map = new Map(overrides[e.datasetId] ?? []);
        map.set(`${e.row}:${e.col}`, e.prev);
        overrides[e.datasetId] = map;
      }
      return {
        overrides,
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, batch],
        stale: s.stale || isComparedEdit(s.config, batch),
      };
    }),

  redo: () =>
    set((s) => {
      const batch = s.redoStack[s.redoStack.length - 1];
      if (!batch) return s;
      const overrides = { ...s.overrides };
      for (const e of batch) {
        const map = new Map(overrides[e.datasetId] ?? []);
        map.set(`${e.row}:${e.col}`, e.next);
        overrides[e.datasetId] = map;
      }
      return {
        overrides,
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [...s.undoStack, batch],
        stale: s.stale || isComparedEdit(s.config, batch),
      };
    }),

  reset: () => {
    comparisonToken++;
    if (comparisonWorker) {
      comparisonWorker.terminate();
      comparisonWorker = null;
    }
    set({
      files: [],
      rawSheets: {},
      datasets: {},
      config: { ...EMPTY_CONFIG },
      results: null,
      stale: false,
      overrides: {},
      undoStack: [],
      redoStack: [],
      busy: null,
      error: null,
      notice: null,
      importOpen: false,
      settingsOpen: false,
      activeTab: 'source',
      filters: {
      serial: allFilters(),
      devc: allFilters(),
      serialRef: allFilters(),
      devcRef: allFilters(),
      onlyDuplicates: false,
    },
      search: '',
      searchIndex: 0,
      selection: null,
      jump: null,
    });
  },
}));

function isComparedEdit(config: ComparisonConfig, edits: CellEdit[]): boolean {
  return edits.some(
    (e) =>
      (e.datasetId === config.sourceDatasetId &&
        (e.col === config.sourceSerialCol || e.col === config.sourceDevcCol)) ||
      (e.datasetId === config.referenceDatasetId &&
        (e.col === config.refSerialCol || e.col === config.refDevcCol)),
  );
}

/** Тохиргоо нээхгүйгээр шууд харьцуулах боломжтой эсэх. */
function canCompare(config: ComparisonConfig, datasets: Record<string, Dataset>): boolean {
  const source = config.sourceDatasetId ? datasets[config.sourceDatasetId] : null;
  if (!source || !config.referenceDatasetId || !datasets[config.referenceDatasetId]) return false;
  if (config.sourceSerialCol >= 0 && config.refSerialCol >= 0) return true;
  if (config.sourceDevcCol >= 0 && config.refDevcCol >= 0) return true;
  return findMissingMarkerColumn(source) >= 0;
}

function findMissingMarkerColumn(dataset: Dataset): number {
  for (let col = 0; col < dataset.headers.length; col++) {
    if (dataset.rows.some((row) => isMissingMarker(row[col]))) return col;
  }
  return -1;
}

/**
 * Picks sensible source/reference datasets and columns.
 *  - two or more sheets  -> sheet 1 = SOURCE (манай тал), sheet 2 = REFERENCE
 *  - a single sheet      -> MODE A, two SERIAL-ish columns inside that sheet
 */
export function autoConfigure(
  datasets: Record<string, Dataset>,
  previous: ComparisonConfig,
  newIds: string[],
  keepSelection = false,
): ComparisonConfig {
  const ids = Object.keys(datasets);
  if (!ids.length) return { ...EMPTY_CONFIG, normalize: previous.normalize };

  let sourceId = keepSelection && previous.sourceDatasetId ? previous.sourceDatasetId : null;
  let refId = keepSelection && previous.referenceDatasetId ? previous.referenceDatasetId : null;

  if (!sourceId || !datasets[sourceId]) sourceId = newIds[0] ?? ids[0];
  if (!refId || !datasets[refId]) {
    const candidates = ids.filter((id) => id !== sourceId);
    // prefer a sheet from the same batch, otherwise any other loaded sheet
    refId = newIds.find((id) => id !== sourceId) ?? candidates[0] ?? sourceId;
  }

  const source = datasets[sourceId];
  const reference = datasets[refId];

  if (sourceId === refId) {
    // MODE A — two columns in one sheet
    const devc = detectColumnPair(source.headers, 'devc', source.rows);
    const used = [devc.source, devc.reference].filter((c) => c >= 0);
    const serial = detectColumnPair(source.headers, 'serial', source.rows, used);
    return {
      sourceDatasetId: sourceId,
      referenceDatasetId: refId,
      sourceSerialCol: serial.source,
      refSerialCol: serial.reference,
      sourceDevcCol: devc.source,
      refDevcCol: devc.reference,
      normalize: previous.normalize,
    };
  }

  // MODE B — separate sheets / files
  const sSerial = detectSerialColumn(source.headers);
  const rSerial = detectSerialColumn(reference.headers);
  const rDevc = detectDevcColumn(reference.headers, rSerial >= 0 ? [rSerial] : []);
  const sInventory = detectInventoryColumn(
    source.headers,
    source.rows,
    sSerial >= 0 ? [sSerial] : [],
    rDevc >= 0 ? reference.rows.map((row) => row[rDevc]) : [],
  );
  const sDevc = sInventory >= 0
    ? sInventory
    : detectDevcColumn(source.headers, sSerial >= 0 ? [sSerial] : []);

  return {
    sourceDatasetId: sourceId,
    referenceDatasetId: refId,
    sourceSerialCol: sSerial,
    refSerialCol: rSerial,
    sourceDevcCol: sDevc,
    refDevcCol: rDevc,
    normalize: previous.normalize,
  };
}

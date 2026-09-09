import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Copy, Database, History, Lock, LogOut, Table2, X } from 'lucide-react';
import { useApp, applyTheme, type BusyState, type SheetTab } from './stores/appStore';
import { Toolbar } from './components/Toolbar';
import { ExcelUploader } from './components/excel/ExcelUploader';
import { ImportDialog } from './components/excel/ImportDialog';
import { ComparisonSettings } from './components/comparison/ComparisonSettings';
import { SummaryBar } from './components/comparison/SummaryBar';
import { ResultPopover, type PopoverTarget } from './components/comparison/ResultPopover';
import { DuplicatePanel } from './components/comparison/DuplicatePanel';
import { FilterMenu, type FilterMenuTarget } from './components/filters/FilterMenu';
import { Spreadsheet } from './components/spreadsheet/Spreadsheet';
import { FormulaBar } from './components/spreadsheet/FormulaBar';
import { ProgressOverlay } from './components/ProgressOverlay';
import { Modal } from './components/ui/Modal';
import { HistoryPanel } from './components/history/HistoryPanel';
import { SaveSessionDialog } from './components/history/SaveSessionDialog';
import { supabase } from './lib/supabase';
import {
  buildPlainColumns,
  buildSourceColumns,
  cellRaw,
  cellText,
  filterRows,
  findMatches,
  type SearchHit,
} from './lib/grid';
import { exportComparison, exportMissing } from './lib/exporter';
import { displayValue } from './lib/normalize';
import { ms, num } from './lib/format';
import { STATUS_EMPTY, STATUS_FOUND, type FilterKind, type StatusFilterKey } from './types';

export default function App({ userEmail }: { userEmail: string }) {
  const s = useApp();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [popover, setPopover] = useState<PopoverTarget | null>(null);
  const [filterMenu, setFilterMenu] = useState<FilterMenuTarget | null>(null);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [hiddenHits, setHiddenHits] = useState(0);
  const [exportBusy, setExportBusy] = useState<BusyState | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const [flashRow, setFlashRow] = useState<number | null>(null);
  const dropDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  const source = s.config.sourceDatasetId ? s.datasets[s.config.sourceDatasetId] : null;
  const reference = s.config.referenceDatasetId ? s.datasets[s.config.referenceDatasetId] : null;
  const hasData = !!source && !!s.results;

  useEffect(() => {
    applyTheme(s.theme);
    if (s.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [s.theme]);

  // ---- undo / redo shortcuts ---------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        s.undo();
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        s.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s]);

  // ---- active grid --------------------------------------------------------
  const tab: SheetTab = s.activeTab;
  const gridDataset = tab === 'reference' ? reference : source;
  const gridResults = tab === 'source' ? s.results : null;
  const gridOverrides = gridDataset ? s.overrides[gridDataset.id] : undefined;

  const baseColumns = useMemo(() => {
    if (!gridDataset) return [];
    return tab === 'source'
      ? buildSourceColumns(gridDataset, s.config, s.results)
      : buildPlainColumns(gridDataset);
  }, [gridDataset, tab, s.config, s.results]);

  const columns = useMemo(
    () =>
      baseColumns.map((c) => {
        const w = widths[`${tab}:${c.id}`];
        return w ? { ...c, width: w } : c;
      }),
    [baseColumns, widths, tab],
  );

  const visibleRows = useMemo(() => {
    if (!gridDataset) return new Int32Array(0);
    if (tab !== 'source') {
      const all = new Int32Array(gridDataset.rowCount);
      for (let i = 0; i < all.length; i++) all[i] = i;
      return all;
    }
    return filterRows(gridDataset.rowCount, s.results, s.filters);
  }, [gridDataset, tab, s.results, s.filters]);

  const hasFilters =
    s.filters.serial.size > 0 ||
    s.filters.devc.size > 0 ||
    s.filters.serialRef.size > 0 ||
    s.filters.devcRef.size > 0 ||
    s.filters.onlyDuplicates;

  // ---- search (debounced) -------------------------------------------------
  useEffect(() => {
    if (!s.search.trim() || !gridDataset) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      const found = findMatches(
        s.search,
        visibleRows,
        columns,
        gridDataset,
        gridOverrides,
        gridResults,
      );
      setHits(found);
      // Шүүлт идэвхтэй үед хайлт зөвхөн харагдаж буй мөрүүдээр явдаг.
      // Юу ч олдоогүй бол шүүлтээс ГАДНА байгаа эсэхийг шалгаж мэдэгдэнэ.
      if (!found.length && hasFilters) {
        const all = new Int32Array(gridDataset.rowCount);
        for (let i = 0; i < all.length; i++) all[i] = i;
        const outside = findMatches(
          s.search,
          all,
          columns,
          gridDataset,
          gridOverrides,
          gridResults,
        );
        setHiddenHits(outside.length);
      } else {
        setHiddenHits(0);
      }
      setSearching(false);
    }, 220);
    return () => clearTimeout(t);
  }, [s.search, visibleRows, columns, gridDataset, gridOverrides, gridResults, hasFilters]);

  const activeHit = hits.length ? (hits[s.searchIndex % hits.length] ?? null) : null;

  const nextHit = useCallback(() => {
    if (hits.length) s.setSearchIndex((s.searchIndex + 1) % hits.length);
  }, [hits.length, s]);
  const prevHit = useCallback(() => {
    if (hits.length) s.setSearchIndex((s.searchIndex - 1 + hits.length) % hits.length);
  }, [hits.length, s]);

  // ---- filter menu counts -------------------------------------------------
  const filterCounts = useMemo(() => {
    const empty = { found: 0, missing: 0, duplicate: 0, total: 0 };
    if (!filterMenu || !s.results) return empty;
    const r =
      filterMenu.kind === 'serial'
        ? s.results.serial
        : filterMenu.kind === 'devc'
          ? s.results.devc
          : filterMenu.kind === 'serialRef'
            ? s.results.serialRef
            : s.results.devcRef;
    if (!r) return empty;
    let duplicate = 0;
    for (let i = 0; i < r.status.length; i++) {
      if (r.status[i] !== STATUS_EMPTY && (r.srcOccurrences[i] > 1 || r.refOccurrences[i] > 1))
        duplicate++;
    }
    return { found: r.found, missing: r.missing, duplicate, total: r.status.length };
  }, [filterMenu, s.results]);

  // compact экспортод орох мөр: харагдаж буй мөрүүдээс БАЙНА-г хасна.
  const exportableCount = useMemo(() => {
    const primary =
      s.results?.devcRef ?? s.results?.serialRef ?? s.results?.devc ?? s.results?.serial ?? null;
    if (!primary) return visibleRows.length;
    let n = 0;
    for (let i = 0; i < visibleRows.length; i++) {
      const r = visibleRows[i];
      if (r < primary.status.length && primary.status[r] !== STATUS_FOUND) n++;
    }
    return n;
  }, [visibleRows, s.results]);


  // ---- handlers -----------------------------------------------------------
  const onStatusClick = useCallback((dataRow: number, kind: 'serial' | 'devc', rect: DOMRect) => {
    setPopover({ dataRow, kind, rect });
  }, []);

  const goToReference = useCallback(
    (row: number) => {
      setPopover(null);
      s.jumpTo('reference', row);
      setFlashRow(row);
      setTimeout(() => setFlashRow(null), 2600);
    },
    [s],
  );

  const summaryFilter = (kind: FilterKind, key: StatusFilterKey) => {
    const current = s.filters[kind];
    const next = new Set(current);
    if (next.has(key) && next.size === 1) next.clear();
    else {
      next.clear();
      next.add(key);
    }
    s.setActiveTab('source');
    s.setFilter(kind, next);
  };

  const filterByValue = (dataRow: number, kind: 'serial' | 'devc') => {
    if (!source) return;
    const col = kind === 'serial' ? s.config.sourceSerialCol : s.config.sourceDevcCol;
    if (col < 0) return;
    const value = displayValue(cellRaw(source, s.overrides[source.id], dataRow, col));
    if (value) s.setSearch(value);
  };

  const handleExport = async (mode: 'compact' | 'full' = 'compact') => {
    if (!source || !reference || !s.results) return;
    try {
      setExportBusy({ label: 'Excel экспортлож байна...', detail: '', pct: 0 });
      const run = mode === 'compact' ? exportMissing : exportComparison;
      const exported = await run({
        source,
        reference,
        config: s.config,
        results: s.results,
        visibleRows,
        overrides: s.overrides[source.id],
        styled: visibleRows.length <= 60000,
        mode,
        fileName: mode === 'compact' ? 'baihgui.xlsx' : 'comparison_result.xlsx',
        onProgress: (pct, label) =>
          setExportBusy({ label: 'Excel экспортлож байна...', detail: label, pct }),
      });
      s.setNotice(
        `${mode === 'compact' ? 'baihgui.xlsx' : 'comparison_result.xlsx'} татагдлаа — ${num(exported)} мөр${
          visibleRows.length > 60000 ? ' (том файл тул өнгөгүй)' : ''
        }`,
      );
    } catch {
      s.setError('Excel экспортлож чадсангүй.');
    } finally {
      setExportBusy(null);
    }
  };

  // ---- window-wide drag & drop -------------------------------------------
  useEffect(() => {
    const onEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      dropDepth.current++;
      setDragging(true);
    };
    const onLeave = () => {
      dropDepth.current--;
      if (dropDepth.current <= 0) setDragging(false);
    };
    const onOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dropDepth.current = 0;
      setDragging(false);
      if (e.dataTransfer?.files.length) void s.loadFiles(e.dataTransfer.files);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [s]);

  // ---- formula bar value --------------------------------------------------
  const selectedColumn = s.selection ? (columns[s.selection.col] ?? null) : null;
  const selectedDataRow =
    s.selection && s.selection.row < visibleRows.length ? visibleRows[s.selection.row] : null;
  const formulaValue =
    selectedColumn && selectedDataRow !== null && gridDataset
      ? cellText(selectedColumn, selectedDataRow, gridDataset, gridOverrides, gridResults)
      : '';

  const busy = s.busy ?? exportBusy;

  // Rendered as elements (not nested components) so their internal state survives
  // a parent re-render.
  const importModal = s.importOpen ? (
    <ImportDialog
      files={s.files}
      datasets={s.datasets}
      config={s.config}
      hasHeaderRow={s.hasHeaderRow}
      onHeaderRowChange={s.setHasHeaderRow}
      onConfigChange={s.updateConfig}
      onAddFiles={(f) => void s.loadFiles(f)}
      onOpenSettings={() => {
        s.closeImport();
        s.openSettings();
      }}
      onClose={s.closeImport}
      onStart={() => void s.runComparison()}
    />
  ) : null;

  const historyModal = historyOpen ? (
    <HistoryPanel
      onClose={() => setHistoryOpen(false)}
      onOpen={(payload) => void s.restoreSession(payload)}
      onError={s.setError}
    />
  ) : null;

  const saveModal =
    saveOpen && source && s.results ? (
      <SaveSessionDialog
        source={source}
        reference={reference}
        config={s.config}
        results={s.results}
        hasHeaderRow={s.hasHeaderRow}
        onClose={() => setSaveOpen(false)}
        onSaved={s.setNotice}
        onError={s.setError}
      />
    ) : null;

  const settingsModal = s.settingsOpen ? (
    <ComparisonSettings
      config={s.config}
      datasets={s.datasets}
      onCancel={s.closeSettings}
      onApply={(cfg) => {
        s.updateConfig(cfg);
        setTimeout(() => void s.runComparison(), 0);
      }}
    />
  ) : null;

  // ---- empty state --------------------------------------------------------
  if (!hasData && !s.files.length) {
    return (
      <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
        <div
          className="flex h-11 flex-none items-center gap-2 border-b px-3"
          style={{ background: 'var(--bg-chrome)', borderColor: 'var(--grid-line)' }}
        >
          <span className="text-[14px]" style={{ color: 'var(--text)' }}>
            GENNETEX Тооллого
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span
              className="hidden max-w-[220px] truncate text-[12px] sm:inline"
              style={{ color: 'var(--text-muted)' }}
              title={userEmail}
            >
              {userEmail}
            </span>
            <button className="ec-btn" onClick={() => setHistoryOpen(true)}>
              <History size={14} /> Түүх
            </button>
            <button className="ec-btn px-2" onClick={() => void supabase.auth.signOut()} title="Гарах">
              <LogOut size={15} />
            </button>
          </div>
        </div>
        <ExcelUploader onFiles={(f) => void s.loadFiles(f)} onTestData={() => s.loadTestData()} />
        {busy && <ProgressOverlay busy={busy} />}
        {s.error && <ErrorToast message={s.error} onClose={() => s.setError(null)} />}
        {s.notice && <NoticeToast message={s.notice} onClose={() => s.setNotice(null)} />}
        {importModal}
        {settingsModal}
        {historyModal}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Toolbar
        title={source ? `${source.fileName}` : 'Excel Compare'}
        subtitle={
          source && reference
            ? `Манай тал: ${source.sheetName}  ·  Цаанаас ирсэн: ${reference.sheetName}${
                source.id === reference.id ? '  (нэг хуудасны 2 багана)' : ''
              }`
            : 'Excel харьцуулалт'
        }
        theme={s.theme}
        onTheme={s.setTheme}
        onFiles={(f) => void s.loadFiles(f)}
        onExport={() => void handleExport('compact')}
          onExportFull={() => void handleExport('full')}
          exportCount={exportableCount}
        onOpenSettings={s.openSettings}
        onNewFile={() => setConfirmNew(true)}
        onUndo={s.undo}
        onRedo={s.redo}
        canUndo={s.undoStack.length > 0}
        canRedo={s.redoStack.length > 0}
        canExport={!!s.results && !!source && !!reference}
        hasFilters={hasFilters}
        onClearFilters={s.clearFilters}
        onlyDuplicates={s.filters.onlyDuplicates}
        refMissingActive={s.filters.devcRef.has('missing')}
        refMissingCount={s.results?.devcRef?.missing ?? 0}
        onToggleRefMissing={() => summaryFilter('devcRef', 'missing')}
        onToggleDuplicates={() => {
          s.setActiveTab('source');
          s.toggleOnlyDuplicates();
        }}
        frozenColumns={s.frozenColumns}
        onFrozenColumns={s.setFrozenColumns}
        stale={s.stale}
        onRecompare={() => void s.runComparison()}
        search={s.search}
        onSearch={s.setSearch}
        hitCount={hits.length}
        activeIndex={hits.length ? s.searchIndex % hits.length : 0}
        onNextHit={nextHit}
        onPrevHit={prevHit}
        searching={searching}
        searchDisabled={tab === 'duplicates'}
        userEmail={userEmail}
        onSignOut={() => void supabase.auth.signOut()}
        onSave={() => setSaveOpen(true)}
        onHistory={() => setHistoryOpen(true)}
        canSave={!!s.results && !!source}
      />

      <SummaryBar
        results={s.results}
        sourceLabel={source ? `${source.fileName} · ${source.sheetName}` : ''}
        referenceLabel={reference ? `${reference.fileName} · ${reference.sheetName}` : ''}
        onFilter={summaryFilter}
        onShowDuplicates={() => s.setActiveTab('duplicates')}
      />

      {hiddenHits > 0 && !searching && (
        <div
          className="flex flex-none items-center gap-2 border-b px-3 py-1.5 text-[12px]"
          style={{
            background: 'var(--dup-bg)',
            borderColor: 'var(--grid-line)',
            color: 'var(--dup-text)',
          }}
        >
          <AlertTriangle size={14} className="flex-none" />
          <span>
            «{s.search}» — идэвхтэй шүүлтэд олдсонгүй, гэхдээ шүүлтээс гадна{' '}
            <b className="tabular-nums">{num(hiddenHits)}</b> нүдэнд байна.
          </span>
          <button
            className="ec-btn ml-1 h-6"
            onClick={() => s.clearFilters()}
            title="Шүүлтийг арилгаад бүх мөрөөс хайна"
          >
            Шүүлт арилгах
          </button>
        </div>
      )}

      {tab !== 'duplicates' && (
        <FormulaBar
          column={selectedColumn}
          dataRow={selectedDataRow}
          colIndex={s.selection?.col ?? 0}
          value={formulaValue}
          editable={selectedColumn?.kind === 'data'}
          onCommit={(value) => {
            if (!gridDataset || !selectedColumn || selectedDataRow === null) return;
            if (selectedColumn.kind !== 'data') return;
            const prev = cellRaw(gridDataset, gridOverrides, selectedDataRow, selectedColumn.dataIndex);
            s.applyEdits([
              {
                datasetId: gridDataset.id,
                row: selectedDataRow,
                col: selectedColumn.dataIndex,
                prev,
                next: value === '' ? null : value,
              },
            ]);
          }}
        />
      )}

      {tab === 'duplicates' ? (
        <DuplicatePanel
          results={s.results}
          onSearchValue={(v) => {
            s.setActiveTab('source');
            s.setSearch(v);
          }}
        />
      ) : gridDataset ? (
        <Spreadsheet
          key={`${tab}:${gridDataset.id}`}
          datasetId={gridDataset.id}
          dataset={gridDataset}
          columns={columns}
          visibleRows={visibleRows}
          results={gridResults}
          overrides={gridOverrides}
          editable
          frozenColumns={s.frozenColumns}
          selection={s.selection}
          onSelectionChange={s.setSelection}
          searchQuery={s.search}
          searchHits={hits}
          activeHit={activeHit}
          flashRow={tab === 'reference' ? flashRow : null}
          onEdits={s.applyEdits}
          onResizeColumn={(id, width) => setWidths((w) => ({ ...w, [`${tab}:${id}`]: width }))}
          onStatusClick={onStatusClick}
          onOpenFilter={(kind, rect) => setFilterMenu({ kind, rect })}
          onSearchValue={(v) => s.setSearch(v)}
          onFilterByValue={filterByValue}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Хуудас сонгогдоогүй байна.
        </div>
      )}

      {/* ---- bottom sheet tabs ---- */}
      <div
        className="flex h-8 flex-none items-center gap-0.5 border-t px-2"
        style={{ background: 'var(--bg-chrome)', borderColor: 'var(--grid-line)' }}
      >
        <SheetTabButton
          active={tab === 'source'}
          onClick={() => s.setActiveTab('source')}
          icon={<Table2 size={13} />}
          label={`МАНАЙ ТАЛ${source ? ` · ${source.sheetName}` : ''}`}
          accent="var(--found-text)"
        />
        <SheetTabButton
          active={tab === 'reference'}
          onClick={() => s.setActiveTab('reference')}
          icon={<Database size={13} />}
          label={`ЦААНААС ИРСЭН${reference ? ` · ${reference.sheetName}` : ''}`}
          accent="var(--accent)"
          disabled={!reference}
        />
        <SheetTabButton
          active={tab === 'duplicates'}
          onClick={() => s.setActiveTab('duplicates')}
          icon={<Copy size={13} />}
          label="ДАВХАРДАЛ"
          accent="var(--dup-text)"
          disabled={!s.results}
        />

        <div className="ml-auto flex items-center gap-3 pr-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span className="hidden items-center gap-1 md:flex">
            <Lock size={11} /> Браузер дотор боловсруулагдана
          </span>
          {s.results && <span>{ms(s.results.durationMs)}</span>}
          <span className="tabular-nums">
            {num(visibleRows.length)} / {num(gridDataset?.rowCount ?? 0)} мөр
            {hasFilters && tab === 'source' && ' (шүүсэн)'}
          </span>
        </div>
      </div>

      {/* ---- overlays ---- */}
      {popover && source && s.results && (
        <ResultPopover
          target={popover}
          source={source}
          reference={reference}
          config={s.config}
          results={s.results}
          sourceOverrides={s.overrides[source.id]}
          onClose={() => setPopover(null)}
          onGoToReference={goToReference}
        />
      )}

      {filterMenu && (
        <FilterMenu
          target={filterMenu}
          value={s.filters[filterMenu.kind]}
          counts={filterCounts}
          onChange={(keys) => s.setFilter(filterMenu.kind, keys)}
          onClose={() => setFilterMenu(null)}
        />
      )}

      {importModal}
      {settingsModal}
      {historyModal}
      {saveModal}
      {busy && <ProgressOverlay busy={busy} />}
      {s.error && <ErrorToast message={s.error} onClose={() => s.setError(null)} />}
      {s.notice && <NoticeToast message={s.notice} onClose={() => s.setNotice(null)} />}

      {confirmNew && (
        <Modal
          title="Шинэ файл эхлүүлэх"
          onClose={() => setConfirmNew(false)}
          width={420}
          footer={
            <>
              <button className="ec-btn ec-btn-outline" onClick={() => setConfirmNew(false)}>
                Цуцлах
              </button>
              <button
                className="ec-btn ec-btn-primary"
                onClick={() => {
                  setConfirmNew(false);
                  setHits([]);
                  setWidths({});
                  s.reset();
                }}
              >
                Шинэ файл
              </button>
            </>
          }
        >
          <p className="text-[13px]" style={{ color: 'var(--text)' }}>
            Одоогийн харьцуулалтыг хааж шинэ файл эхлүүлэх үү?
          </p>
          <p className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
            Ачаалсан өгөгдөл санах ойгоос цэвэрлэгдэнэ.
          </p>
        </Modal>
      )}

      {dragging && (
        <div
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: 'rgba(26,115,232,0.12)' }}
        >
          <div className="ec-panel px-6 py-4 text-[14px]" style={{ color: 'var(--text)' }}>
            Excel файлаа энд тавина уу
          </div>
        </div>
      )}
    </div>
  );
}

function SheetTabButton({
  active,
  onClick,
  icon,
  label,
  accent,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  accent: string;
  disabled?: boolean;
}) {
  return (
    <button
      className="flex h-7 items-center gap-1.5 rounded-t px-3 text-[12px] disabled:opacity-40"
      style={{
        background: active ? 'var(--bg)' : 'transparent',
        color: active ? accent : 'var(--text-muted)',
        borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
        fontWeight: active ? 600 : 400,
      }}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      <span className="max-w-[220px] truncate">{label}</span>
    </button>
  );
}

function ErrorToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className="ec-panel ec-fade-in fixed bottom-12 left-1/2 z-50 flex max-w-[560px] -translate-x-1/2 items-start gap-2 px-4 py-3"
      style={{ background: 'var(--missing-bg)', borderColor: 'var(--missing-text)' }}
    >
      <AlertTriangle size={16} style={{ color: 'var(--missing-text)' }} className="mt-0.5 flex-none" />
      <span className="text-[13px]" style={{ color: 'var(--missing-text)' }}>
        {message}
      </span>
      <button className="ec-btn h-5 px-1" onClick={onClose}>
        <X size={13} />
      </button>
    </div>
  );
}

function NoticeToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className="ec-panel ec-fade-in fixed bottom-12 left-1/2 z-50 flex max-w-[560px] -translate-x-1/2 items-center gap-2 px-4 py-2.5"
      style={{ background: 'var(--found-bg)', borderColor: 'var(--found-text)' }}
    >
      <span className="text-[13px]" style={{ color: 'var(--found-text)' }}>
        {message}
      </span>
      <button className="ec-btn h-5 px-1" onClick={onClose}>
        <X size={13} />
      </button>
    </div>
  );
}

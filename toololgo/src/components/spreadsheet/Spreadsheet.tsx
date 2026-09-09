import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Filter } from 'lucide-react';
import type { CellValue, ComparisonResults, Dataset, FilterKind, GridColumn } from '../../types';
import {
  HEADER_HEIGHT,
  LETTER_ROW_HEIGHT,
  ROW_HEIGHT,
  ROW_NUMBER_WIDTH,
  cellRaw,
  cellText,
  rowStatusClass,
  statusInfo,
  type SearchHit,
} from '../../lib/grid';
import { columnLetter } from '../../lib/columns';
import { displayValue } from '../../lib/normalize';
import type { CellEdit, Selection } from '../../stores/appStore';
import { ContextMenu, type ContextMenuState } from './ContextMenu';

export interface SpreadsheetProps {
  datasetId: string;
  dataset: Dataset;
  columns: GridColumn[];
  visibleRows: Int32Array;
  results: ComparisonResults | null;
  overrides?: Map<string, CellValue>;
  editable: boolean;
  frozenColumns: number;
  selection: Selection | null;
  onSelectionChange: (s: Selection | null) => void;
  searchQuery: string;
  searchHits: SearchHit[];
  activeHit: SearchHit | null;
  flashRow: number | null;
  onEdits: (edits: CellEdit[]) => void;
  onResizeColumn: (id: string, width: number) => void;
  onStatusClick: (row: number, kind: 'serial' | 'devc', rect: DOMRect) => void;
  onOpenFilter: (kind: FilterKind, rect: DOMRect) => void;
  onSearchValue: (value: string) => void;
  onFilterByValue: (row: number, kind: 'serial' | 'devc') => void;
}

const EMPTY_SELECTION: Selection = { row: 0, col: 0, anchorRow: 0, anchorCol: 0 };

export function Spreadsheet(props: SpreadsheetProps) {
  const {
    datasetId,
    dataset,
    columns,
    visibleRows,
    results,
    overrides,
    editable,
    frozenColumns,
    selection,
    onSelectionChange,
    searchHits,
    activeHit,
    flashRow,
    onEdits,
    onResizeColumn,
    onStatusClick,
    onOpenFilter,
    onSearchValue,
    onFilterByValue,
  } = props;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<{ row: number; col: number; value: string } | null>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const draggingRef = useRef(false);
  const resizeRef = useRef<{ id: string; startX: number; startWidth: number } | null>(null);

  const frozen = Math.max(0, Math.min(frozenColumns, columns.length));
  const frozenWidth = useMemo(
    () => columns.slice(0, frozen).reduce((a, c) => a + c.width, 0),
    [columns, frozen],
  );
  const stickyWidth = ROW_NUMBER_WIDTH + frozenWidth;

  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 14,
  });

  const colVirtualizer = useVirtualizer({
    horizontal: true,
    count: Math.max(0, columns.length - frozen),
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => columns[i + frozen]?.width ?? 140,
    overscan: 4,
  });

  useLayoutEffect(() => {
    colVirtualizer.measure();
  }, [columns, frozen, colVirtualizer]);

  const totalWidth = stickyWidth + colVirtualizer.getTotalSize();
  const totalHeight = rowVirtualizer.getTotalSize();

  const hitSet = useMemo(() => {
    if (!searchHits.length) return null;
    const s = new Set<number>();
    for (const h of searchHits) s.add(h.rowIndex * 4096 + h.col);
    return s;
  }, [searchHits]);

  const sel = selection ?? null;
  const range = useMemo(() => {
    if (!sel) return null;
    return {
      r0: Math.min(sel.row, sel.anchorRow),
      r1: Math.max(sel.row, sel.anchorRow),
      c0: Math.min(sel.col, sel.anchorCol),
      c1: Math.max(sel.col, sel.anchorCol),
    };
  }, [sel]);

  // ---- scrolling helpers --------------------------------------------------
  const scrollToCell = useCallback(
    (row: number, col: number) => {
      rowVirtualizer.scrollToIndex(row, { align: 'auto' });
      if (col >= frozen) colVirtualizer.scrollToIndex(col - frozen, { align: 'auto' });
      else scrollRef.current?.scrollTo({ left: 0 });
    },
    [rowVirtualizer, colVirtualizer, frozen],
  );

  useEffect(() => {
    if (activeHit) scrollToCell(activeHit.rowIndex, activeHit.col);
  }, [activeHit, scrollToCell]);

  useEffect(() => {
    if (flashRow === null) return;
    const idx = indexOfRow(visibleRows, flashRow);
    if (idx >= 0) {
      rowVirtualizer.scrollToIndex(Math.max(0, idx - 4), { align: 'start' });
      onSelectionChange({ row: idx, col: 0, anchorRow: idx, anchorCol: 0 });
      scrollRef.current?.focus();
    }
  }, [flashRow]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- editing ------------------------------------------------------------
  const commitEdit = useCallback(
    (row: number, col: number, raw: string) => {
      const column = columns[col];
      if (!column || column.kind !== 'data') return;
      const dataRow = visibleRows[row];
      const prev = cellRaw(dataset, overrides, dataRow, column.dataIndex);
      const next: CellValue = raw === '' ? null : raw;
      if (displayValue(prev) === raw) return;
      onEdits([{ datasetId, row: dataRow, col: column.dataIndex, prev, next }]);
    },
    [columns, visibleRows, dataset, overrides, onEdits, datasetId],
  );

  const startEditing = useCallback(
    (row: number, col: number, initial?: string) => {
      if (!editable) return;
      const column = columns[col];
      if (!column || column.kind !== 'data') return;
      const dataRow = visibleRows[row];
      const current = displayValue(cellRaw(dataset, overrides, dataRow, column.dataIndex));
      setEditing({ row, col, value: initial ?? current });
    },
    [columns, dataset, editable, overrides, visibleRows],
  );

  const stopEditing = useCallback(
    (commit: boolean) => {
      setEditing((cur) => {
        if (cur && commit) commitEdit(cur.row, cur.col, cur.value);
        return null;
      });
    },
    [commitEdit],
  );

  // ---- selection ----------------------------------------------------------
  const moveSelection = useCallback(
    (dr: number, dc: number, extend: boolean) => {
      const base = sel ?? EMPTY_SELECTION;
      const row = clamp(base.row + dr, 0, visibleRows.length - 1);
      const col = clamp(base.col + dc, 0, columns.length - 1);
      onSelectionChange({
        row,
        col,
        anchorRow: extend ? base.anchorRow : row,
        anchorCol: extend ? base.anchorCol : col,
      });
      scrollToCell(row, col);
    },
    [sel, visibleRows.length, columns.length, onSelectionChange, scrollToCell],
  );

  const selectCell = useCallback(
    (row: number, col: number, extend: boolean) => {
      const base = sel ?? EMPTY_SELECTION;
      onSelectionChange({
        row,
        col,
        anchorRow: extend ? base.anchorRow : row,
        anchorCol: extend ? base.anchorCol : col,
      });
    },
    [sel, onSelectionChange],
  );

  const selectRow = useCallback(
    (row: number, extend: boolean) => {
      const base = sel ?? EMPTY_SELECTION;
      onSelectionChange({
        row,
        col: columns.length - 1,
        anchorRow: extend ? base.anchorRow : row,
        anchorCol: 0,
      });
    },
    [sel, columns.length, onSelectionChange],
  );

  // ---- keyboard -----------------------------------------------------------
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (editing) {
      if (e.key === 'Enter') {
        e.preventDefault();
        stopEditing(true);
        moveSelection(1, 0, false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        stopEditing(false);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        stopEditing(true);
        moveSelection(0, e.shiftKey ? -1 : 1, false);
      }
      return;
    }

    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V')) return; // native copy/paste events
    if (mod && (e.key === 'z' || e.key === 'y' || e.key === 'Z' || e.key === 'Y')) return; // handled globally

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveSelection(1, 0, e.shiftKey);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveSelection(-1, 0, e.shiftKey);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        moveSelection(0, -1, e.shiftKey);
        break;
      case 'ArrowRight':
        e.preventDefault();
        moveSelection(0, 1, e.shiftKey);
        break;
      case 'Enter':
        e.preventDefault();
        if (sel && editable && columns[sel.col]?.kind === 'data') startEditing(sel.row, sel.col);
        else moveSelection(1, 0, false);
        break;
      case 'F2':
        e.preventDefault();
        if (sel) startEditing(sel.row, sel.col);
        break;
      case 'Tab':
        e.preventDefault();
        moveSelection(0, e.shiftKey ? -1 : 1, false);
        break;
      case 'Home':
        e.preventDefault();
        if (mod) {
          onSelectionChange({ row: 0, col: 0, anchorRow: 0, anchorCol: 0 });
          scrollToCell(0, 0);
        } else moveSelection(0, -columns.length, e.shiftKey);
        break;
      case 'End':
        e.preventDefault();
        if (mod) {
          const r = visibleRows.length - 1;
          onSelectionChange({ row: r, col: 0, anchorRow: r, anchorCol: 0 });
          scrollToCell(r, 0);
        } else moveSelection(0, columns.length, e.shiftKey);
        break;
      case 'PageDown':
        e.preventDefault();
        moveSelection(pageSize(scrollRef.current), 0, e.shiftKey);
        break;
      case 'PageUp':
        e.preventDefault();
        moveSelection(-pageSize(scrollRef.current), 0, e.shiftKey);
        break;
      case 'Delete':
      case 'Backspace': {
        if (!editable || !range) break;
        e.preventDefault();
        const edits: CellEdit[] = [];
        for (let r = range.r0; r <= range.r1; r++) {
          for (let c = range.c0; c <= range.c1; c++) {
            const column = columns[c];
            if (!column || column.kind !== 'data') continue;
            const dataRow = visibleRows[r];
            const prev = cellRaw(dataset, overrides, dataRow, column.dataIndex);
            if (prev === null) continue;
            edits.push({ datasetId, row: dataRow, col: column.dataIndex, prev, next: null });
          }
        }
        onEdits(edits);
        break;
      }
      default:
        if (
          editable &&
          sel &&
          e.key.length === 1 &&
          !mod &&
          !e.altKey &&
          columns[sel.col]?.kind === 'data'
        ) {
          e.preventDefault();
          startEditing(sel.row, sel.col, e.key);
        }
    }
  };

  // ---- clipboard ----------------------------------------------------------
  const onCopy = (e: ReactClipboardEvent<HTMLDivElement>) => {
    if (!range || editing) return;
    const lines: string[] = [];
    for (let r = range.r0; r <= range.r1; r++) {
      const cells: string[] = [];
      for (let c = range.c0; c <= range.c1; c++) {
        cells.push(cellText(columns[c], visibleRows[r], dataset, overrides, results));
      }
      lines.push(cells.join('\t'));
    }
    e.clipboardData.setData('text/plain', lines.join('\n'));
    e.preventDefault();
  };

  const onPaste = (e: ReactClipboardEvent<HTMLDivElement>) => {
    if (!editable || !sel || editing) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    const grid = text.replace(/\r\n?/g, '\n').split('\n');
    if (grid.length && grid[grid.length - 1] === '') grid.pop();
    const edits: CellEdit[] = [];
    for (let r = 0; r < grid.length; r++) {
      const targetRow = sel.row + r;
      if (targetRow >= visibleRows.length) break;
      const cells = grid[r].split('\t');
      for (let c = 0; c < cells.length; c++) {
        const column = columns[sel.col + c];
        if (!column || column.kind !== 'data') continue;
        const dataRow = visibleRows[targetRow];
        const prev = cellRaw(dataset, overrides, dataRow, column.dataIndex);
        const next: CellValue = cells[c] === '' ? null : cells[c];
        if (displayValue(prev) === cells[c]) continue;
        edits.push({ datasetId, row: dataRow, col: column.dataIndex, prev, next });
      }
    }
    onEdits(edits);
  };

  // ---- column resize ------------------------------------------------------
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      const width = Math.max(56, Math.round(r.startWidth + (e.clientX - r.startX)));
      onResizeColumn(r.id, width);
    };
    const onUp = () => {
      if (resizeRef.current) {
        resizeRef.current = null;
        document.body.style.cursor = '';
      }
      draggingRef.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onResizeColumn]);

  // ---- rendering ----------------------------------------------------------
  const virtualCols = colVirtualizer.getVirtualItems();

  const renderHeaderCell = (col: GridColumn, index: number, left: number, sticky: boolean) => {
    const filterKind: FilterKind | null =
      col.kind === 'serialStatus'
        ? 'serial'
        : col.kind === 'devcStatus'
          ? 'devc'
          : col.kind === 'serialRefStatus'
            ? 'serialRef'
            : col.kind === 'devcRefStatus'
              ? 'devcRef'
              : null;
    const isStatus = filterKind !== null;
    const active = sel && sel.col === index;
    const style: CSSProperties = sticky
      ? { position: 'relative', width: col.width, flex: 'none', height: '100%' }
      : { left, width: col.width };
    return (
      <div
        key={col.id}
        className="ec-head-cell"
        style={{ ...style, background: active ? 'var(--accent-chip)' : undefined }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          const target = e.target as HTMLElement;
          if (target.dataset.resizer) return;
          selectCell(0, index, false);
          onSelectionChange({
            row: visibleRows.length - 1,
            col: index,
            anchorRow: 0,
            anchorCol: index,
          });
        }}
        title={col.label}
      >
        <span className="truncate" style={{ color: 'var(--text)' }}>
          {col.label}
        </span>
        {col.sublabel && (
          <span className="truncate text-[10px]" style={{ color: 'var(--text-faint)' }}>
            {col.sublabel}
          </span>
        )}
        {isStatus && (
          <button
            className="ml-auto flex h-5 w-5 flex-none items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10"
            title="Шүүх"
            onClick={(e) => {
              e.stopPropagation();
              onOpenFilter(filterKind!, (e.currentTarget as HTMLElement).getBoundingClientRect());
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Filter size={11} />
          </button>
        )}
        <div
          data-resizer="1"
          className="absolute right-0 top-0 h-full w-[5px] cursor-col-resize hover:bg-[var(--accent)]"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            resizeRef.current = { id: col.id, startX: e.clientX, startWidth: col.width };
            document.body.style.cursor = 'col-resize';
          }}
        />
      </div>
    );
  };

  const renderLetterCell = (col: GridColumn, index: number, left: number, sticky: boolean) => {
    const active = sel && sel.col === index;
    const style: CSSProperties = sticky
      ? { position: 'relative', width: col.width, flex: 'none', height: '100%' }
      : { left, width: col.width, height: '100%' };
    return (
      <div
        key={`L${col.id}`}
        className="ec-head-cell justify-center text-[10px] font-normal"
        style={{
          ...style,
          height: LETTER_ROW_HEIGHT,
          borderBottom: '1px solid var(--grid-line)',
          background: active ? 'var(--accent-chip)' : 'var(--bg-chrome-2)',
          color: active ? 'var(--accent)' : 'var(--text-faint)',
        }}
      >
        {columnLetter(index)}
      </div>
    );
  };

  const renderCell = (
    col: GridColumn,
    colIndex: number,
    rowIndex: number,
    dataRow: number,
    left: number,
    sticky: boolean,
  ) => {
    const inRange =
      range &&
      rowIndex >= range.r0 &&
      rowIndex <= range.r1 &&
      colIndex >= range.c0 &&
      colIndex <= range.c1;
    const isFocus = sel && sel.row === rowIndex && sel.col === colIndex;
    const isEditing = editing && editing.row === rowIndex && editing.col === colIndex;

    let text = '';
    let extraClass = '';
    let clickable = false;

    if (col.kind === 'data') {
      text = displayValue(cellRaw(dataset, overrides, dataRow, col.dataIndex));
    } else if (col.kind === 'serialStatus' || col.kind === 'devcStatus') {
      const info = statusInfo(
        col.kind === 'serialStatus' ? (results?.serial ?? null) : (results?.devc ?? null),
        dataRow,
      );
      text = info?.label ?? '';
      extraClass = info?.className ?? '';
      clickable = true;
    } else if (col.kind === 'serialRefStatus' || col.kind === 'devcRefStatus') {
      const info = statusInfo(
        col.kind === 'serialRefStatus' ? (results?.serialRef ?? null) : (results?.devcRef ?? null),
        dataRow,
      );
      text = info?.label ?? '';
      extraClass = info?.className ?? '';
    } else {
      text = cellText(col, dataRow, dataset, overrides, results);
      extraClass = 'justify-end';
      clickable = text !== '' && text !== '—';
    }

    const isHit = hitSet?.has(rowIndex * 4096 + colIndex) ?? false;
    const isActiveHit = activeHit && activeHit.rowIndex === rowIndex && activeHit.col === colIndex;

    const style: CSSProperties = sticky
      ? { position: 'relative', width: col.width, flex: 'none', height: '100%' }
      : { left, width: col.width };

    if (inRange && !isFocus) style.background = 'var(--accent-soft)';
    if (isFocus) {
      style.outline = '2px solid var(--accent)';
      style.outlineOffset = '-2px';
      style.zIndex = 3;
    }

    return (
      <div
        key={col.id}
        className={`ec-cell ${extraClass} ${
          isActiveHit ? 'ec-search-active' : isHit ? 'ec-search-hit' : ''
        } ${clickable ? 'cursor-pointer' : ''}`}
        style={style}
        onMouseDown={(e) => {
          if (e.button === 2) return;
          e.preventDefault();
          scrollRef.current?.focus();
          if (editing) stopEditing(true);
          draggingRef.current = true;
          selectCell(rowIndex, colIndex, e.shiftKey);
        }}
        onMouseEnter={(e) => {
          if (draggingRef.current && e.buttons === 1) selectCell(rowIndex, colIndex, true);
        }}
        onDoubleClick={(e) => {
          if (col.kind === 'data') startEditing(rowIndex, colIndex);
          else if (clickable && (col.kind === 'serialStatus' || col.kind === 'devcStatus'))
            onStatusClick(
              dataRow,
              col.kind === 'serialStatus' ? 'serial' : 'devc',
              (e.currentTarget as HTMLElement).getBoundingClientRect(),
            );
        }}
        onClick={(e) => {
          if (col.kind === 'serialStatus' || col.kind === 'devcStatus') {
            onStatusClick(
              dataRow,
              col.kind === 'serialStatus' ? 'serial' : 'devc',
              (e.currentTarget as HTMLElement).getBoundingClientRect(),
            );
          } else if (col.kind === 'refRowSerial' || col.kind === 'refRowDevc') {
            if (clickable)
              onStatusClick(
                dataRow,
                col.kind === 'refRowSerial' ? 'serial' : 'devc',
                (e.currentTarget as HTMLElement).getBoundingClientRect(),
              );
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          selectCell(rowIndex, colIndex, false);
          setMenu({ x: e.clientX, y: e.clientY, rowIndex, colIndex, dataRow });
        }}
        title={text.length > 18 ? text : undefined}
      >
        {isEditing ? (
          <input
            autoFocus
            className="h-full w-full border-none bg-[var(--bg)] p-0 text-[13px] outline-none"
            value={editing.value}
            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
            onBlur={() => stopEditing(true)}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate">
            {text ||
              (col.kind === 'data' ? '' : <span style={{ color: 'var(--text-faint)' }}>—</span>)}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        tabIndex={0}
        className="ec-scroll h-full w-full overflow-auto outline-none"
        style={{ background: 'var(--bg)' }}
        onKeyDown={onKeyDown}
        onCopy={onCopy}
        onPaste={onPaste}
        onMouseDown={() => setMenu(null)}
      >
        <div style={{ width: totalWidth, position: 'relative' }}>
          {/* ---- sticky header ---- */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 5,
              height: HEADER_HEIGHT,
              width: totalWidth,
            }}
          >
            {/* column letters */}
            <div style={{ position: 'relative', height: LETTER_ROW_HEIGHT, width: totalWidth }}>
              <div
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  display: 'flex',
                  width: stickyWidth,
                  height: LETTER_ROW_HEIGHT,
                }}
              >
                <div
                  className="ec-head-cell"
                  style={{
                    position: 'relative',
                    width: ROW_NUMBER_WIDTH,
                    height: LETTER_ROW_HEIGHT,
                    flex: 'none',
                    background: 'var(--bg-chrome-2)',
                  }}
                />
                {columns.slice(0, frozen).map((c, i) => renderLetterCell(c, i, 0, true))}
              </div>
              {virtualCols.map((v) =>
                renderLetterCell(
                  columns[v.index + frozen],
                  v.index + frozen,
                  stickyWidth + v.start,
                  false,
                ),
              )}
            </div>
            {/* header names */}
            <div style={{ position: 'relative', height: HEADER_HEIGHT - LETTER_ROW_HEIGHT }}>
              <div
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  display: 'flex',
                  width: stickyWidth,
                  height: '100%',
                }}
              >
                <div
                  className="ec-head-cell items-center justify-center"
                  style={{ position: 'relative', width: ROW_NUMBER_WIDTH, flex: 'none' }}
                >
                  <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                    {visibleRows.length.toLocaleString()}
                  </span>
                </div>
                {columns.slice(0, frozen).map((c, i) => renderHeaderCell(c, i, 0, true))}
              </div>
              {virtualCols.map((v) =>
                renderHeaderCell(
                  columns[v.index + frozen],
                  v.index + frozen,
                  stickyWidth + v.start,
                  false,
                ),
              )}
            </div>
          </div>

          {/* ---- rows ---- */}
          <div style={{ position: 'relative', height: totalHeight, width: totalWidth }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const rowIndex = virtualRow.index;
              const dataRow = visibleRows[rowIndex];
              const activeRow = sel && sel.row === rowIndex;
              const isFlash = flashRow !== null && dataRow === flashRow;
              const rowClass = rowStatusClass(results, dataRow);
              return (
                <div
                  key={rowIndex}
                  className={`${rowClass}${isFlash ? ' ec-flash' : ''}` || undefined}
                  style={{
                    position: 'absolute',
                    top: virtualRow.start,
                    left: 0,
                    height: ROW_HEIGHT,
                    width: totalWidth,
                  }}
                >
                  <div
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      display: 'flex',
                      width: stickyWidth,
                      height: '100%',
                    }}
                  >
                    <div
                      className="ec-cell justify-center text-[11px] cursor-pointer select-none"
                      style={{
                        position: 'relative',
                        width: ROW_NUMBER_WIDTH,
                        flex: 'none',
                        background: activeRow ? 'var(--accent-chip)' : 'var(--bg-chrome)',
                        color: activeRow ? 'var(--accent)' : 'var(--text-muted)',
                        borderRight: '1px solid var(--grid-line-strong)',
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        scrollRef.current?.focus();
                        selectRow(rowIndex, e.shiftKey);
                      }}
                      title={`Мөр ${dataRow + 1}`}
                    >
                      {dataRow + 1}
                    </div>
                    {columns
                      .slice(0, frozen)
                      .map((c, i) => renderCell(c, i, rowIndex, dataRow, 0, true))}
                  </div>
                  {virtualCols.map((v) =>
                    renderCell(
                      columns[v.index + frozen],
                      v.index + frozen,
                      rowIndex,
                      dataRow,
                      stickyWidth + v.start,
                      false,
                    ),
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {visibleRows.length === 0 && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{ paddingTop: HEADER_HEIGHT }}
        >
          <div className="text-center" style={{ color: 'var(--text-muted)' }}>
            <div className="text-sm font-medium">Шүүлтэд тохирох мөр алга</div>
            <div className="mt-1 text-xs">Шүүлтүүрээ өөрчилнө үү.</div>
          </div>
        </div>
      )}

      {menu && (
        <ContextMenu
          state={menu}
          column={columns[menu.colIndex]}
          hasSelection={!!range}
          editable={editable}
          valueText={cellText(
            columns[menu.colIndex],
            menu.dataRow,
            dataset,
            overrides,
            results,
          )}
          onClose={() => setMenu(null)}
          onCopy={() => {
            const text = cellText(columns[menu.colIndex], menu.dataRow, dataset, overrides, results);
            void navigator.clipboard?.writeText(text).catch(() => undefined);
          }}
          onEdit={() => startEditing(menu.rowIndex, menu.colIndex)}
          onSearchValue={onSearchValue}
          onFilterSerial={() => onFilterByValue(menu.dataRow, 'serial')}
          onFilterDevc={() => onFilterByValue(menu.dataRow, 'devc')}
          onShowDetail={(kind) => {
            onStatusClick(menu.dataRow, kind, new DOMRect(menu.x, menu.y, 1, 1));
          }}
          hasSerial={!!results?.serial}
          hasDevc={!!results?.devc}
        />
      )}
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

function pageSize(el: HTMLElement | null) {
  if (!el) return 20;
  return Math.max(1, Math.floor((el.clientHeight - HEADER_HEIGHT) / ROW_HEIGHT) - 1);
}

function indexOfRow(visibleRows: Int32Array, dataRow: number): number {
  for (let i = 0; i < visibleRows.length; i++) if (visibleRows[i] === dataRow) return i;
  return -1;
}


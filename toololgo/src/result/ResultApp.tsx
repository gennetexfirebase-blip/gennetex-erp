import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { ExcelUploader } from './components/ExcelUploader';
import { SummaryCards } from './components/SummaryCards';
import { FilterBar, type StatusFilter } from './components/FilterBar';
import { ResultTable } from './components/ResultTable';
import { Pagination, type PageSize } from './components/Pagination';
import { ExportButton } from './components/ExportButton';
import {
  FILTER_COLUMNS,
  MISSING,
  normalize,
  orderColumns,
  PRESENT,
  type Row,
  STATUS_COL,
  statusOf,
} from './lib';

const SEARCH_COLUMNS = ['DEVC_NO', 'STAFF_ID', 'MODEL_NAME', 'MODEL_SKU'];

export default function ResultApp() {
  const [rows, setRows] = useState<Row[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default: БАЙХГҮЙ мөрүүдийг шууд харуулна.
  const [status, setStatus] = useState<StatusFilter>(MISSING);
  const [search, setSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(50);

  const loadFile = useCallback(async (file: File) => {
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setError('Зөвхөн .xlsx эсвэл .xls өргөтгөлтэй Excel файл дэмжинэ.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      // RESULT хуудсыг автоматаар сонгоно, байхгүй бол эхнийхийг.
      const sheet =
        wb.SheetNames.find((n) => n.trim().toUpperCase() === 'RESULT') ?? wb.SheetNames[0];
      if (!sheet) throw new Error('Файлд хуудас олдсонгүй.');
      const worksheet = wb.Sheets[sheet];

      // Эхний мөр = header.
      const allRows = XLSX.utils.sheet_to_json<Row>(worksheet, { defval: '', raw: false });
      if (!allRows.length) throw new Error(`"${sheet}" хуудас хоосон байна.`);

      const headerRow = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, range: 0 })[0];
      const headers = (headerRow ?? []).map((h) => String(h ?? '').trim()).filter(Boolean);
      const allColumns = headers.length ? headers : Object.keys(allRows[0]);

      if (!allColumns.includes(STATUS_COL)) {
        throw new Error(
          `"${STATUS_COL}" багана олдсонгүй. Тооллогын харьцуулалтын RESULT файлаа сонгоно уу.`,
        );
      }

      setRows(allRows);
      setColumns(orderColumns(allColumns));
      setFileName(file.name);
      setSheetName(sheet);
      setStatus(MISSING);
      setSearch('');
      setColumnFilters({});
      setPage(1);
    } catch (err) {
      setRows([]);
      setColumns([]);
      setFileName(null);
      setSheetName(null);
      setError(
        err instanceof Error
          ? `Excel файл уншиж чадсангүй: ${err.message}`
          : 'Excel файл уншиж чадсангүй. Файл эвдэрсэн эсвэл дэмжигдэхгүй хэлбэртэй байна.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- статусаар ялгасан бүлгүүд ----------------------------------------
  const missingRows = useMemo(() => rows.filter((row) => statusOf(row) === MISSING), [rows]);
  const presentRows = useMemo(() => rows.filter((row) => statusOf(row) === PRESENT), [rows]);

  // ---- шүүлт -------------------------------------------------------------
  const filtered = useMemo(() => {
    const base = status === 'all' ? rows : status === MISSING ? missingRows : presentRows;
    const q = normalize(search);
    const active = Object.entries(columnFilters).filter(([, v]) => v);
    if (!q && !active.length) return base;

    const searchable = SEARCH_COLUMNS.filter((c) => columns.includes(c));
    const searchCols = searchable.length ? searchable : columns;

    return base.filter((row) => {
      for (const [column, value] of active) {
        if (String(row[column] ?? '').trim() !== value) return false;
      }
      if (!q) return true;
      return searchCols.some((c) => normalize(row[c]).includes(q));
    });
  }, [rows, missingRows, presentRows, status, search, columnFilters, columns]);

  const perPage = pageSize === 'all' ? Math.max(filtered.length, 1) : pageSize;
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * perPage;
  const pageRows = useMemo(() => filtered.slice(start, start + perPage), [filtered, start, perPage]);

  const exportRows = status === PRESENT ? filtered : filtered.filter((r) => statusOf(r) === MISSING);

  const resetFilters = () => {
    setSearch('');
    setColumnFilters({});
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
            <FileSpreadsheet size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-tight">
              Тооллогын үр дүн — БАЙХГҮЙ шүүлт
            </h1>
            <p className="truncate text-xs text-slate-500">
              RESULT хуудасны «{STATUS_COL}» баганаас шууд шүүнэ
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {rows.length > 0 && (
              <>
                <ExportButton
                  rows={exportRows}
                  columns={columns}
                  fileName={`baihgui_${(fileName ?? 'result').replace(/\.(xlsx|xls)$/i, '')}.xlsx`}
                />
                <ExcelUploader
                  compact
                  onFile={loadFile}
                  loading={loading}
                  fileName={fileName}
                  sheetName={sheetName}
                />
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-5">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle size={18} className="mt-0.5 flex-none" />
            <span>{error}</span>
          </div>
        )}

        {rows.length === 0 ? (
          <ExcelUploader
            onFile={loadFile}
            loading={loading}
            fileName={fileName}
            sheetName={sheetName}
          />
        ) : (
          <>
            <SummaryCards
              total={rows.length}
              present={presentRows.length}
              missing={missingRows.length}
              filtered={filtered.length}
            />
            <FilterBar
              status={status}
              onStatus={(s) => {
                setStatus(s);
                setPage(1);
              }}
              search={search}
              onSearch={(v) => {
                setSearch(v);
                setPage(1);
              }}
              columnFilters={columnFilters}
              onColumnFilter={(column, value) => {
                setColumnFilters((f) => ({ ...f, [column]: value }));
                setPage(1);
              }}
              onReset={resetFilters}
              rows={rows}
              columns={columns.filter((c) => FILTER_COLUMNS.includes(c))}
              counts={{
                all: rows.length,
                present: presentRows.length,
                missing: missingRows.length,
              }}
            />
            <ResultTable rows={pageRows} columns={columns} startIndex={start} />
            <Pagination
              total={filtered.length}
              page={safePage}
              pageSize={pageSize}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          </>
        )}
      </main>
    </div>
  );
}

import { Search, X } from 'lucide-react';
import { FILTER_COLUMNS, MISSING, PRESENT, type Row, uniqueValues } from '../lib';

export type StatusFilter = 'all' | typeof MISSING | typeof PRESENT;

interface Props {
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  search: string;
  onSearch: (v: string) => void;
  columnFilters: Record<string, string>;
  onColumnFilter: (column: string, value: string) => void;
  onReset: () => void;
  rows: Row[];
  columns: string[];
  counts: { all: number; present: number; missing: number };
}

const TABS: { key: StatusFilter; label: string; active: string }[] = [
  { key: 'all', label: 'Бүгд', active: 'bg-slate-800 text-white' },
  { key: MISSING, label: 'БАЙХГҮЙ', active: 'bg-red-600 text-white' },
  { key: PRESENT, label: 'БАЙНА', active: 'bg-emerald-600 text-white' },
];

export function FilterBar({
  status,
  onStatus,
  search,
  onSearch,
  columnFilters,
  onColumnFilter,
  onReset,
  rows,
  columns,
  counts,
}: Props) {
  const count = (key: StatusFilter) =>
    key === 'all' ? counts.all : key === MISSING ? counts.missing : counts.present;
  const activeFilters = Object.values(columnFilters).filter(Boolean).length + (search ? 1 : 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg bg-slate-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => onStatus(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                status === t.key ? t.active : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-xs opacity-80 tabular-nums">
                {count(t.key).toLocaleString('mn-MN')}
              </span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="DEVC_NO, STAFF_ID, MODEL_NAME, MODEL_SKU... хайх"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-8 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          {search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => onSearch('')}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {activeFilters > 0 && (
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <X size={15} /> Шүүлт цэвэрлэх ({activeFilters})
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {FILTER_COLUMNS.filter((c) => columns.includes(c)).map((column) => {
          const options = uniqueValues(rows, column);
          return (
            <label key={column} className="block">
              <span className="mb-1 block truncate text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {column}
              </span>
              <select
                value={columnFilters[column] ?? ''}
                onChange={(e) => onColumnFilter(column, e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="">— бүгд —</option>
                {options.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
    </div>
  );
}

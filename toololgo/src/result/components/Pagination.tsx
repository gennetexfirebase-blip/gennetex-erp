import { ChevronLeft, ChevronRight } from 'lucide-react';

export type PageSize = 25 | 50 | 100 | 'all';

interface Props {
  total: number;
  page: number;
  pageSize: PageSize;
  onPage: (p: number) => void;
  onPageSize: (s: PageSize) => void;
}

const SIZES: PageSize[] = [25, 50, 100, 'all'];

export function Pagination({ total, page, pageSize, onPage, onPageSize }: Props) {
  const perPage = pageSize === 'all' ? Math.max(total, 1) : pageSize;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <span>Хуудсанд:</span>
        <select
          value={String(pageSize)}
          onChange={(e) => {
            const v = e.target.value;
            onPageSize(v === 'all' ? 'all' : (Number(v) as PageSize));
            onPage(1);
          }}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-blue-500"
        >
          {SIZES.map((s) => (
            <option key={String(s)} value={String(s)}>
              {s === 'all' ? 'Бүгд' : s}
            </option>
          ))}
        </select>
        <span className="tabular-nums">
          {from.toLocaleString('mn-MN')}–{to.toLocaleString('mn-MN')} /{' '}
          {total.toLocaleString('mn-MN')}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          className="rounded-lg border border-slate-300 p-1.5 text-slate-600 disabled:opacity-40"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="px-2 text-sm tabular-nums text-slate-600">
          {page} / {pageCount}
        </span>
        <button
          className="rounded-lg border border-slate-300 p-1.5 text-slate-600 disabled:opacity-40"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

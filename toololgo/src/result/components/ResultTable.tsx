import { MISSING, PRESENT, type Row, STATUS_COL, statusOf } from '../lib';

interface Props {
  rows: Row[];
  columns: string[];
  startIndex: number;
}

function StatusBadge({ value }: { value: string }) {
  const status = value.toUpperCase().startsWith(MISSING)
    ? MISSING
    : value.toUpperCase().startsWith(PRESENT)
      ? PRESENT
      : '';
  const cls =
    status === MISSING
      ? 'bg-red-100 text-red-700 ring-red-200'
      : status === PRESENT
        ? 'bg-emerald-100 text-emerald-700 ring-emerald-200'
        : 'bg-slate-100 text-slate-500 ring-slate-200';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ring-1 ${cls}`}>
      {value || '—'}
    </span>
  );
}

export function ResultTable({ rows, columns, startIndex }: Props) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-sm font-medium text-slate-700">Шүүлтэд тохирох мөр алга</p>
        <p className="mt-1 text-sm text-slate-500">Шүүлтүүрээ өөрчилж үзнэ үү.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="max-h-[62vh] overflow-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 border-b border-slate-200 bg-slate-50 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                №
              </th>
              {columns.map((c) => (
                <th
                  key={c}
                  className="whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const missing = statusOf(row) === MISSING;
              return (
                <tr
                  key={startIndex + i}
                  className={missing ? 'bg-red-50/70 hover:bg-red-50' : 'hover:bg-slate-50'}
                >
                  <td className="sticky left-0 z-10 border-b border-slate-100 bg-inherit px-3 py-1.5 text-right text-xs tabular-nums text-slate-400">
                    {startIndex + i + 1}
                  </td>
                  {columns.map((c) => {
                    const raw = String(row[c] ?? '').trim();
                    return (
                      <td
                        key={c}
                        className="whitespace-nowrap border-b border-slate-100 px-3 py-1.5 text-slate-700"
                      >
                        {c === STATUS_COL || c === 'DEVC ТООЛЛОГО' ? (
                          <StatusBadge value={raw} />
                        ) : raw === '' ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          raw
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

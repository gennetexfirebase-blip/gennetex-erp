import { useMemo, useState } from 'react';
import { Package, Download, RotateCw } from 'lucide-react';
import {
  PageHeader,
  Card,
  Button,
  Input,
  Select,
  Avatar,
  EmptyState,
  Loading,
  ErrorState,
  Badge,
} from '../components/ui';
import { fetchStockMovements, useAsync, type StockMovement } from '../lib/data';
import { downloadStockExcel } from '../lib/attendanceExport';

function fmt(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}:${p(d.getSeconds())}`;
}

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

/** Багаж/бараа олголт — хэн, хэнд, юуг, хэзээ (секунд хүртэл). */
export default function StockIssuesPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');

  const { data: rows, loading, error, reload } = useAsync<StockMovement[]>(
    () => fetchStockMovements(from, to),
    [from, to],
    []
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (kind !== 'all' && r.movement_type !== kind) return false;
        if (!query) return true;
        const hay = `${r.item_name || ''} ${r.user_name || ''} ${r.issued_by_name || ''}`.toLowerCase();
        return hay.includes(query.toLowerCase());
      }),
    [rows, kind, query]
  );

  return (
    <>
      <PageHeader
        title="Багаж, бараа олголт"
        crumb="Багаж, бараа олголт"
        actions={
          <>
            <Button variant="outline" icon={<RotateCw size={15} />} onClick={reload}>
              Шинэчлэх
            </Button>
            <Button
              variant="success"
              icon={<Download size={15} />}
              onClick={() => downloadStockExcel(from, to, filtered)}
              disabled={!filtered.length}
            >
              Excel татах
            </Button>
          </>
        }
      />

      <Card title="Олголтын түүх" icon={<Package size={17} />} bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
          <span className="text-[13px] text-subtle">—</span>
          <Input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className="w-auto" />
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">Бүх төрөл</option>
            <option value="withdraw">Олгосон</option>
            <option value="consume">Зарцуулсан</option>
          </Select>
          <Input
            placeholder="Бараа, ажилтан, олгосон хүнээр хайх"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-auto min-w-[220px] flex-1"
          />
        </div>

        {loading ? (
          <Loading />
        ) : error ? (
          <div className="p-5">
            <ErrorState text={error} onRetry={reload} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState text="Энэ хугацаанд олголт бүртгэгдээгүй байна." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase text-subtle">
                  <th className="px-4 py-3 font-semibold">Огноо / цаг</th>
                  <th className="px-4 py-3 font-semibold">Олгосон (админ)</th>
                  <th className="px-4 py-3 font-semibold">Хүлээн авсан</th>
                  <th className="px-4 py-3 font-semibold">Бараа / багаж</th>
                  <th className="px-4 py-3 font-semibold">Тоо</th>
                  <th className="px-4 py-3 font-semibold">Төрөл</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-line text-[13px] hover:bg-hover">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{fmt(r.created_at)}</td>
                    <td className="px-4 py-3">
                      {r.issued_by_name ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={r.issued_by_name} size={26} />
                          <span className="text-ink">{r.issued_by_name}</span>
                        </div>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={r.user_name} size={26} />
                        <span className="text-ink">{r.user_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink">{r.item_name}</td>
                    <td className="px-4 py-3 text-ink">
                      {r.quantity} {r.unit || ''}
                    </td>
                    <td className="px-4 py-3">
                      {r.movement_type === 'withdraw' ? (
                        <Badge tone="brand">Олгосон</Badge>
                      ) : r.movement_type === 'consume' ? (
                        <Badge tone="warning">Зарцуулсан</Badge>
                      ) : (
                        <Badge tone="neutral">{r.movement_type}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

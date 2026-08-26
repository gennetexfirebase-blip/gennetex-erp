import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader, Card, Loading, ErrorState, EmptyState } from '../components/ui';
import { fetchShiftsForMonth, useAsync } from '../lib/data';

type Shift = {
  id: string;
  user_id: string;
  user_name: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
};

/** Ээлжийн өнгө — эхлэх цагаар (§3.7). */
function shiftColor(start: string) {
  if (start?.startsWith('08')) return { bg: 'var(--success-soft)', fg: 'var(--success)' };
  if (start?.startsWith('09')) return { bg: 'var(--warning-soft)', fg: 'var(--warning)' };
  return { bg: 'var(--brand-soft)', fg: 'var(--brand)' };
}

export default function SchedulePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const { data: shifts, loading, error, reload } = useAsync<Shift[]>(
    () => fetchShiftsForMonth(year, month) as any,
    [year, month],
    []
  );

  const byDate = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    shifts.forEach((s) => {
      (map[s.shift_date] ||= []).push(s);
    });
    return map;
  }, [shifts]);

  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: startDow }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  const todayKey = new Date().toISOString().slice(0, 10);

  const step = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  return (
    <>
      <PageHeader title="Хуваарь" crumb="Хуваарь" />

      <Card
        title={`${year} оны ${String(month + 1).padStart(2, '0')}-сар`}
        icon={<CalendarDays size={17} />}
        actions={
          <div className="flex items-center gap-1">
            <button
              onClick={() => step(-1)}
              className="focus-ring rounded-[var(--radius-sm)] p-1.5 text-muted hover:bg-hover hover:text-ink"
              aria-label="Өмнөх сар"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => step(1)}
              className="focus-ring rounded-[var(--radius-sm)] p-1.5 text-muted hover:bg-hover hover:text-ink"
              aria-label="Дараа сар"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        }
      >
        {loading ? (
          <Loading text="Систем таны өгөгдлийг бэлтгэж байна" />
        ) : error ? (
          <ErrorState text={error} onRetry={reload} />
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] uppercase text-subtle">
              {['Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба', 'Ням'].map((d) => (
                <span key={d} className="py-2">
                  {d}
                </span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1.5">
              {cells.map((d, i) => {
                if (d === null) return <div key={i} />;
                const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const list = byDate[key] || [];
                const isToday = key === todayKey;
                const weekend = (i % 7) >= 5;
                return (
                  <div
                    key={i}
                    className={`min-h-[104px] rounded-[var(--radius-sm)] border p-1.5 ${
                      isToday ? 'border-success' : 'border-line'
                    } ${weekend ? 'bg-[rgba(0,0,0,.18)]' : 'bg-card2'}`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className={`text-[12px] ${isToday ? 'font-bold text-success' : 'text-muted'}`}>
                        {d}
                      </span>
                      {isToday && (
                        <span className="rounded bg-success px-1.5 py-0.5 text-[9px] font-bold text-white">
                          Өнөөдөр
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {list.slice(0, 2).map((s) => {
                        const c = shiftColor(s.start_time);
                        return (
                          <div
                            key={s.id}
                            className="truncate rounded px-1.5 py-1 text-[10px] font-medium"
                            style={{ background: c.bg, color: c.fg }}
                            title={`${s.user_name} (${s.start_time} - ${s.end_time})`}
                          >
                            {s.user_name} ({s.start_time})
                          </div>
                        );
                      })}
                      {list.length > 2 && (
                        <div className="px-1.5 text-[10px] text-subtle">+{list.length - 2} хуваарь</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {shifts.length === 0 && (
              <div className="mt-4">
                <EmptyState text="Энэ сард хуваарь оноогоогүй байна." />
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}

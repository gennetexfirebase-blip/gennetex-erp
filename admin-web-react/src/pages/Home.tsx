import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Clock, Users, Bell, CalendarDays, MapPin } from 'lucide-react';
import { Card, Avatar, EmptyState, Loading, Badge, ToneIcon } from '../components/ui';
import { DonutChart, STATUS_COLORS } from '../components/charts';
import { fetchAttendanceToday, fetchAttendanceRequests, useAsync, type AttendanceRow } from '../lib/data';

// Төлөвийн өнгө — «Хуваарьгүй» нь бүдэг саарал, жинхэнэ төлөвүүдийг дарахгүй.
const SLICE_COLORS: Record<string, string> = {
  on_time: STATUS_COLORS.good,
  late: STATUS_COLORS.warning,
  absent: STATUS_COLORS.critical,
  leave: STATUS_COLORS.info,
  rest: STATUS_COLORS.muted,
  not_scheduled: STATUS_COLORS.none,
};

const SLICE_LABEL: Record<string, string> = {
  on_time: 'Ирсэн',
  late: 'Хоцорсон',
  absent: 'Тасалсан',
  leave: 'Чөлөөтэй',
  rest: 'Амралт',
  not_scheduled: 'Хуваарьгүй',
};

function greeting(h: number) {
  if (h < 5) return 'Оройн мэнд';
  if (h < 12) return 'Өглөөний мэнд';
  if (h < 18) return 'Өдрийн мэнд';
  return 'Оройн мэнд';
}

export default function HomePage() {
  const { profile } = useOutletContext<{ profile: { name?: string | null; email?: string | null } | null }>() || { profile: null };
  const firstName = (profile?.name || profile?.email?.split('@')[0] || '').split(/\s+/).slice(-1)[0];
  const today = new Date().toISOString().slice(0, 10);
  const { data: rows, loading } = useAsync<AttendanceRow[]>(
    () => fetchAttendanceToday(today),
    [today],
    []
  );
  const { data: requests, error: requestsError } = useAsync<any[]>(
    () => fetchAttendanceRequests('pending'),
    [],
    []
  );

  const slices = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return Object.entries(counts).map(([k, v]) => ({
      key: k,
      name: SLICE_LABEL[k] || k,
      value: v,
      color: SLICE_COLORS[k] || '#334155',
    }));
  }, [rows]);

  const arrived = useMemo(
    () => rows.filter((r) => r.check_in_at).slice(0, 8),
    [rows]
  );

  return (
    <>
      <section className="surface hero mb-6 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-subtle">
            {`${new Date().getMonth() + 1}-р сарын ${new Date().getDate()}, ${['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'][new Date().getDay()]} гараг`}
          </p>
          <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[30px]">
            {greeting(new Date().getHours())}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-1.5 text-[14px] text-muted">Өнөөдрийн ирц, хүсэлт болон ажлын мэдээллийн тойм.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-3 rounded-[var(--radius)] bg-card2 px-4 py-3">
            <ToneIcon tone="green" size={40}><Users size={18} /></ToneIcon>
            <div>
              <p className="kpi-value text-[22px] font-bold leading-none tabular-nums text-ink">{loading ? '…' : rows.filter((r) => r.check_in_at).length}</p>
              <p className="mt-1 text-[12px] text-muted">ирсэн</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-[var(--radius)] bg-card2 px-4 py-3">
            <ToneIcon tone="amber" size={40}><Bell size={18} /></ToneIcon>
            <div>
              <p className="kpi-value text-[22px] font-bold leading-none tabular-nums text-ink">{requestsError ? '—' : requests.length}</p>
              <p className="mt-1 text-[12px] text-muted">хүсэлт</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Ирц — донат */}
        <Card title="Ирц" icon={<Clock size={17} />}>
          {loading ? (
            <Loading />
          ) : slices.length === 0 ? (
            <EmptyState text="Өнөөдрийн ирцийн мэдээлэл алга." />
          ) : (
            <DonutChart
              slices={slices}
              center={rows.filter((r) => r.check_in_at).length}
              sub={`/ ${rows.length} ирсэн`}
            />
          )}
        </Card>

        {/* Ирсэн ажилчид */}
        <Card title="Ирсэн ажилчид" icon={<Users size={17} />}>
          {loading ? (
            <Loading />
          ) : arrived.length === 0 ? (
            <EmptyState text="Өнөөдөр хараахан хэн ч ирээгүй байна." />
          ) : (
            <ul className="space-y-3">
              {arrived.map((r) => (
                <li key={r.employee_id} className="flex items-center gap-2.5">
                  <Avatar name={r.employee_name} src={r.avatar_url} size={30} />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                    {r.employee_name}
                  </span>
                  <span className="text-[13px] text-muted">
                    {new Date(r.check_in_at!).toLocaleTimeString('mn-MN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: SLICE_COLORS[r.status] || '#334155' }}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Өнөөдрийн хүсэлтүүд */}
        <Card
          title="Өнөөдрийн хүсэлтүүд"
          icon={<Bell size={17} />}
          actions={requests.length ? <Badge tone="brand">{requests.length}</Badge> : null}
        >
          {requestsError ? (
            <EmptyState text={requestsError} />
          ) : requests.length === 0 ? (
            <EmptyState text="Өнөөдөр хүсэлт байхгүй" />
          ) : (
            <ul className="space-y-3">
              {requests.slice(0, 6).map((r) => (
                <li key={r.id} className="flex items-center gap-2.5">
                  <Avatar name={r.employee_name} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-ink">{r.employee_name}</p>
                    <p className="truncate text-[11px] text-subtle">{r.requested_date}</p>
                  </div>
                  <Badge tone="warning">Хүлээгдэж буй</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Энэ сарын үйл явдлууд" icon={<CalendarDays size={17} />}>
          <MiniCalendar />
        </Card>

        <Card title="Илгээсэн байршил" icon={<MapPin size={17} />}>
          <EmptyState text="Илгээсэн байршил олдсонгүй." />
        </Card>

        <Card title="Мэдээ" icon={<Bell size={17} />}>
          <EmptyState text="Одоогоор мэдээ алга." />
        </Card>
      </div>
    </>
  );
}

function MiniCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // Даваа = 0
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: startDow }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];

  return (
    <div>
      <p className="mb-3 text-[13px] font-semibold text-ink">
        {year} оны {String(month + 1).padStart(2, '0')}-сар
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
        {['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'].map((d) => (
          <span key={d} className="py-1 text-subtle">
            {d}
          </span>
        ))}
        {cells.map((d, i) => (
          <span
            key={i}
            className={`flex h-7 items-center justify-center rounded-full ${
              d === now.getDate() ? 'bg-brand font-bold text-white' : 'text-muted'
            }`}
          >
            {d ?? ''}
          </span>
        ))}
      </div>
    </div>
  );
}

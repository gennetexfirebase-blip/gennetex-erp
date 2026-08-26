import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Clock, Users, Bell, CalendarDays, MapPin } from 'lucide-react';
import { PageHeader, Card, Avatar, EmptyState, Loading, Badge } from '../components/ui';
import { fetchAttendanceToday, fetchAttendanceRequests, useAsync, type AttendanceRow } from '../lib/data';

const SLICE_COLORS: Record<string, string> = {
  on_time: '#22A565',
  late: '#E8A317',
  absent: '#E5484D',
  leave: '#0099DB',
  rest: '#64748B',
  not_scheduled: '#334155',
};

const SLICE_LABEL: Record<string, string> = {
  on_time: 'Ирсэн',
  late: 'Хоцорсон',
  absent: 'Тасалсан',
  leave: 'Чөлөөтэй',
  rest: 'Амралт',
  not_scheduled: 'Хуваарьгүй',
};

export default function HomePage() {
  const today = new Date().toISOString().slice(0, 10);
  const { data: rows, loading } = useAsync<AttendanceRow[]>(
    () => fetchAttendanceToday(today),
    [today],
    []
  );
  const { data: requests } = useAsync<any[]>(() => fetchAttendanceRequests('pending'), [], []);

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
      <PageHeader title="Нүүр" crumb="Нүүр" />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Ирц — донат */}
        <Card title="Ирц" icon={<Clock size={17} />}>
          {loading ? (
            <Loading />
          ) : slices.length === 0 ? (
            <EmptyState text="Өнөөдрийн ирцийн мэдээлэл алга." />
          ) : (
            <>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={slices} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={2}>
                      {slices.map((s) => (
                        <Cell key={s.key} fill={s.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-card-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'var(--text)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-1.5">
                {slices.map((s) => (
                  <div key={s.key} className="flex items-center gap-2 text-[12px]">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="text-muted">{s.name}</span>
                    <span className="ml-auto font-semibold text-ink">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
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
          {requests.length === 0 ? (
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

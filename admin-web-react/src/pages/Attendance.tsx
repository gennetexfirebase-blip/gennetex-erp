import { useMemo, useState } from 'react';
import { Calendar, Filter, RotateCw } from 'lucide-react';
import { PageHeader, Card, Button, Input, Select, Avatar, EmptyState, Loading, ErrorState, Badge } from '../components/ui';
import { fetchAttendanceToday, fetchDepartments, useAsync, type AttendanceRow } from '../lib/data';
import AttendanceDetailDrawer from '../components/AttendanceDetailDrawer';

const STATUS_LABEL: Record<string, string> = {
  on_time: 'Ирсэн',
  late: 'Хоцорсон',
  absent: 'Тасалсан',
  early_leave: 'Эрт явсан',
  leave: 'Чөлөөтэй',
  rest: 'Амралт',
  not_scheduled: 'Хуваарьгүй',
  upcoming: 'Ирээгүй',
};

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'brand' | 'neutral'> = {
  on_time: 'success',
  late: 'warning',
  absent: 'danger',
  early_leave: 'warning',
  leave: 'brand',
  rest: 'neutral',
  not_scheduled: 'neutral',
  upcoming: 'neutral',
};

function hhmm(iso: string | null) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' });
}

export default function AttendancePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [deptId, setDeptId] = useState<string>('');
  const [status, setStatus] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<AttendanceRow | null>(null);

  const { data: departments } = useAsync(fetchDepartments, [], [] as any[]);
  const { data: rows, loading, error, reload } = useAsync<AttendanceRow[]>(
    () => fetchAttendanceToday(date, deptId || null),
    [date, deptId],
    []
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (status !== 'all' && r.status !== status) return false;
        if (query && !String(r.employee_name || '').toLowerCase().includes(query.toLowerCase()))
          return false;
        return true;
      }),
    [rows, status, query]
  );

  const stats = useMemo(() => {
    const by = (s: string) => rows.filter((r) => r.status === s).length;
    return [
      { key: 'all', label: 'Бүгд', value: rows.length },
      { key: 'on_time', label: 'Ирсэн', value: by('on_time') },
      { key: 'late', label: 'Хоцорсон', value: by('late') },
      { key: 'absent', label: 'Тасалсан', value: by('absent') },
      { key: 'leave', label: 'Чөлөөтэй', value: by('leave') },
      { key: 'early_leave', label: 'Эрт явсан', value: by('early_leave') },
    ];
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Ирц бүртгэл"
        crumb="Ирц бүртгэл"
        actions={
          <Button variant="outline" icon={<RotateCw size={15} />} onClick={reload}>
            Шинэчлэх
          </Button>
        }
      />

      {/* KPI картууд */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => {
          const active = status === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setStatus(s.key)}
              className={`focus-ring rounded-[var(--radius)] border p-4 text-left transition ${
                active ? 'border-brand bg-brand-soft' : 'border-line bg-card hover:bg-hover'
              }`}
            >
              <p className={`text-[26px] font-bold ${active ? 'text-brand' : 'text-ink'}`}>
                {s.value}
              </p>
              <p className="mt-0.5 text-[12px] text-muted">{s.label}</p>
            </button>
          );
        })}
      </div>

      <Card
        title="Өдрийн ирц"
        icon={<Calendar size={17} />}
        actions={<span className="text-[12px] text-subtle">{filtered.length} ажилтан</span>}
        bodyClassName="p-0"
      >
        {/* Шүүлтүүр */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <Input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />
          <Select value={deptId} onChange={(e) => setDeptId(e.target.value)}>
            <option value="">Бүх хэлтэс</option>
            {departments.map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Ажилтнаар хайх"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-auto min-w-[180px] flex-1"
          />
          <Button
            variant="ghost"
            icon={<Filter size={15} />}
            onClick={() => {
              setStatus('all');
              setQuery('');
              setDeptId('');
            }}
          >
            Шүүлт цэвэрлэх
          </Button>
        </div>

        {loading ? (
          <Loading />
        ) : error ? (
          <div className="p-5">
            <ErrorState text={error} onRetry={reload} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState text="Энэ өдөрт ирцийн бүртгэл олдсонгүй." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase text-subtle">
                  <th className="px-4 py-3 font-semibold">Ажилтан</th>
                  <th className="px-4 py-3 font-semibold">Алба хэлтэс</th>
                  <th className="px-4 py-3 font-semibold">Ирсэн</th>
                  <th className="px-4 py-3 font-semibold">Явсан</th>
                  <th className="px-4 py-3 font-semibold">Хоц/Эрт</th>
                  <th className="px-4 py-3 font-semibold">Төлөв</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.employee_id}
                    onClick={() => setDetail(r)}
                    title="Дэлгэрэнгүй — хэзээ, хаанаас бүртгүүлснийг газрын зураг дээр харах"
                    className="cursor-pointer border-b border-line text-[13px] hover:bg-hover"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.employee_name} src={r.avatar_url} size={30} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{r.employee_name}</p>
                          {r.is_remote ? (
                            <p className="text-[11px] text-brand">Зайнаас</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{r.department_name || '—'}</td>
                    <td className="px-4 py-3 text-ink">{hhmm(r.check_in_at)}</td>
                    <td className="px-4 py-3 text-ink">{hhmm(r.check_out_at)}</td>
                    <td className="px-4 py-3">
                      {r.late_minutes ? (
                        <span className="font-semibold text-danger">{r.late_minutes}м</span>
                      ) : r.early_leave_minutes ? (
                        <span className="font-semibold text-warning">-{r.early_leave_minutes}м</span>
                      ) : (
                        <span className="text-subtle">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[r.status] || 'neutral'}>
                        {STATUS_LABEL[r.status] || r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AttendanceDetailDrawer row={detail} date={date} onClose={() => setDetail(null)} />
    </>
  );
}

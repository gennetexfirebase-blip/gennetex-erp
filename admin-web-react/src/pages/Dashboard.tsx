import { useMemo } from 'react';
import MoreLink from '../components/MoreLink';
import { Users, UserCheck, UserPlus, Building2, Briefcase, BarChart3, PieChart as PieIcon } from 'lucide-react';
import {
  PageHeader, Card, Avatar, EmptyState, Loading, ErrorState, Badge, StatCard, KpiRow, RankList,
} from '../components/ui';
import { DonutChart, HBarChart, STATUS_COLORS } from '../components/charts';
import { fetchEmployees, useAsync, type Employee } from '../lib/data';

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Хянах самбар"
        description="Ажилтны бүртгэл, төлөв болон хэлтсийн хуваарилалтын бодит мэдээлэл."
      />
      <EmployeesTab />
    </>
  );
}

/* ───────────────────────── Нийтлэг хэсгүүд ───────────────────────── */

function groupCount<T>(list: T[], key: (x: T) => string) {
  const map: Record<string, number> = {};
  list.forEach((x) => {
    const k = key(x);
    map[k] = (map[k] || 0) + 1;
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/* ───────────────────────── Ажилтнууд ───────────────────────── */

function EmployeesTab() {
  const { data: employees, loading, error, reload } = useAsync<Employee[]>(fetchEmployees, [], []);

  const byDept = useMemo(() => groupCount(employees, (e) => e.department_name || 'Хэлтэсгүй'), [employees]);
  const byPosition = useMemo(() => groupCount(employees, (e) => e.position || 'Тодорхойгүй').slice(0, 6), [employees]);

  if (loading) return <Loading />;
  if (error) return <ErrorState text={error} onRetry={reload} />;

  const registered = employees.filter((e) => e.registered).length;
  const withDept = employees.filter((e) => e.department_id).length;
  const pending = employees.length - registered;

  return (
    <>
      <KpiRow>
        <StatCard tone="green" icon={<Users size={19} />} value={employees.length} label="Нийт ажилтан" note="Бүртгэлтэй бүх ажилтан" />
        <StatCard tone="blue" icon={<UserCheck size={19} />} value={registered} label="Апп-д нэвтэрсэн" note={`${employees.length ? Math.round((registered / employees.length) * 100) : 0}% идэвхжсэн`} />
        <StatCard tone="amber" icon={<UserPlus size={19} />} value={pending} label="Урилга хүлээж буй" note="Апп руу хараахан ороогүй" />
        <StatCard tone="violet" icon={<Building2 size={19} />} value={byDept.filter((d) => d.name !== 'Хэлтэсгүй').length} label="Хэлтэс" note={`${withDept} ажилтан хуваарилагдсан`} />
      </KpiRow>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card
          title="Хэлтсээрх хуваарилалт"
          icon={<BarChart3 size={17} />}
          className="xl:col-span-2"
          actions={<MoreLink to="/department">Хэлтэс</MoreLink>}
        >
          <HBarChart data={byDept} unit="ажилтан" />
        </Card>

        <Card title="Бүртгэлийн төлөв" icon={<PieIcon size={17} />}>
          <DonutChart
            center={employees.length}
            sub="нийт ажилтан"
            slices={[
              { key: 'reg', name: 'Нэвтэрсэн', value: registered, color: STATUS_COLORS.good },
              { key: 'pend', name: 'Хүлээгдэж буй', value: pending, color: STATUS_COLORS.warning },
            ]}
          />
        </Card>

        <Card title="Албан тушаал" icon={<Briefcase size={17} />}>
          <RankList items={byPosition} format={(n) => `${n} хүн`} />
        </Card>

        <Card
          title="Урилга хүлээж буй"
          icon={<UserPlus size={17} />}
          className="xl:col-span-2"
          actions={<MoreLink to="/employee">Бүх ажилтан</MoreLink>}
        >
          {pending === 0 ? (
            <EmptyState text="Бүх ажилтан апп-д нэвтэрсэн байна." />
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {employees.filter((e) => !e.registered).slice(0, 8).map((e) => (
                <li key={e.record_id} className="flex items-center gap-2.5 rounded-[var(--radius-sm)] bg-card2 px-3 py-2.5">
                  <Avatar name={[e.last_name, e.name].filter(Boolean).join(' ') || e.email} src={e.avatar_url} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-ink">{e.name || e.email || 'Ажилтан'}</p>
                    <p className="truncate text-[11px] text-subtle">{e.department_name || e.position || e.phone || '—'}</p>
                  </div>
                  <Badge tone="warning">Урилга</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

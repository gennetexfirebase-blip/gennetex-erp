import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import { Users, UserCheck, UserPlus, Building2, Briefcase, ArrowRight, BarChart3, PieChart as PieIcon } from 'lucide-react';
import {
  PageHeader, Card, Avatar, EmptyState, Loading, ErrorState, Badge, ToneIcon, Meter, type ToneName,
} from '../components/ui';
import { fetchEmployees, useAsync, type Employee } from '../lib/data';

const C = {
  green: '#22A565',
  amber: '#E8A317',
};

const tooltipStyle = {
  background: 'var(--bg-card-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--text)',
};

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

function Kpi({ tone, icon, value, label, note }: { tone: ToneName; icon: ReactNode; value: ReactNode; label: string; note?: string }) {
  return (
    <div className="surface flex items-center gap-4 p-5">
      <ToneIcon tone={tone} size={44}>{icon}</ToneIcon>
      <div className="min-w-0">
        <p className="text-[24px] font-bold leading-none tracking-[-0.02em] tabular-nums text-ink">{value}</p>
        <p className="mt-1.5 truncate text-[12px] font-medium text-muted">{label}</p>
        {note ? <p className="truncate text-[11px] text-subtle">{note}</p> : null}
      </div>
    </div>
  );
}

function KpiRow({ children }: { children: ReactNode }) {
  return <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

type Slice = { key: string; name: string; value: number; color: string };

function Donut({ slices, center, sub }: { slices: Slice[]; center: ReactNode; sub: string }) {
  const shown = slices.filter((s) => s.value > 0);
  if (shown.length === 0) return <EmptyState text="Мэдээлэл алга." />;
  return (
    <>
      <div className="relative h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={shown} dataKey="value" innerRadius={62} outerRadius={84} paddingAngle={2}>
              {shown.map((s) => <Cell key={s.key} fill={s.color} stroke="none" />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[24px] font-bold leading-none tabular-nums text-ink">{center}</span>
          <span className="mt-1 text-[11px] text-subtle">{sub}</span>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {slices.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-[12px]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-muted">{s.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-ink">{s.value}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function RankList({ items, format = (n) => String(n), color = 'var(--brand)' }: {
  items: { name: string; value: number }[];
  format?: (n: number) => string;
  color?: string;
}) {
  if (items.length === 0) return <EmptyState text="Мэдээлэл алга." />;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3.5">
      {items.map((i) => (
        <li key={i.name}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
            <span className="truncate text-ink">{i.name}</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">{format(i.value)}</span>
          </div>
          <Meter pct={(i.value / max) * 100} color={color} />
        </li>
      ))}
    </ul>
  );
}

function MoreLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="focus-ring inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-semibold text-brand hover:bg-brand-soft">
      {children} <ArrowRight size={13} aria-hidden="true" />
    </Link>
  );
}

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
        <Kpi tone="green" icon={<Users size={19} />} value={employees.length} label="Нийт ажилтан" note="Бүртгэлтэй бүх ажилтан" />
        <Kpi tone="blue" icon={<UserCheck size={19} />} value={registered} label="Апп-д нэвтэрсэн" note={`${employees.length ? Math.round((registered / employees.length) * 100) : 0}% идэвхжсэн`} />
        <Kpi tone="amber" icon={<UserPlus size={19} />} value={pending} label="Урилга хүлээж буй" note="Апп руу хараахан ороогүй" />
        <Kpi tone="violet" icon={<Building2 size={19} />} value={byDept.filter((d) => d.name !== 'Хэлтэсгүй').length} label="Хэлтэс" note={`${withDept} ажилтан хуваарилагдсан`} />
      </KpiRow>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card
          title="Хэлтсээрх хуваарилалт"
          icon={<BarChart3 size={17} />}
          className="xl:col-span-2"
          actions={<MoreLink to="/department">Хэлтэс</MoreLink>}
        >
          {byDept.length === 0 ? (
            <EmptyState text="Ажилтны мэдээлэл алга." />
          ) : (
            <div style={{ height: Math.max(220, byDept.length * 38) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDept} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-subtle)" fontSize={12} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="var(--text-subtle)" fontSize={12} width={130} />
                  <Tooltip cursor={{ fill: 'var(--bg-hover)' }} contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="Ажилтан" fill="var(--brand)" radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Бүртгэлийн төлөв" icon={<PieIcon size={17} />}>
          <Donut
            center={employees.length}
            sub="ажилтан"
            slices={[
              { key: 'reg', name: 'Нэвтэрсэн', value: registered, color: C.green },
              { key: 'pend', name: 'Хүлээгдэж буй', value: pending, color: C.amber },
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

import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { LayoutDashboard } from 'lucide-react';
import { PageHeader, Card, Loading, EmptyState, Badge } from '../components/ui';
import { fetchEmployees, useAsync, type Employee } from '../lib/data';

const TABS = ['Ажилтнууд', 'Ирц Бүртгэл', 'Цагийн Хүсэлт', 'Цалин, Татвар'] as const;

export default function DashboardPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Ажилтнууд');
  const { data: employees, loading } = useAsync<Employee[]>(
    () => fetchEmployees().catch(() => []),
    [],
    []
  );

  const kpis = useMemo(
    () => [
      { label: 'Нийт ажилтан', value: employees.length, unit: 'хүн' },
      { label: 'Бүртгүүлсэн', value: employees.filter((e) => e.registered).length, unit: 'хүн' },
      { label: 'Хүлээгдэж буй', value: employees.filter((e) => !e.registered).length, unit: 'хүн' },
      {
        label: 'Хэлтэстэй',
        value: employees.filter((e) => e.department_id).length,
        unit: 'хүн',
      },
    ],
    [employees]
  );

  // Хэлтсээр хуваарилалт — бодит өгөгдлөөс.
  const byDept = useMemo(() => {
    const map: Record<string, number> = {};
    employees.forEach((e) => {
      const key = e.department_name || 'Тодорхойгүй';
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [employees]);

  return (
    <>
      <PageHeader
        title="Хянах самбар"
        crumb="Хянах самбар"
        actions={<Badge tone="warning">NEW</Badge>}
      />

      <div className="mb-5 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`focus-ring rounded-full px-4 py-2 text-[13px] font-semibold transition ${
              tab === t ? 'bg-brand text-white' : 'bg-card text-muted hover:bg-hover'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : tab === 'Ажилтнууд' ? (
        <>
          <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {kpis.map((k) => (
              <div
                key={k.label}
                className="rounded-[var(--radius)] border border-line bg-card p-5 shadow-panel"
              >
                <p className="text-[12px] text-muted">{k.label}</p>
                <p className="mt-1.5 text-[28px] font-bold leading-none text-ink">
                  {k.value}
                  <span className="ml-1.5 text-[13px] font-normal text-subtle">{k.unit}</span>
                </p>
              </div>
            ))}
          </div>

          <Card title="Хүний нөөцийн хуваарилалт" icon={<LayoutDashboard size={17} />}>
            {byDept.length === 0 ? (
              <EmptyState text="Ажилтны мэдээлэл алга." />
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byDept} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" stroke="var(--text-subtle)" fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="var(--text-subtle)"
                      fontSize={12}
                      width={110}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--bg-hover)' }}
                      contentStyle={{
                        background: 'var(--bg-card-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'var(--text)',
                      }}
                    />
                    <Bar dataKey="value" fill="var(--brand)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="mt-3 text-[12px] text-subtle">Нийт: {employees.length} ажилтан</p>
          </Card>
        </>
      ) : (
        <Card title={tab}>
          <EmptyState text={`"${tab}" хэсгийн аналитик удахгүй нэмэгдэнэ.`} />
        </Card>
      )}
    </>
  );
}

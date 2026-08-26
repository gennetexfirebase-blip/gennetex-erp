import { useMemo, useState } from 'react';
import { Building2, Users } from 'lucide-react';
import { PageHeader, Card, Badge, EmptyState, Loading, ErrorState } from '../components/ui';
import { fetchDepartments, fetchEmployees, useAsync, type Employee } from '../lib/data';

type Dept = { id: string; name: string; kind: string; parent_id: string | null };

export default function DepartmentsPage() {
  const [tab, setTab] = useState<'tree' | 'list'>('tree');
  const { data: depts, loading, error, reload } = useAsync<Dept[]>(fetchDepartments as any, [], []);
  const { data: employees } = useAsync<Employee[]>(() => fetchEmployees().catch(() => []), [], []);

  const countFor = useMemo(() => {
    const map: Record<string, number> = {};
    employees.forEach((e) => {
      if (e.department_id) map[e.department_id] = (map[e.department_id] || 0) + 1;
    });
    return map;
  }, [employees]);

  const unassigned = employees.filter((e) => !e.department_id).length;

  // Модны дараалал — гүн хязгааргүй, мөчлөгөөс хамгаалсан.
  const ordered = useMemo(() => {
    const byParent: Record<string, Dept[]> = {};
    depts.forEach((d) => {
      const key = d.parent_id && depts.some((p) => p.id === d.parent_id) ? d.parent_id : 'root';
      (byParent[key] ||= []).push(d);
    });
    const out: (Dept & { depth: number })[] = [];
    const seen = new Set<string>();
    const walk = (key: string, depth: number) => {
      (byParent[key] || []).forEach((n) => {
        if (seen.has(n.id)) return;
        seen.add(n.id);
        out.push({ ...n, depth });
        walk(n.id, depth + 1);
      });
    };
    walk('root', 0);
    depts.forEach((d) => {
      if (!seen.has(d.id)) out.push({ ...d, depth: 0 });
    });
    return out;
  }, [depts]);

  return (
    <>
      <PageHeader
        title="Алба, хэлтэс"
        crumb="Алба, хэлтэс"
        actions={
          unassigned > 0 ? (
            <Badge tone="danger">Алба хэлтэсгүй ажилтан: {unassigned}</Badge>
          ) : null
        }
      />

      <div className="mb-4 flex gap-1.5">
        {(['tree', 'list'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`focus-ring rounded-full px-4 py-2 text-[13px] font-semibold transition ${
              tab === t ? 'bg-brand text-white' : 'bg-card text-muted hover:bg-hover'
            }`}
          >
            {t === 'tree' ? 'Шатлал' : 'Жагсаалт'}
          </button>
        ))}
      </div>

      <Card title={tab === 'tree' ? 'Шатлал' : 'Жагсаалт'} icon={<Building2 size={17} />}>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState text={error} onRetry={reload} />
        ) : ordered.length === 0 ? (
          <EmptyState text="Хэлтэс бүртгэгдээгүй байна." />
        ) : tab === 'tree' ? (
          <div>
            <div className="mb-4 inline-flex items-center gap-2.5 rounded-[var(--radius)] border border-brand bg-brand-soft px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-[12px] font-black text-white">
                G
              </span>
              <span className="text-[14px] font-bold text-ink">ЖЕННЕТЕКС ХХК</span>
            </div>
            <div className="space-y-2">
              {ordered.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 rounded-[var(--radius)] border border-line bg-card2 px-4 py-3"
                  style={{ marginLeft: Math.min(d.depth, 4) * 28 }}
                >
                  <span className="text-[14px] font-semibold text-ink">{d.name}</span>
                  <Badge tone="brand" className="ml-auto">
                    <Users size={11} /> {countFor[d.id] || 0} ажилтан
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase text-subtle">
                  <th className="px-4 py-3 font-semibold">Нэр</th>
                  <th className="px-4 py-3 font-semibold">Төрөл</th>
                  <th className="px-4 py-3 font-semibold">Ажилтан</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((d) => (
                  <tr key={d.id} className="border-b border-line text-[13px] hover:bg-hover">
                    <td className="px-4 py-3 font-medium text-ink">{d.name}</td>
                    <td className="px-4 py-3 text-muted">
                      {d.kind === 'household' ? 'Өрх' : 'Байгууллага'}
                    </td>
                    <td className="px-4 py-3 text-muted">{countFor[d.id] || 0}</td>
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

import { useMemo, useState } from 'react';
import { Users, Search } from 'lucide-react';
import {
  PageHeader,
  Card,
  Input,
  Select,
  Button,
  Avatar,
  EmptyState,
  Loading,
  ErrorState,
  Badge,
} from '../components/ui';
import { fetchEmployees, fetchDepartments, useAsync, type Employee } from '../lib/data';

const ROLE_LABEL: Record<string, string> = {
  employee: 'Ажилтан',
  ahlah: 'Ахлах',
  menejer: 'Менежер',
  admin: 'Админ',
  superadmin: 'Хөгжүүлэгч',
};

export default function EmployeesPage() {
  const [query, setQuery] = useState('');
  const [deptId, setDeptId] = useState('');
  const { data: departments } = useAsync(fetchDepartments, [], [] as any[]);
  const { data: rows, loading, error, reload } = useAsync<Employee[]>(fetchEmployees, [], []);

  const filtered = useMemo(
    () =>
      rows.filter((e) => {
        if (deptId && e.department_id !== deptId) return false;
        if (!query) return true;
        const hay = `${e.name || ''} ${e.last_name || ''} ${e.phone || ''} ${e.position || ''}`.toLowerCase();
        return hay.includes(query.toLowerCase());
      }),
    [rows, query, deptId]
  );

  return (
    <>
      <PageHeader
        title="Ажилтан"
        crumb="Ажилтан"
        actions={
          <Badge tone="brand">
            Ажилтны тоо {rows.length}/{Math.max(rows.length, 20)}
          </Badge>
        }
      />

      <Card title="Ажилчид" icon={<Users size={17} />} bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
            <Input
              placeholder="Нэр, утас, албан тушаалаар хайх"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={deptId} onChange={(e) => setDeptId(e.target.value)}>
            <option value="">Бүх хэлтэс</option>
            {departments.map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Button
            variant="ghost"
            onClick={() => {
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
          <EmptyState text="Ажилтан олдсонгүй." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase text-subtle">
                  <th className="px-4 py-3 font-semibold">Ажилтан</th>
                  <th className="px-4 py-3 font-semibold">Алба хэлтэс</th>
                  <th className="px-4 py-3 font-semibold">Албан тушаал</th>
                  <th className="px-4 py-3 font-semibold">Эрх</th>
                  <th className="px-4 py-3 font-semibold">Утас</th>
                  <th className="px-4 py-3 font-semibold">Төлөв</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.record_id} className="border-b border-line text-[13px] hover:bg-hover">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={e.name} src={e.avatar_url} size={30} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{e.name}</p>
                          <p className="truncate text-[11px] text-subtle">{e.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{e.department_name || '—'}</td>
                    <td className="px-4 py-3 text-muted">{e.position || '—'}</td>
                    <td className="px-4 py-3 text-muted">{ROLE_LABEL[e.role || ''] || e.role}</td>
                    <td className="px-4 py-3 text-muted">{e.phone || '—'}</td>
                    <td className="px-4 py-3">
                      {e.registered ? (
                        <Badge tone="brand">Үндсэн ажилтан</Badge>
                      ) : (
                        <Badge tone="warning">Бүртгүүлээгүй</Badge>
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

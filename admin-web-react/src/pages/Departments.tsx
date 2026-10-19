import { useMemo, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Building2, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { PageHeader, Card, Badge, Button, EmptyState, Input, Loading, ErrorState, Select } from '../components/ui';
import {
  createDepartment,
  deleteDepartment,
  fetchDepartments,
  fetchEmployees,
  updateDepartment,
  useAsync,
  type DepartmentInput,
  type Employee,
} from '../lib/data';

type Dept = { id: string; name: string; kind: 'org' | 'household'; parent_id: string | null; note?: string | null };
type Profile = { role?: string | null; permissions?: Record<string, boolean> | null };

const EMPTY: DepartmentInput = { name: '', kind: 'org', parent_id: null, note: '' };

export default function DepartmentsPage() {
  const { profile } = useOutletContext<{ profile: Profile }>();
  // Сервер (RLS) ч мөн адил: зөвхөн sysadmin эсвэл `departments` эрхтэй хүн засна.
  const canEdit = profile?.role === 'superadmin' || profile?.permissions?.departments === true;

  const [tab, setTab] = useState<'tree' | 'list'>('tree');
  const { data: depts, loading, error, reload } = useAsync<Dept[]>(fetchDepartments as any, [], []);
  const { data: employees } = useAsync<Employee[]>(() => fetchEmployees().catch(() => []), [], []);

  // Засах цонх: null = хаалттай, id = null бол шинээр нэмэх.
  const [editing, setEditing] = useState<{ id: string | null; form: DepartmentInput } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

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

  // Өөрийгөө болон доод хэлтсүүдээ эцэг болгох боломжгүй (мөчлөг үүснэ).
  const descendantsOf = (id: string) => {
    const out = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      depts.forEach((d) => {
        if (d.parent_id && out.has(d.parent_id) && !out.has(d.id)) {
          out.add(d.id);
          grew = true;
        }
      });
    }
    return out;
  };

  const openNew = (parentId: string | null = null) => {
    setFormError('');
    setEditing({ id: null, form: { ...EMPTY, parent_id: parentId } });
  };
  const openEdit = (d: Dept) => {
    setFormError('');
    setEditing({ id: d.id, form: { name: d.name, kind: d.kind, parent_id: d.parent_id, note: d.note || '' } });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || saving) return;
    if (!editing.form.name.trim()) {
      setFormError('Хэлтсийн нэрийг оруулна уу.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editing.id) await updateDepartment(editing.id, editing.form);
      else await createDepartment(editing.form);
      setNotice(editing.id ? 'Хэлтэс шинэчлэгдлээ.' : `«${editing.form.name.trim()}» хэлтэс нэмэгдлээ.`);
      setEditing(null);
      await reload();
    } catch (e: any) {
      setFormError(e?.message || 'Хадгалж чадсангүй.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (d: Dept) => {
    const people = countFor[d.id] || 0;
    const children = depts.filter((x) => x.parent_id === d.id).length;
    const warn = [
      `«${d.name}» хэлтсийг устгах уу?`,
      people ? `\n• ${people} ажилтан хэлтэсгүй болно.` : '',
      children ? `\n• ${children} дэд хэлтэс дээд шатанд шилжинэ.` : '',
    ].join('');
    if (!window.confirm(warn)) return;
    try {
      await deleteDepartment(d.id);
      setNotice(`«${d.name}» хэлтэс устгагдлаа.`);
      await reload();
    } catch (e: any) {
      setNotice('');
      window.alert(e?.message || 'Устгаж чадсангүй.');
    }
  };

  const rowActions = (d: Dept) =>
    canEdit ? (
      <div className="flex shrink-0 items-center justify-end gap-1">
        <Button variant="ghost" className="!min-h-8 !px-2" title="Дэд хэлтэс нэмэх" aria-label={`${d.name} — дэд хэлтэс нэмэх`} onClick={() => openNew(d.id)}>
          <Plus size={15} />
        </Button>
        <Button variant="ghost" className="!min-h-8 !px-2" title="Засах" aria-label={`${d.name} засах`} onClick={() => openEdit(d)}>
          <Pencil size={15} />
        </Button>
        <Button variant="ghost" className="!min-h-8 !px-2 hover:!text-danger" title="Устгах" aria-label={`${d.name} устгах`} onClick={() => remove(d)}>
          <Trash2 size={15} />
        </Button>
      </div>
    ) : null;

  const blocked = editing?.id ? descendantsOf(editing.id) : new Set<string>();

  return (
    <>
      <PageHeader
        title="Алба, хэлтэс" description="Байгууллагын бүтэц, алба хэлтэс болон ажилтны хуваарилалтыг удирдана."
        crumb="Алба, хэлтэс"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {unassigned > 0 ? <Badge tone="danger">Алба хэлтэсгүй ажилтан: {unassigned}</Badge> : null}
            {canEdit ? (
              <Button icon={<Plus size={15} />} onClick={() => openNew(null)}>
                Хэлтэс нэмэх
              </Button>
            ) : null}
          </div>
        }
      />

      {notice ? (
        <div className="mb-4 rounded-[var(--radius)] border border-brand bg-brand-soft px-4 py-3 text-[13px] text-ink" role="status">
          {notice}
        </div>
      ) : null}

      {editing ? (
        <Card title={editing.id ? 'Хэлтэс засах' : 'Шинэ хэлтэс'} icon={<Building2 size={17} />} className="mb-4">
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-[13px] text-ink">
              <span>Нэр</span>
              <Input
                autoFocus
                value={editing.form.name}
                onChange={(e) => setEditing((s) => s && { ...s, form: { ...s.form, name: e.target.value } })}
                placeholder="Жишээ: Техникийн алба"
              />
            </label>
            <label className="space-y-1 text-[13px] text-ink">
              <span>Төрөл</span>
              <Select
                className="w-full"
                value={editing.form.kind}
                onChange={(e) => setEditing((s) => s && { ...s, form: { ...s.form, kind: e.target.value as DepartmentInput['kind'] } })}
              >
                <option value="org">Байгууллага</option>
                <option value="household">Өрх</option>
              </Select>
            </label>
            <label className="space-y-1 text-[13px] text-ink">
              <span>Дээд хэлтэс</span>
              <Select
                className="w-full"
                value={editing.form.parent_id || ''}
                onChange={(e) => setEditing((s) => s && { ...s, form: { ...s.form, parent_id: e.target.value || null } })}
              >
                <option value="">— Дээд шат (ЖЕННЕТЕКС ХХК) —</option>
                {ordered
                  .filter((d) => !blocked.has(d.id))
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {'  '.repeat(Math.min(d.depth, 4))}
                      {d.name}
                    </option>
                  ))}
              </Select>
            </label>
            <label className="space-y-1 text-[13px] text-ink">
              <span>Тайлбар (заавал биш)</span>
              <Input
                value={editing.form.note || ''}
                onChange={(e) => setEditing((s) => s && { ...s, form: { ...s.form, note: e.target.value } })}
              />
            </label>
            {formError ? (
              <p className="text-[13px] text-danger sm:col-span-2" role="alert">
                {formError}
              </p>
            ) : null}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Хадгалж байна…' : 'Хадгалах'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Болих
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

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
          <EmptyState text={canEdit ? 'Хэлтэс бүртгэгдээгүй байна. «Хэлтэс нэмэх»-ээр эхлүүлнэ үү.' : 'Хэлтэс бүртгэгдээгүй байна.'} />
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
                  className="flex items-center gap-3 rounded-[var(--radius)] border border-line bg-card2 px-4 py-2.5"
                  style={{ marginLeft: Math.min(d.depth, 4) * 28 }}
                >
                  <span className="min-w-0 truncate text-[14px] font-semibold text-ink">{d.name}</span>
                  <Badge tone="brand" className="ml-auto shrink-0">
                    <Users size={11} /> {countFor[d.id] || 0} ажилтан
                  </Badge>
                  {rowActions(d)}
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
                  {canEdit ? <th className="px-4 py-3 font-semibold text-right">Үйлдэл</th> : null}
                </tr>
              </thead>
              <tbody>
                {ordered.map((d) => (
                  <tr key={d.id} className="border-b border-line text-[13px] hover:bg-hover">
                    <td className="px-4 py-3 font-medium text-ink">{d.name}</td>
                    <td className="px-4 py-3 text-muted">{d.kind === 'household' ? 'Өрх' : 'Байгууллага'}</td>
                    <td className="px-4 py-3 text-muted">{countFor[d.id] || 0}</td>
                    {canEdit ? <td className="px-4 py-2 text-right">{rowActions(d)}</td> : null}
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

import { useMemo, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Users, Search, UserPlus, X, GraduationCap, CheckCircle2, Trash2 } from 'lucide-react';
import {
  PageHeader,
  Card,
  Input,
  Textarea,
  Select,
  Button,
  Avatar,
  EmptyState,
  Loading,
  ErrorState,
  Badge,
} from '../components/ui';
import {
  createEmployee,
  createEmployeeTraining,
  deleteEmployeeTraining,
  fetchEmployeeTrainings,
  fetchEmployees,
  fetchDepartments,
  setEmployeeTrainingCompleted,
  useAsync,
  type Employee,
  type EmployeeTraining,
} from '../lib/data';

const ROLE_LABEL: Record<string, string> = {
  employee: 'Ажилтан',
  ahlah: 'Ахлах',
  menejer: 'Менежер',
  admin: 'Админ',
  superadmin: 'Хөгжүүлэгч',
};

export default function EmployeesPage() {
  const { profile } = useOutletContext<{ profile: { role?: string | null; department_id?: string | null; permissions?: Record<string, boolean> | null } }>();
  const isSuperAdmin = profile?.role === 'superadmin';
  const canAdd = isSuperAdmin || (profile?.role === 'admin' && profile?.permissions?.employees !== false);
  const [query, setQuery] = useState('');
  const [deptId, setDeptId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const [success, setSuccess] = useState('');
  const [trainingEmployee, setTrainingEmployee] = useState<Employee | null>(null);
  const [trainings, setTrainings] = useState<EmployeeTraining[]>([]);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [trainingError, setTrainingError] = useState('');
  const [trainingForm, setTrainingForm] = useState({ training_name: '', due_date: '', note: '' });
  const [form, setForm] = useState({ last_name: '', name: '', email: '', position: '', phone: '', address: '', department_id: '', role: 'employee' });
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAdd || saving) return;
    setCreateError('');
    setSaving(true);
    try {
      await createEmployee({ ...form, role: isSuperAdmin ? form.role : 'employee', department_id: form.department_id });
      await reload();
      setSuccess(`${form.email.trim().toLowerCase()} хаягийг зөвшөөрлөө. Ажилтан Google-ээр нэвтэрч болно.`);
      setShowCreate(false);
      setForm({ last_name: '', name: '', email: '', position: '', phone: '', address: '', department_id: '', role: 'employee' });
    } catch (error) {
      const code = String((error as Error).message || '');
      setCreateError(code.includes('department_required') ? 'Танд хэлтэс оноогоогүй байна. Хөгжүүлэгчээр хэлтэст харьяалуулна уу.'
        : code.includes('permission_denied') ? 'Танд ажилтан нэмэх эрх олгоогүй байна. Хөгжүүлэгчид хандана уу.'
        : code.includes('department_forbidden') ? 'Зөвхөн өөрийн хэлтэст ажилтан нэмж болно.'
        : code.includes('forbidden_target') ? 'Энэ хаяг удирдах эрхтэй хэрэглэгчид харьяалагдана. Хөгжүүлэгчид хандана уу.'
        : code.includes('role_forbidden') ? 'Энэ эрхтэй ажилтан нэмэх боломжгүй.'
        : code.includes('invalid_email') ? 'Имэйл хаягаа шалгана уу.'
        : code.includes('name_required') ? 'Ажилтны нэрийг оруулна уу.'
        : code);
    } finally {
      setSaving(false);
    }
  };

  const loadTrainings = async (employee: Employee) => {
    if (!employee.email) return;
    setTrainingLoading(true);
    setTrainingError('');
    try {
      setTrainings(await fetchEmployeeTrainings(employee.email));
    } catch (error) {
      setTrainingError((error as Error).message || 'Сургалтын мэдээлэл татагдсангүй.');
    } finally {
      setTrainingLoading(false);
    }
  };

  const openTrainings = (employee: Employee) => {
    setTrainingEmployee(employee);
    setTrainingForm({ training_name: '', due_date: '', note: '' });
    void loadTrainings(employee);
  };

  const addTraining = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trainingEmployee || !trainingForm.training_name.trim() || trainingLoading) return;
    setTrainingLoading(true);
    setTrainingError('');
    try {
      await createEmployeeTraining({ employee: trainingEmployee, ...trainingForm });
      setTrainingForm({ training_name: '', due_date: '', note: '' });
      await loadTrainings(trainingEmployee);
    } catch (error) {
      setTrainingError((error as Error).message || 'Сургалт нэмэгдсэнгүй.');
      setTrainingLoading(false);
    }
  };

  const toggleTraining = async (row: EmployeeTraining) => {
    if (!trainingEmployee) return;
    setTrainingLoading(true);
    try {
      await setEmployeeTrainingCompleted(row.id, row.status !== 'completed');
      await loadTrainings(trainingEmployee);
    } catch (error) {
      setTrainingError((error as Error).message || 'Төлөв шинэчлэгдсэнгүй.');
      setTrainingLoading(false);
    }
  };

  const removeTraining = async (row: EmployeeTraining) => {
    if (!trainingEmployee || !window.confirm(`“${row.training_name}” сургалтыг хасах уу?`)) return;
    setTrainingLoading(true);
    try {
      await deleteEmployeeTraining(row.id);
      await loadTrainings(trainingEmployee);
    } catch (error) {
      setTrainingError((error as Error).message || 'Сургалтыг хассангүй.');
      setTrainingLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Ажилтан"
        crumb="Ажилтан"
        actions={
          <>
            <Badge tone="brand">Ажилтны тоо {rows.length}/{Math.max(rows.length, 20)}</Badge>
            {canAdd ? <Button icon={<UserPlus size={16} />} onClick={() => { setCreateError(''); setForm((current) => ({ ...current, department_id: profile.department_id || '' })); setShowCreate(true); }}>Ажилтан нэмэх</Button> : null}
          </>
        }
      />

      {success ? <div role="status" className="mb-5 rounded-lg border border-line bg-card2 px-4 py-3 text-[13px] text-ink">{success}</div> : null}

      {showCreate ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowCreate(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="create-employee-title" className="surface w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 id="create-employee-title" className="text-xl font-semibold text-ink">Шинэ ажилтан нэмэх</h2>
                <p className="mt-1 text-[13px] text-muted">Ажилтны Gmail хаягийг зөвшөөрнө. Нууц үг үүсгэх шаардлагагүй.</p>
              </div>
              <Button variant="ghost" aria-label="Хаах" onClick={() => setShowCreate(false)} disabled={saving} icon={<X size={18} />} />
            </div>
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              {([
                ['last_name', 'Овог', 'text'], ['name', 'Нэр *', 'text'],
                ['email', 'Gmail *', 'email'], ['position', 'Албан тушаал', 'text'],
                ['phone', 'Утас', 'tel'], ['address', 'Хаяг', 'text'],
              ] as const).map(([key, label, type]) => (
                <label key={key} className="space-y-1 text-[13px] text-ink">
                  <span>{label}</span>
                  <Input type={type} required={key === 'name' || key === 'email'} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />
                </label>
              ))}
              <label className="space-y-1 text-[13px] text-ink">
                <span>Хэлтэс</span>
                <Select className="w-full" value={form.department_id} onChange={(event) => setForm((current) => ({ ...current, department_id: event.target.value }))}>
                  <option value="">Харьяалалгүй</option>
                  {departments.map((department: any) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </Select>
              </label>
              {isSuperAdmin ? <label className="space-y-1 text-[13px] text-ink"><span>Эрх</span><Select className="w-full" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>{Object.entries(ROLE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label> : <p className="self-end pb-3 text-[13px] text-muted">Эрх: Ажилтан</p>}
              {createError ? <p role="alert" className="sm:col-span-2 text-[13px] text-danger">{createError}</p> : null}
              <div className="sm:col-span-2 flex justify-end gap-2 border-t border-line pt-4">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)} disabled={saving}>Болих</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Хадгалж байна…' : 'Ажилтан нэмэх'}</Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {trainingEmployee ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !trainingLoading) setTrainingEmployee(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="employee-training-title" className="surface max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 id="employee-training-title" className="text-xl font-semibold text-ink">Заавал суух сургалт</h2>
                <p className="mt-1 text-[13px] text-muted">{trainingEmployee.name || trainingEmployee.email}</p>
              </div>
              <Button variant="ghost" aria-label="Хаах" onClick={() => setTrainingEmployee(null)} disabled={trainingLoading} icon={<X size={18} />} />
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-card2 p-4">
                <p className="text-[11px] uppercase text-subtle">Хамрагдах</p>
                <p className="mt-1 text-2xl font-semibold text-warning">{trainings.filter((row) => row.status !== 'completed').length}</p>
              </div>
              <div className="rounded-lg border border-line bg-card2 p-4">
                <p className="text-[11px] uppercase text-subtle">Хамрагдсан</p>
                <p className="mt-1 text-2xl font-semibold text-success">{trainings.filter((row) => row.status === 'completed').length}</p>
              </div>
            </div>

            <form onSubmit={addTraining} className="mb-5 grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-2">
              <label className="space-y-1 text-[13px] text-ink sm:col-span-2">
                <span>Сургалтын нэр *</span>
                <Input required placeholder="Ж: ХАБЭА-н анхан шатны сургалт" value={trainingForm.training_name} onChange={(event) => setTrainingForm((current) => ({ ...current, training_name: event.target.value }))} />
              </label>
              <label className="space-y-1 text-[13px] text-ink">
                <span>Хамрагдах хугацаа</span>
                <Input type="date" value={trainingForm.due_date} onChange={(event) => setTrainingForm((current) => ({ ...current, due_date: event.target.value }))} />
              </label>
              <label className="space-y-1 text-[13px] text-ink">
                <span>Тэмдэглэл</span>
                <Textarea rows={2} value={trainingForm.note} onChange={(event) => setTrainingForm((current) => ({ ...current, note: event.target.value }))} />
              </label>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" icon={<GraduationCap size={15} />} disabled={trainingLoading}>{trainingLoading ? 'Хадгалж байна…' : 'Сургалт нэмэх'}</Button>
              </div>
            </form>

            {trainingError ? <p role="alert" className="mb-4 text-[13px] text-danger">{trainingError}</p> : null}
            {trainingLoading && trainings.length === 0 ? <Loading /> : trainings.length === 0 ? <EmptyState text="Заавал суух сургалт бүртгэгдээгүй байна." /> : (
              <div className="space-y-2">
                {trainings.map((row) => {
                  const completed = row.status === 'completed';
                  const overdue = !completed && row.due_date && new Date(`${row.due_date}T23:59:59`) < new Date();
                  return (
                    <div key={row.id} className="flex items-center gap-3 rounded-lg border border-line p-3">
                      <button type="button" className={`focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${completed ? 'border-success bg-success text-white' : 'border-warning text-warning'}`} onClick={() => void toggleTraining(row)} disabled={trainingLoading} aria-label={completed ? 'Хамрагдаагүй болгох' : 'Хамрагдсан болгох'}>
                        {completed ? <CheckCircle2 size={18} /> : null}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`font-medium ${completed ? 'text-muted line-through' : 'text-ink'}`}>{row.training_name}</p>
                        <p className={`mt-0.5 text-[11px] ${overdue ? 'text-danger' : completed ? 'text-success' : 'text-warning'}`}>
                          {completed ? `Хамрагдсан${row.completed_at ? ` · ${new Date(row.completed_at).toLocaleDateString('mn-MN')}` : ''}` : row.due_date ? `${overdue ? 'Хугацаа хэтэрсэн' : 'Хамрагдах хугацаа'} · ${row.due_date}` : 'Заавал хамрагдана'}
                        </p>
                        {row.note ? <p className="mt-1 text-[12px] text-muted">{row.note}</p> : null}
                      </div>
                      <Button variant="ghost" className="px-2" icon={<Trash2 size={15} />} aria-label="Сургалт хасах" onClick={() => void removeTraining(row)} disabled={trainingLoading} />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : null}

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
                  <th className="px-4 py-3 font-semibold">Сургалт</th>
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
                    <td className="px-4 py-3">
                      <Button variant="outline" className="px-3 py-1.5" icon={<GraduationCap size={14} />} onClick={() => openTrainings(e)}>Харах</Button>
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

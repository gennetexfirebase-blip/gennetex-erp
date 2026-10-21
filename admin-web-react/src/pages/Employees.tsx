import { useMemo, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Users, Search, UserPlus, X, GraduationCap, CheckCircle2, Trash2, Pencil } from 'lucide-react';
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
  setEmployeeRole,
  setEmployeeTrainingCompleted,
  updateEmployee,
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
  const [editing, setEditing] = useState<Employee | null>(null);
  // Хөгжүүлэгчийн бүртгэлийг зөвхөн хөгжүүлэгч засна.
  const canEdit = (e: Employee) => canAdd && (isSuperAdmin || e.role !== 'superadmin');

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
        title="Ажилтан" description="Ажилтны бүртгэл, холбоо барих мэдээлэл болон апп-д нэвтэрсэн төлөв."
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
                          {canEdit(e) ? (
                            <button type="button" onClick={() => setEditing(e)} className="group flex max-w-full items-center gap-1.5 truncate text-left font-medium text-ink hover:text-brand" title="Мэдээлэл засах">
                              <span className="truncate">{[e.last_name, e.name].filter(Boolean).join(' ') || e.name}</span>
                              <Pencil size={12} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                            </button>
                          ) : (
                            <p className="truncate font-medium text-ink">{[e.last_name, e.name].filter(Boolean).join(' ') || e.name}</p>
                          )}
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
      {editing ? (
        <EditEmployee
          employee={editing}
          departments={departments}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => {
            setEditing(null);
            setSuccess(msg);
            await reload();
          }}
        />
      ) : null}
    </>
  );
}

const EDIT_ERR: Record<string, string> = {
  forbidden: 'Энэ үйлдлийг зөвхөн админ хийнэ.',
  permission_denied: 'Танд ажилтны мэдээлэл засах эрх олгогдоогүй байна.',
  role_forbidden: 'Хөгжүүлэгчийн бүртгэлийг зөвхөн хөгжүүлэгч засна.',
  name_required: 'Нэр заавал.',
  email_locked: 'Апп-д бүртгүүлсэн ажилтны имэйлийг солих боломжгүй (Google нэвтрэлт).',
  invalid_email: 'Имэйл буруу байна.',
  email_taken: 'Энэ имэйл өөр ажилтанд бүртгэлтэй байна.',
  phone_taken: 'Энэ утасны дугаар өөр ажилтанд бүртгэлтэй байна.',
  department_not_found: 'Хэлтэс олдсонгүй.',
  not_found: 'Ажилтан олдсонгүй.',
};

/** Ажилтны мэдээлэл засах — нэр, овог, утас, албан тушаал, хэлтэс, хаяг; бүртгүүлээгүй бол имэйл; хөгжүүлэгч эрхийг. */
function EditEmployee({ employee, departments, isSuperAdmin, onClose, onSaved }: { employee: Employee; departments: any[]; isSuperAdmin: boolean; onClose: () => void; onSaved: (msg: string) => void }) {
  const [f, setF] = useState({
    last_name: employee.last_name || '',
    name: employee.name || '',
    email: employee.email || '',
    phone: employee.phone || '',
    position: employee.position || '',
    address: (employee as Employee & { address?: string | null }).address || '',
    department_id: employee.department_id || '',
    role: employee.role || 'employee',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (ev: { target: { value: string } }) => setF((c) => ({ ...c, [k]: ev.target.value }));

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setErr('');
    setBusy(true);
    try {
      await updateEmployee({ email: employee.email || '', name: f.name, last_name: f.last_name, phone: f.phone, position: f.position, address: f.address, department_id: f.department_id || null, new_email: !employee.registered && f.email !== employee.email ? f.email : undefined });
      if (isSuperAdmin && employee.registered && employee.user_id && f.role !== employee.role) await setEmployeeRole(employee.user_id, f.role);
      onSaved(`${[f.last_name, f.name].filter(Boolean).join(' ')} — мэдээлэл шинэчлэгдлээ.`);
    } catch (e) {
      const code = String((e as Error).message || '');
      setErr(Object.entries(EDIT_ERR).find(([k]) => code.includes(k))?.[1] || code);
      setBusy(false);
    }
  };

  const field = 'space-y-1 text-[13px] text-ink';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Ажилтны мэдээлэл засах" onClick={onClose}>
      <form className="w-full max-w-xl rounded-[var(--radius-lg)] border border-line bg-card p-5 shadow-[var(--shadow-lg)]" onSubmit={save} onClick={(ev) => ev.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Avatar name={employee.name} src={employee.avatar_url} size={34} />
            <div>
              <p className="text-[15px] font-semibold text-ink">Ажилтны мэдээлэл засах</p>
              <p className="text-[12px] text-subtle">{employee.registered ? 'Апп-д бүртгүүлсэн — апп дээрх нэр, утас мөн солигдоно.' : 'Апп-д хараахан бүртгүүлээгүй.'}</p>
            </div>
          </div>
          <Button type="button" variant="ghost" aria-label="Хаах" onClick={onClose} disabled={busy} icon={<X size={18} />} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={field}><span>Овог</span><Input value={f.last_name} onChange={set('last_name')} /></label>
          <label className={field}><span>Нэр *</span><Input value={f.name} onChange={set('name')} required autoFocus /></label>
          <label className={field}><span>Утас</span><Input value={f.phone} onChange={set('phone')} inputMode="tel" /></label>
          <label className={field}><span>Албан тушаал</span><Input value={f.position} onChange={set('position')} /></label>
          <label className={field}>
            <span>Алба хэлтэс</span>
            <Select className="w-full" value={f.department_id} onChange={set('department_id')}>
              <option value="">— Хэлтэсгүй —</option>
              {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </label>
          <label className={field}>
            <span>Имэйл (Google)</span>
            <Input type="email" value={f.email} onChange={set('email')} disabled={employee.registered} title={employee.registered ? 'Апп-д бүртгүүлсэн тул солигдохгүй' : undefined} />
          </label>
          {isSuperAdmin ? (
            <label className={field}>
              <span>Эрх</span>
              <Select className="w-full" value={f.role} onChange={set('role')} disabled={!employee.registered} title={!employee.registered ? 'Бүртгүүлсний дараа солино' : undefined}>
                {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </label>
          ) : null}
          <label className={`${field} sm:col-span-2`}><span>Хаяг</span><Textarea rows={2} value={f.address} onChange={set('address')} /></label>
        </div>
        {err ? <p className="mt-3 text-[13px] text-danger" role="alert">{err}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Болих</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Хадгалж байна…' : 'Хадгалах'}</Button>
        </div>
      </form>
    </div>
  );
}

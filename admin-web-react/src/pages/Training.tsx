import { useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, GraduationCap, Search, Trash2, X, XCircle } from 'lucide-react';
import {
  createEmployeeTraining,
  deleteEmployeeTraining,
  fetchAllEmployeeTrainings,
  fetchEmployees,
  setEmployeeTrainingCompleted,
  useAsync,
  type Employee,
  type EmployeeTraining,
} from '../lib/data';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Input, Loading, PageHeader, Textarea } from '../components/ui';

const EMPTY_FORM = { training_name: '', due_date: '', note: '' };

function normalizedEmail(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase();
}

function employeeState(rows: EmployeeTraining[]) {
  const completed = rows.filter((row) => row.status === 'completed').length;
  const required = rows.length - completed;
  return { completed, required, complete: rows.length > 0 && required === 0 };
}

export default function TrainingPage() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [employees, trainings] = await Promise.all([fetchEmployees(), fetchAllEmployeeTrainings()]);
    return { employees, trainings };
  }, [], { employees: [] as Employee[], trainings: [] as EmployeeTraining[] });
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Employee | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  const byEmail = useMemo(() => {
    const grouped = new Map<string, EmployeeTraining[]>();
    data.trainings.forEach((row) => {
      const email = normalizedEmail(row.employee_email);
      const current = grouped.get(email) || [];
      current.push(row);
      grouped.set(email, current);
    });
    return grouped;
  }, [data.trainings]);

  const employees = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.employees
      .filter((employee) => !needle || [employee.name, employee.email, employee.position, employee.department_name]
        .some((value) => String(value || '').toLowerCase().includes(needle)))
      .slice()
      .sort((a: Employee, b: Employee) => {
        const aComplete = employeeState(byEmail.get(normalizedEmail(a.email)) || []).complete;
        const bComplete = employeeState(byEmail.get(normalizedEmail(b.email)) || []).complete;
        if (aComplete !== bComplete) return aComplete ? 1 : -1;
        return String(a.name || a.email).localeCompare(String(b.name || b.email), 'mn');
      });
  }, [byEmail, data.employees, query]);

  const selectedRows = selected ? byEmail.get(normalizedEmail(selected.email)) || [] : [];
  const completedPeople = data.employees.filter((employee) => employeeState(byEmail.get(normalizedEmail(employee.email)) || []).complete).length;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !selected.email || !form.training_name.trim() || saving) return;
    setSaving(true);
    setActionError('');
    try {
      await createEmployeeTraining({ employee: selected, ...form });
      setForm(EMPTY_FORM);
      await reload();
    } catch (nextError) {
      setActionError((nextError as Error)?.message || 'Сургалт нэмэгдсэнгүй.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (row: EmployeeTraining) => {
    if (saving) return;
    setSaving(true);
    setActionError('');
    try {
      await setEmployeeTrainingCompleted(row.id, row.status !== 'completed');
      await reload();
    } catch (nextError) {
      setActionError((nextError as Error)?.message || 'Төлөв шинэчлэгдсэнгүй.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: EmployeeTraining) => {
    if (saving || !window.confirm(`“${row.training_name}” сургалтыг хасах уу?`)) return;
    setSaving(true);
    setActionError('');
    try {
      await deleteEmployeeTraining(row.id);
      await reload();
    } catch (nextError) {
      setActionError((nextError as Error)?.message || 'Сургалт хасагдсангүй.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Авсан сургалт" crumb="Ажилтан / Сургалтын хяналт" />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="surface p-5">
          <p className="text-[12px] text-muted">Нийт ажилтан</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{data.employees.length}</p>
        </div>
        <div className="surface border border-success p-5">
          <p className="text-[12px] text-success">Бүрэн хамрагдсан</p>
          <p className="mt-2 text-3xl font-semibold text-success">{completedPeople}</p>
        </div>
        <div className="surface border border-danger p-5">
          <p className="text-[12px] text-danger">Хамрагдаагүй</p>
          <p className="mt-2 text-3xl font-semibold text-danger">{Math.max(0, data.employees.length - completedPeople)}</p>
        </div>
      </div>

      <Card title="Ажилтнуудын сургалтын төлөв" icon={<GraduationCap size={17} />} bodyClassName="p-0">
        <div className="border-b border-line p-4">
          <div className="relative max-w-xl">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
            <Input
              aria-label="Ажилтан хайх"
              placeholder="Нэр, имэйл, албан тушаал, хэлтсээр хайх"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? <Loading /> : error ? (
          <div className="p-5"><ErrorState text={error} onRetry={reload} /></div>
        ) : employees.length === 0 ? <EmptyState text="Ажилтан олдсонгүй." /> : (
          <div className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-3">
            {employees.map((employee: Employee) => {
              const state = employeeState(byEmail.get(normalizedEmail(employee.email)) || []);
              const tone = state.complete ? 'success' : 'danger';
              return (
                <button
                  key={employee.record_id}
                  type="button"
                  onClick={() => { setSelected(employee); setActionError(''); setForm(EMPTY_FORM); }}
                  className={`focus-ring flex items-center gap-3 rounded-lg border p-4 text-left transition hover:bg-hover ${state.complete ? 'border-success' : 'border-danger'}`}
                >
                  <Avatar name={employee.name} src={employee.avatar_url} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[14px] font-semibold ${state.complete ? 'text-success' : 'text-danger'}`}>{employee.name || employee.email}</span>
                    <span className="mt-1 block text-[11px] text-muted">
                      {state.complete ? `${state.completed} сургалтад хамрагдсан` : state.required ? `${state.required} сургалтад хамрагдаагүй` : 'Сургалт бүртгэгдээгүй'}
                    </span>
                  </span>
                  <Badge tone={tone}>{state.complete ? 'Хамрагдсан' : 'Хамрагдаагүй'}</Badge>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {selected ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setSelected(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="training-detail-title" className="surface max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 id="training-detail-title" className="text-xl font-semibold text-ink">Сургалтын дэлгэрэнгүй</h2>
                <p className="mt-1 text-[13px] text-muted">{selected.name || selected.email}</p>
              </div>
              <Button variant="ghost" aria-label="Хаах" icon={<X size={18} />} disabled={saving} onClick={() => setSelected(null)} />
            </div>

            <form onSubmit={submit} className="mb-5 grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-2">
              <label className="space-y-1 text-[13px] text-ink sm:col-span-2">
                <span>Сургалтын нэр *</span>
                <Input required value={form.training_name} placeholder="Ж: ХАБЭА-н анхан шатны сургалт" onChange={(event) => setForm((current) => ({ ...current, training_name: event.target.value }))} />
              </label>
              <label className="space-y-1 text-[13px] text-ink">
                <span>Хамрагдах хугацаа</span>
                <Input type="date" value={form.due_date} onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))} />
              </label>
              <label className="space-y-1 text-[13px] text-ink">
                <span>Тэмдэглэл</span>
                <Textarea rows={2} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
              </label>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" icon={<GraduationCap size={15} />} disabled={saving || !selected.email}>{saving ? 'Хадгалж байна…' : 'Сургалт нэмэх'}</Button>
              </div>
            </form>

            {actionError ? <p role="alert" className="mb-4 text-[13px] text-danger">{actionError}</p> : null}
            {selectedRows.length === 0 ? <EmptyState text="Сургалт бүртгэгдээгүй байна." /> : (
              <div className="space-y-2">
                {selectedRows.map((row) => {
                  const completed = row.status === 'completed';
                  const overdue = !completed && row.due_date && new Date(`${row.due_date}T23:59:59`) < new Date();
                  return (
                    <div key={row.id} className={`flex items-center gap-3 rounded-lg border p-3 ${completed ? 'border-success' : 'border-danger'}`}>
                      <button
                        type="button"
                        className={`focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${completed ? 'border-success bg-success text-white' : 'border-danger text-danger'}`}
                        onClick={() => void toggle(row)}
                        disabled={saving}
                        aria-label={completed ? 'Хамрагдаагүй болгох' : 'Хамрагдсан болгох'}
                      >
                        {completed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`font-medium ${completed ? 'text-success' : 'text-danger'}`}>{row.training_name}</p>
                        <p className={`mt-0.5 text-[11px] ${completed ? 'text-success' : 'text-danger'}`}>
                          {completed ? `Хамрагдсан${row.completed_at ? ` · ${new Date(row.completed_at).toLocaleDateString('mn-MN')}` : ''}` : row.due_date ? `${overdue ? 'Хугацаа хэтэрсэн' : 'Хамрагдах хугацаа'} · ${row.due_date}` : 'Хамрагдаагүй'}
                        </p>
                        {row.note ? <p className="mt-1 text-[12px] text-muted">{row.note}</p> : null}
                      </div>
                      <Button variant="ghost" className="px-2" icon={<Trash2 size={15} />} aria-label="Сургалт хасах" onClick={() => void remove(row)} disabled={saving} />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}

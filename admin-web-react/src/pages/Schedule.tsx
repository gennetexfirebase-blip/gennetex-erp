import { useMemo, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import { PageHeader, Card, Button, Input, Select, Loading, ErrorState, EmptyState } from '../components/ui';
import {
  deleteShift,
  fetchAttendanceLocations,
  fetchEmployees,
  fetchShiftsForMonth,
  saveShifts,
  useAsync,
  type Employee,
} from '../lib/data';
import TimeReport from './TimeReport';

type Shift = {
  id: string;
  user_id: string;
  user_name: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  location_id?: string | null;
  note?: string | null;
  attendance_locations?: { name?: string | null } | null;
};
type Profile = { id?: string | null; role?: string | null };

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (t?: string | null) => String(t || '').slice(0, 5);

/** Ээлжийн өнгө — эхлэх цагаар (§3.7). */
function shiftColor(start: string) {
  if (start?.startsWith('08')) return { bg: 'var(--success-soft)', fg: 'var(--success)' };
  if (start?.startsWith('09')) return { bg: 'var(--warning-soft)', fg: 'var(--warning)' };
  return { bg: 'var(--brand-soft)', fg: 'var(--brand)' };
}

/** `from`-оос `to` хүртэлх өдрүүд (хоёуланг оруулна), сонголтоор амралтын өдрийг алгасна. */
function datesBetween(from: string, to: string, skipWeekends: boolean) {
  const out: string[] = [];
  const end = new Date(`${to}T00:00:00`);
  for (let d = new Date(`${from}T00:00:00`); d <= end && out.length < 93; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (skipWeekends && (dow === 0 || dow === 6)) continue;
    out.push(dayKey(d));
  }
  return out;
}

type Form = {
  id: string | null;
  user_id: string;
  start_time: string;
  end_time: string;
  location_id: string;
  note: string;
  until: string;
  skipWeekends: boolean;
};

export default function SchedulePage() {
  const { profile } = useOutletContext<{ profile: Profile }>();
  // Сервер (RLS `is_admin_user`) ч мөн адил: зөвхөн админ хуваарь засна.
  const canEdit = ['admin', 'superadmin'].includes(String(profile?.role || ''));

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  // «Ирц» — ирцийн зураглал (цагийн тайлантай ижил), «Хуваарь» — хуанли.
  const [tab, setTab] = useState<'attendance' | 'schedule'>('attendance');

  /** Зураглалын ирээдүйн өдөр дээр дарахад тэр өдрийн хуваарь руу. */
  const planDay = (date: string) => {
    const d = new Date(`T00:00:00`);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelected(date);
    setForm(null);
    setTab('schedule');
  };

  const { data: shifts, loading, error, reload } = useAsync<Shift[]>(
    () => fetchShiftsForMonth(year, month) as any,
    [year, month],
    []
  );
  const { data: employees } = useAsync<Employee[]>(() => fetchEmployees().catch(() => []), [], []);
  const { data: locations } = useAsync<{ id: string; name: string }[]>(() => fetchAttendanceLocations().catch(() => []) as any, [], []);

  // Хуваарь зөвхөн апп-д нэвтэрсэн (user_id-тэй) ажилтанд оноогдоно.
  const people = useMemo(
    () =>
      employees
        .filter((e) => e.user_id)
        .map((e) => ({ id: e.user_id as string, name: [e.last_name, e.name].filter(Boolean).join(' ') || e.email || 'Ажилтан' }))
        .sort((a, b) => a.name.localeCompare(b.name, 'mn')),
    [employees]
  );

  const byDate = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    shifts.forEach((s) => {
      (map[s.shift_date] ||= []).push(s);
    });
    Object.values(map).forEach((l) => l.sort((a, b) => a.start_time.localeCompare(b.start_time)));
    return map;
  }, [shifts]);

  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: startDow }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  const todayKey = dayKey(new Date());

  const step = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelected(null);
    setForm(null);
  };

  const openNew = (date: string) => {
    setFormError('');
    setForm({ id: null, user_id: '', start_time: '09:00', end_time: '18:00', location_id: '', note: '', until: date, skipWeekends: true });
  };
  const openEdit = (s: Shift) => {
    setFormError('');
    setForm({
      id: s.id,
      user_id: s.user_id,
      start_time: hhmm(s.start_time),
      end_time: hhmm(s.end_time),
      location_id: s.location_id || '',
      note: s.note || '',
      until: s.shift_date,
      skipWeekends: false,
    });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form || !selected || saving) return;
    if (!form.user_id) return setFormError('Ажилтан сонгоно уу.');
    if (!form.start_time || !form.end_time || form.end_time <= form.start_time) return setFormError('Дуусах цаг эхлэх цагаас хойш байх ёстой.');
    const dates = form.id ? [selected] : datesBetween(selected, form.until < selected ? selected : form.until, form.skipWeekends);
    if (!dates.length) return setFormError('Сонгосон хугацаанд ажлын өдөр алга.');
    const person = people.find((p) => p.id === form.user_id);
    setSaving(true);
    setFormError('');
    try {
      await saveShifts(
        {
          user_id: form.user_id,
          user_name: person?.name || '',
          start_time: form.start_time,
          end_time: form.end_time,
          location_id: form.location_id || null,
          note: form.note,
        },
        dates,
        profile?.id || null
      );
      setForm(null);
      await reload();
    } catch (e: any) {
      setFormError(e?.message || 'Хадгалж чадсангүй.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: Shift) => {
    if (!window.confirm(`${s.user_name || 'Ажилтан'}-ийн ${s.shift_date}-ны хуваарийг устгах уу?`)) return;
    try {
      await deleteShift(s.id);
      if (form?.id === s.id) setForm(null);
      await reload();
    } catch (e: any) {
      window.alert(e?.message || 'Устгаж чадсангүй.');
    }
  };

  const dayList = selected ? byDate[selected] || [] : [];

  return (
    <>
      <PageHeader title="Хуваарь ба ирц" crumb="Хуваарь" />

      <div className="mb-4 inline-flex rounded-full border border-line bg-card2 p-1" role="tablist">
        {([['attendance', 'Ирц'], ['schedule', 'Хуваарь']] as const).map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`focus-ring rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${tab === k ? 'bg-brand text-white' : 'text-muted hover:text-ink'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'attendance' ? (
        <TimeReport variant="embedded" onPlanDay={canEdit ? planDay : undefined} />
      ) : (

      <div className={`grid gap-4 ${selected ? 'xl:grid-cols-[1fr_380px]' : ''}`}>
        <Card
          title={`${year} оны ${pad(month + 1)}-сар`}
          icon={<CalendarDays size={17} />}
          actions={
            <div className="flex items-center gap-1">
              <button onClick={() => step(-1)} className="focus-ring rounded-[var(--radius-sm)] p-1.5 text-muted hover:bg-hover hover:text-ink" aria-label="Өмнөх сар">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => step(1)} className="focus-ring rounded-[var(--radius-sm)] p-1.5 text-muted hover:bg-hover hover:text-ink" aria-label="Дараа сар">
                <ChevronRight size={16} />
              </button>
            </div>
          }
        >
          {loading ? (
            <Loading text="Систем таны өгөгдлийг бэлтгэж байна" />
          ) : error ? (
            <ErrorState text={error} onRetry={reload} />
          ) : (
            <>
              {canEdit ? <p className="mb-3 text-[12px] text-muted">Өдөр дээр дарж хуваарь нэмэх, засах, устгана.</p> : null}
              <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] uppercase text-subtle">
                {['Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба', 'Ням'].map((d) => (
                  <span key={d} className="py-2">
                    {d}
                  </span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1.5">
                {cells.map((d, i) => {
                  if (d === null) return <div key={i} />;
                  const key = `${year}-${pad(month + 1)}-${pad(d)}`;
                  const list = byDate[key] || [];
                  const isToday = key === todayKey;
                  const isSelected = key === selected;
                  const weekend = i % 7 >= 5;
                  return (
                    <button
                      type="button"
                      key={i}
                      onClick={() => {
                        setSelected(key);
                        setForm(null);
                      }}
                      className={`focus-ring min-h-[104px] rounded-[var(--radius-sm)] border p-1.5 text-left transition hover:border-brand ${
                        isSelected ? 'border-brand ring-1 ring-brand' : isToday ? 'border-success' : 'border-line'
                      } ${weekend ? 'bg-[rgba(0,0,0,.18)]' : 'bg-card2'}`}
                      aria-label={`${key}, ${list.length} хуваарь`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className={`text-[12px] ${isToday ? 'font-bold text-success' : 'text-muted'}`}>{d}</span>
                        {isToday && <span className="rounded bg-success px-1.5 py-0.5 text-[9px] font-bold text-white">Өнөөдөр</span>}
                      </div>
                      <div className="space-y-1">
                        {list.slice(0, 2).map((s) => {
                          const c = shiftColor(s.start_time);
                          return (
                            <div
                              key={s.id}
                              className="truncate rounded px-1.5 py-1 text-[10px] font-medium"
                              style={{ background: c.bg, color: c.fg }}
                              title={`${s.user_name} (${hhmm(s.start_time)} - ${hhmm(s.end_time)})`}
                            >
                              {s.user_name} ({hhmm(s.start_time)})
                            </div>
                          );
                        })}
                        {list.length > 2 && <div className="px-1.5 text-[10px] text-subtle">+{list.length - 2} хуваарь</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
              {shifts.length === 0 && (
                <div className="mt-4">
                  <EmptyState text="Энэ сард хуваарь оноогоогүй байна." />
                </div>
              )}
            </>
          )}
        </Card>

        {selected ? (
          <Card
            title={selected}
            icon={<CalendarDays size={17} />}
            actions={
              <button onClick={() => { setSelected(null); setForm(null); }} className="focus-ring rounded-[var(--radius-sm)] p-1.5 text-muted hover:bg-hover hover:text-ink" aria-label="Хаах">
                <X size={16} />
              </button>
            }
          >
            <div className="space-y-2">
              {dayList.length === 0 ? <p className="text-[13px] text-muted">Энэ өдөр хуваарь алга.</p> : null}
              {dayList.map((s) => {
                const c = shiftColor(s.start_time);
                return (
                  <div key={s.id} className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-line bg-card2 px-3 py-2">
                    <span className="h-8 w-1 rounded" style={{ background: c.fg }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-ink">{s.user_name || 'Ажилтан'}</div>
                      <div className="truncate text-[12px] text-muted">
                        {hhmm(s.start_time)}–{hhmm(s.end_time)}
                        {s.attendance_locations?.name ? ` · ${s.attendance_locations.name}` : ''}
                        {s.note ? ` · ${s.note}` : ''}
                      </div>
                    </div>
                    {canEdit ? (
                      <>
                        <Button variant="ghost" className="!min-h-8 !px-2" aria-label="Засах" title="Засах" onClick={() => openEdit(s)}>
                          <Pencil size={15} />
                        </Button>
                        <Button variant="ghost" className="!min-h-8 !px-2 hover:!text-danger" aria-label="Устгах" title="Устгах" onClick={() => remove(s)}>
                          <Trash2 size={15} />
                        </Button>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {canEdit && !form ? (
              <Button className="mt-3 w-full" icon={<Plus size={15} />} onClick={() => openNew(selected)}>
                Хуваарь нэмэх
              </Button>
            ) : null}

            {canEdit && form ? (
              <form onSubmit={save} className="mt-4 space-y-3 border-t border-line pt-4">
                <div className="text-[13px] font-semibold text-ink">{form.id ? 'Хуваарь засах' : 'Шинэ хуваарь'}</div>
                <label className="block space-y-1 text-[13px] text-ink">
                  <span>Ажилтан</span>
                  <Select className="w-full" value={form.user_id} disabled={!!form.id} onChange={(e) => setForm((f) => f && { ...f, user_id: e.target.value })}>
                    <option value="">— Сонгох —</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-[13px] text-ink">
                    <span>Эхлэх</span>
                    <Input type="time" value={form.start_time} onChange={(e) => setForm((f) => f && { ...f, start_time: e.target.value })} />
                  </label>
                  <label className="space-y-1 text-[13px] text-ink">
                    <span>Дуусах</span>
                    <Input type="time" value={form.end_time} onChange={(e) => setForm((f) => f && { ...f, end_time: e.target.value })} />
                  </label>
                </div>
                <label className="block space-y-1 text-[13px] text-ink">
                  <span>Байршил (заавал биш)</span>
                  <Select className="w-full" value={form.location_id} onChange={(e) => setForm((f) => f && { ...f, location_id: e.target.value })}>
                    <option value="">— Байршилгүй —</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block space-y-1 text-[13px] text-ink">
                  <span>Тэмдэглэл (заавал биш)</span>
                  <Input value={form.note} onChange={(e) => setForm((f) => f && { ...f, note: e.target.value })} />
                </label>
                {!form.id ? (
                  <div className="grid grid-cols-2 items-end gap-2">
                    <label className="space-y-1 text-[13px] text-ink">
                      <span>Хүртэл (олон өдөр)</span>
                      <Input type="date" min={selected} value={form.until} onChange={(e) => setForm((f) => f && { ...f, until: e.target.value })} />
                    </label>
                    <label className="flex h-10 items-center gap-2 text-[13px] text-ink">
                      <input type="checkbox" checked={form.skipWeekends} onChange={(e) => setForm((f) => f && { ...f, skipWeekends: e.target.checked })} />
                      Бямба, Ням алгасах
                    </label>
                  </div>
                ) : null}
                {formError ? (
                  <p className="text-[13px] text-danger" role="alert">
                    {formError}
                  </p>
                ) : null}
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Хадгалж байна…' : 'Хадгалах'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setForm(null)}>
                    Болих
                  </Button>
                </div>
              </form>
            ) : null}
          </Card>
        ) : null}
      </div>
      )}
    </>
  );
}

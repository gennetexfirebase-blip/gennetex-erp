import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, ClipboardPlus, GripVertical, Lightbulb, Pencil, Plus, Search, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, Field, Input, Loading, Modal, PageHeader, Select, Textarea } from '../components/ui';
import { MultiPick } from '../components/MultiPick';
import { hasLatin, toCyrillic } from '../lib/translit';
import { fetchEmployees, useAsync, type Employee } from '../lib/data';
import { aggregate, compareInsights, deleteFormJob, fetchJobsAny, fetchTaskOptions, isLocalDemo, KIND_LABEL, kindLabel, saveFormJob, saveTaskOptions, TASKS, type FormJob, type Insight } from '../lib/perf';

/**
 * guitsetgel.gennetex.com → Ажил бүртгэх.
 * Харахдаа Google Sheet шиг хүснэгт (Sheet + формоор бүртгэсэн бүх ажил),
 * нэмэх/засахдаа форм. Дээр нь автомат дүгнэлт: шилдэг баг/хүн, өмнөх сартай
 * харьцуулалт (өвлийн улирлын бууралтыг тооцсон) ба сайжруулах зөвлөгөө.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const todayUb = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' });
const monthRange = (y: number, m: number) => [`${y}-${pad(m + 1)}-01`, `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`] as const;

export default function GuitsetgelEntryPage() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [from, to] = monthRange(ym.y, ym.m);
  const prevYm = ym.m ? { y: ym.y, m: ym.m - 1 } : { y: ym.y - 1, m: 11 };
  const [pFrom, pTo] = monthRange(prevYm.y, prevYm.m);
  const local = isLocalDemo();
  const jobs = useAsync<FormJob[]>(() => fetchJobsAny(from, to), [from, to], []);
  const prev = useAsync<FormJob[]>(() => fetchJobsAny(pFrom, pTo), [pFrom, pTo], []);
  const emps = useAsync<Employee[]>(() => (local ? Promise.resolve([]) : fetchEmployees()), [], []);
  const taskOpts = useAsync<string[]>(fetchTaskOptions, [], TASKS);
  const [editing, setEditing] = useState<FormJob | 'new' | null>(null);
  const [q, setQ] = useState('');
  const [kindF, setKindF] = useState('');
  const [srcF, setSrcF] = useState('form');
  const [msg, setMsg] = useState('');

  const people = useMemo(() => {
    const list = emps.data.filter((e) => e.user_id).map((e) => ({ name: [e.last_name, e.name].filter(Boolean).join(' ').trim() || e.email || 'Ажилтан', id: e.user_id as string }));
    if (list.length) return list.sort((a, b) => a.name.localeCompare(b.name, 'mn'));
    // Local горим — Sheet дээрх нэрс.
    return [...new Set(jobs.data.flatMap((j) => j.engineers))].sort((a, b) => a.localeCompare(b)).map((n) => ({ name: n, id: '' }));
  }, [emps.data, jobs.data]);

  const insights = useMemo<Insight[]>(() => compareInsights(aggregate(jobs.data), aggregate(prev.data), ym.m), [jobs.data, prev.data, ym.m]);
  const kinds = useMemo(() => [...new Set([...Object.keys(KIND_LABEL).filter((k) => k !== 'cable'), ...jobs.data.map((j) => j.kind)])], [jobs.data]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return jobs.data
      .filter((j) => (!kindF || j.kind === kindF) && (!srcF || (j.source || 'sheet') === srcF))
      .filter((j) => !s || [j.engineers.join(' '), j.contract, j.note, j.lead, (j.tasks || []).join(' ')].join(' ').toLowerCase().includes(s))
      .sort((a, b) => b.work_date.localeCompare(a.work_date) || (b.job_time || '').localeCompare(a.job_time || ''));
  }, [jobs.data, q, kindF, srcF]);

  const remove = async (j: FormJob) => {
    if (!window.confirm(j.sheet_key ? `${j.work_date} · ${j.engineers.join(' + ')} — засварыг устгах уу? Sheet-ийн анхны мөр дараагийн «Sheet-ээс татах»-д буцаж орно.` : `${j.work_date} · ${j.engineers.join(' + ')} — устгах уу?`)) return;
    await deleteFormJob(j.id);
    setMsg('Устгагдлаа.');
    jobs.reload();
  };

  const toneCls = { good: 'text-success', warn: 'text-danger', info: 'text-warning' } as const;
  const ToneIcon = ({ t }: { t: Insight['tone'] }) => (t === 'good' ? <TrendingUp size={15} /> : t === 'warn' ? <TrendingDown size={15} /> : <Lightbulb size={15} />);

  return (
    <>
      <PageHeader
        title="Ажил бүртгэх"
        description="Sheet шиг хүснэгтээр харж, формоор бүртгэнэ. Бүртгэсэн ажил гүйцэтгэл, цалинд шууд тоологдоно."
        actions={
          <>
            <div className="flex items-center gap-1">
              <Button variant="outline" className="!px-2.5" aria-label="Өмнөх сар" onClick={() => setYm(prevYm)}><ChevronLeft size={16} /></Button>
              <span className="min-w-[96px] text-center text-[13px] font-semibold tabular-nums text-ink">{ym.y}-{pad(ym.m + 1)}</span>
              <Button variant="outline" className="!px-2.5" aria-label="Дараагийн сар" onClick={() => setYm(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))}><ChevronRight size={16} /></Button>
            </div>
            <Button icon={<ClipboardPlus size={15} />} onClick={() => setEditing('new')}>Ажил бүртгэх</Button>
          </>
        }
      />
      {local ? <p className="mb-4 rounded-[var(--radius)] border border-warning/30 bg-warning-soft px-4 py-2.5 text-[13px] text-warning">Local горим (нэвтрэлтгүй): Sheet-ийг шууд уншина; формын бүртгэл зөвхөн энэ компьютерт хадгалагдана.</p> : null}
      {msg ? <p className="mb-4 rounded-[var(--radius)] bg-card2 px-4 py-2.5 text-[13px] text-ink" role="status">{msg}</p> : null}

      {insights.length ? (
        <Card title={`Автомат дүгнэлт — ${ym.y}-${pad(ym.m + 1)}`} icon={<Lightbulb size={17} />} className="mb-5">
          <ul className="space-y-2">
            {insights.map((x, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] leading-5 text-ink">
                <span className={`mt-0.5 shrink-0 ${toneCls[x.tone]}`}><ToneIcon t={x.tone} /></span>
                <span>{x.text}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
            <Input className="!h-9 pl-9" placeholder="Нэр, гэрээний дугаар, тайлбар…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select className="!h-9" value={kindF} onChange={(e) => setKindF(e.target.value)} aria-label="Төрөл">
            <option value="">Бүх төрөл</option>
            {kinds.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
          </Select>
          <Select className="!h-9" value={srcF} onChange={(e) => setSrcF(e.target.value)} aria-label="Эх сурвалж">
            <option value="form">Форм</option>
            <option value="sheet">Sheet</option>
            <option value="">Sheet + форм</option>
          </Select>
          <span className="text-[12px] tabular-nums text-muted">{rows.length} мөр</span>
        </div>
        {jobs.loading && !jobs.data.length ? <Loading /> : jobs.error ? <ErrorState text={jobs.error} onRetry={jobs.reload} /> : !rows.length ? <EmptyState text={srcF === 'form' ? 'Энэ сард формоор бүртгэсэн ажил алга. «Ажил бүртгэх» дарж эхлүүлнэ үү.' : 'Энэ сард ажил алга.'} /> : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[1180px] border-collapse text-[12.5px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-card2 text-left text-[11.5px] font-semibold text-muted">
                  {['№', 'Огноо', 'Цаг', 'Төрөл', 'Инженер / баг', 'Хэний эрхээр', 'Кабель таталттай', 'Гэрээний дугаар', 'Хийсэн ажил', 'Тайлбар', ''].map((h, i) => (
                    <th key={i} className={`whitespace-nowrap border-b border-r border-line px-2.5 py-2 last:border-r-0 ${i === 0 || i === 6 ? 'text-center' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((j, i) => (
                  <tr key={`${j.source}-${j.id}`} className="border-b border-line hover:bg-hover/60">
                    <td className="border-r border-line px-2 py-1.5 text-center text-[11px] tabular-nums text-subtle">{i + 1}</td>
                    <td className="whitespace-nowrap border-r border-line px-2.5 py-1.5 tabular-nums text-ink">{j.work_date}</td>
                    <td className="border-r border-line px-2.5 py-1.5 tabular-nums text-ink">{j.job_time || '—'}</td>
                    <td className="whitespace-nowrap border-r border-line px-2.5 py-1.5 text-ink">{kindLabel(j.kind)}</td>
                    <td className="border-r border-line px-2.5 py-1.5 text-ink">{j.engineers.join(', ')}</td>
                    <td className="border-r border-line px-2.5 py-1.5 text-ink">{j.lead || '—'}</td>
                    <td className="border-r border-line px-2.5 py-1.5 text-center">{j.cable ? <span className="font-semibold text-success">Тийм</span> : <span className="text-muted">Үгүй</span>}</td>
                    <td className="border-r border-line px-2.5 py-1.5 tabular-nums text-ink">{j.contract || '—'}</td>
                    <td className="border-r border-line px-2.5 py-1.5">
                      {(j.tasks || []).length ? <span className="flex flex-wrap gap-1">{(j.tasks || []).map((t) => <span key={t} className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] text-brand">{t}</span>)}</span> : <span className="text-subtle">—</span>}
                    </td>
                    <td className="max-w-[240px] border-r border-line px-2.5 py-1.5 text-muted">{j.note || '—'}</td>
                    <td className="whitespace-nowrap px-1.5 py-1 text-right">
                      <span className="inline-flex items-center gap-0.5">
                        {j.source !== 'form' ? <span className="mr-1 rounded bg-card2 px-1.5 py-0.5 text-[10.5px] text-subtle">Sheet</span> : j.sheet_key ? <span className="mr-1 rounded bg-warning-soft px-1.5 py-0.5 text-[10.5px] text-warning" title="Sheet-ийн мөрийг эндээс зассан">Sheet · засварласан</span> : null}
                        <button type="button" className="rounded p-1.5 text-subtle hover:bg-hover hover:text-ink" aria-label="Засах" onClick={() => setEditing(j)}><Pencil size={14} /></button>
                        {j.source === 'form' ? <button type="button" className="rounded p-1.5 text-subtle hover:bg-hover hover:text-danger" aria-label={j.sheet_key ? 'Засварыг буцаах' : 'Устгах'} onClick={() => remove(j)}><Trash2 size={14} /></button> : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing ? (
        <JobForm
          job={editing === 'new' ? null : editing}
          people={people}
          kinds={kinds}
          taskOptions={taskOpts.data}
          onTaskOptions={async (list) => {
            await saveTaskOptions(list);
            taskOpts.reload();
          }}
          defaultDate={todayUb() >= from && todayUb() <= to ? todayUb() : from}
          onClose={() => setEditing(null)}
          onSaved={(again) => {
            setMsg(editing === 'new' ? 'Ажил бүртгэгдлээ.' : 'Засагдлаа.');
            jobs.reload();
            if (!again) setEditing(null);
          }}
        />
      ) : null}
    </>
  );
}

/** Нэг ажил бүртгэх / засах форм — Sheet-ийн нэг мөртэй ижил талбарууд + хийсэн ажил, хэний эхээр. */
function JobForm({ job, people, kinds, taskOptions, onTaskOptions, defaultDate, onClose, onSaved }: { job: FormJob | null; people: { name: string; id: string }[]; kinds: string[]; taskOptions: string[]; onTaskOptions: (list: string[]) => Promise<void>; defaultDate: string; onClose: () => void; onSaved: (again: boolean) => void }) {
  const names = people.map((p) => p.name);
  const nowTime = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Ulaanbaatar', hour: '2-digit', minute: '2-digit' });
  const [date, setDate] = useState(job?.work_date || defaultDate);
  const [time, setTime] = useState(job?.job_time || nowTime);
  const [kind, setKind] = useState(job?.kind || 'complain');
  const [main, setMain] = useState(job?.engineers[0] || '');
  const [partners, setPartners] = useState<string[]>(job?.engineers.slice(1) || []);
  const [lead, setLead] = useState(job?.lead || '');
  const [cable, setCable] = useState(job?.cable ?? false);
  const [contract, setContract] = useState(job?.contract || '');
  const [tasks, setTasks] = useState<string[]>(job?.tasks || []);
  const [note, setNote] = useState(job?.note || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const crew = [main, ...partners].filter(Boolean);

  const save = async (again: boolean) => {
    setErr('');
    if (!main) return setErr('Ажилтнаа сонгоно уу.');
    if (kind === 'complain' && !note.trim()) return setErr('Гомдлын агуулгыг бичнэ үү.');
    setBusy(true);
    try {
      await saveFormJob({ work_date: date, job_time: time, kind, engineers: crew.map((n) => ({ name: n, user_id: people.find((p) => p.name === n)?.id || null })), cable, contract, note, tasks, lead: toCyrillic(lead) }, job?.source === 'form' ? job.id : undefined, job && job.source !== 'form' ? job : undefined);
      onSaved(again);
      if (again) {
        // Дараагийн дуудлага — баг, огноо хэвээр, бусдыг цэвэрлэнэ.
        setContract('');
        setNote('');
        setTasks([]);
        setCable(false);
        setTime(new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Ulaanbaatar', hour: '2-digit', minute: '2-digit' }));
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const Seg = ({ v, set, opts }: { v: boolean; set: (b: boolean) => void; opts: [boolean, string][] }) => (
    <div className="grid grid-cols-2 gap-1 rounded-[var(--radius)] bg-card2 p-1" role="radiogroup">
      {opts.map(([o, l]) => (
        <button key={l} type="button" role="radio" aria-checked={v === o} onClick={() => set(o)} className={`rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] font-semibold ${v === o ? 'bg-card text-ink shadow-[var(--shadow)]' : 'text-muted hover:text-ink'}`}>{l}</button>
      ))}
    </div>
  );

  return (
    <Modal title={job ? (job.source === 'form' ? 'Ажил засах' : 'Sheet-ийн мөр засах') : 'Ажил бүртгэх'} onClose={onClose}>
      <div className="space-y-3.5">
        {job && job.source !== 'form' ? <p className="rounded-[var(--radius)] bg-warning-soft px-3 py-2 text-[12.5px] text-warning">Google Sheet-ээс орсон мөр. Засвар энд хадгалагдаж гүйцэтгэл, цалинд тоологдоно; «Sheet-ээс татах» дарахад дарагдахгүй. Google Sheet өөрөө өөрчлөгдөхгүй.</p> : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Огноо"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Цаг"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <Field label="Ажлын төрөл *">
          <Select className="w-full" value={kind} onChange={(e) => setKind(e.target.value)}>
            {kinds.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
          </Select>
        </Field>
        <Field label="Ажилтан *">
          <Select className="w-full" value={main} onChange={(e) => { setMain(e.target.value); setPartners((ps) => ps.filter((p) => p !== e.target.value)); }}>
            <option value="">— Ажилтан сонгох —</option>
            {[...new Set([...names, main].filter(Boolean))].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </Field>
        <Field label="Хамт явсан хүн" hint="Олон хүн сонгож болно; жагсаалтад байхгүй бол нэрийг бичээд Enter.">
          <div className="rounded-[var(--radius)] border border-line bg-card">
            <MultiPick value={partners} options={names} exclude={[main]} allowCustom placeholder="Ганцаараа" onChange={setPartners} className="!min-h-10 rounded-[var(--radius)] !px-3" />
          </div>
        </Field>
        <Field label="Хэний эрхээр явсан" hint={hasLatin(lead) ? <>Кирилл болно: <b className="text-ink">{toCyrillic(lead)}</b></> : 'Латинаар бичсэн ч автоматаар кирилл болно.'}>
          <Input value={lead} onChange={(e) => setLead(e.target.value)} onBlur={() => setLead((v) => toCyrillic(v))} placeholder="ж: Adiyasuren → Адъяасүрэн" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Кабель таталттай эсэх"><Seg v={cable} set={setCable} opts={[[true, 'Тийм'], [false, 'Үгүй']]} /></Field>
          <Field label="Гэрээний дугаар"><Input value={contract} onChange={(e) => setContract(e.target.value)} inputMode="numeric" /></Field>
        </div>
        <TaskPicker options={taskOptions} value={tasks} onChange={setTasks} onOptions={onTaskOptions} />
        <Field label={kind === 'complain' ? 'Гомдлын агуулга *' : 'Тайлбар'}>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === 'complain' ? 'ж: Интернэт тасарсан — коннектор сольсон' : ''} />
        </Field>
        {err ? <p className="text-[13px] text-danger" role="alert">{err}</p> : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button disabled={busy} onClick={() => save(false)}>{busy ? 'Хадгалж байна…' : job ? 'Хадгалах' : 'Бүртгэх'}</Button>
          {!job ? <Button variant="outline" disabled={busy} onClick={() => save(true)}>Бүртгээд дараагийнхыг</Button> : null}
          <Button variant="ghost" onClick={onClose}>Болих</Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Хийсэн ажил — checkbox-оор сонгоно. «+ Нэмэх»-ээр шинэ ажил жагсаалтад нэмж,
 * «Байр солих»-оор дарааллыг сумаар эсвэл чирж өөрчилнө (бүх админд хадгалагдана).
 */
function TaskPicker({ options, value, onChange, onOptions }: { options: string[]; value: string[]; onChange: (v: string[]) => void; onOptions: (list: string[]) => Promise<void> }) {
  const [list, setList] = useState(options);
  const [arrange, setArrange] = useState(false);
  const [adding, setAdding] = useState('');
  const [drag, setDrag] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  // Сонгосон боловч жагсаалтаас хасагдсан хуучин ажлыг харуулсаар байна.
  const shown = [...list, ...value.filter((v) => !list.includes(v))];

  const persist = async (next: string[]) => {
    setList(next);
    setBusy(true);
    try {
      await onOptions(next);
    } finally {
      setBusy(false);
    }
  };
  const add = async () => {
    const t = adding.trim();
    if (!t) return;
    setAdding('');
    if (!value.includes(t)) onChange([...value, t]);
    if (!list.some((x) => x.toLowerCase() === t.toLowerCase())) await persist([...list, t]);
  };
  const move = (i: number, j: number) => {
    if (j < 0 || j >= list.length || i === j) return;
    const next = [...list];
    const [x] = next.splice(i, 1);
    next.splice(j, 0, x);
    void persist(next);
  };

  return (
    <fieldset>
      <div className="mb-1.5 flex items-center justify-between">
        <legend className="text-[12.5px] font-semibold text-ink">Хийсэн ажил</legend>
        <button type="button" className="text-[12px] font-semibold text-brand hover:underline" onClick={() => setArrange((a) => !a)}>{arrange ? 'Болсон' : 'Байр солих / засах'}</button>
      </div>
      {arrange ? (
        <ul className="space-y-1">
          {list.map((t, i) => (
            <li key={t} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null) move(drag, i); setDrag(null); }}
              className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-line bg-card px-2 py-1.5 text-[12.5px] text-ink ${drag === i ? 'opacity-50' : ''}`}>
              <GripVertical size={14} className="cursor-grab text-subtle" aria-hidden />
              <span className="w-5 text-[11px] tabular-nums text-subtle">{i + 1}.</span>
              <span className="min-w-0 flex-1">{t}</span>
              <button type="button" disabled={busy || i === 0} onClick={() => move(i, i - 1)} className="rounded p-1 text-subtle hover:bg-hover hover:text-ink disabled:opacity-30" aria-label="Дээш"><ArrowUp size={14} /></button>
              <button type="button" disabled={busy || i === list.length - 1} onClick={() => move(i, i + 1)} className="rounded p-1 text-subtle hover:bg-hover hover:text-ink disabled:opacity-30" aria-label="Доош"><ArrowDown size={14} /></button>
              <button type="button" disabled={busy} onClick={() => { if (window.confirm(`«${t}»-г жагсаалтаас хасах уу?`)) void persist(list.filter((x) => x !== t)); }} className="rounded p-1 text-subtle hover:bg-hover hover:text-danger" aria-label="Хасах"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {shown.map((t) => {
            const on = value.includes(t);
            return (
              <label key={t} className={`flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border px-2.5 py-2 text-[12.5px] ${on ? 'border-brand bg-brand-soft text-ink' : 'border-line text-muted hover:text-ink'}`}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== t) : [...value, t])} />
                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${on ? 'border-brand bg-brand text-white' : 'border-[var(--border-strong)]'}`}>{on ? <Check size={12} strokeWidth={3} /> : null}</span>
                {t}
              </label>
            );
          })}
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <Input className="!h-9" placeholder="Шинэ ажил нэмэх — ж: Сплиттер сольсон" value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add(); } }} />
        <Button variant="outline" className="!h-9 shrink-0" icon={<Plus size={14} />} disabled={!adding.trim() || busy} onClick={add}>Нэмэх</Button>
      </div>
    </fieldset>
  );
}

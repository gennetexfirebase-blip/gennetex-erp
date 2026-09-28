import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle, Camera, CheckCircle2, ClipboardCheck, Download, Eye, FileText,
  HardHat, Plus, RefreshCw, ShieldCheck, X, XCircle,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, Input, Loading, PageHeader, Select, StatCard, Textarea } from '../components/ui';
import {
  AUDIT_LABELS, DEFAULT_HAZARDS, DEFAULT_PPE, INCIDENT_STATUS_LABELS, INCIDENT_TYPE_LABELS,
  SEVERITY_LABELS, STATUS_LABELS, STATUS_TONES, approvalBlock, downloadSafetyExcel,
  fetchSafetyBundle, maxRisk, printSafetyReport, reportIncident, reportSummary, resolveIncident,
  safetyError, saveAssessment, transitionAssessment, uploadEvidence, validateAssessment,
  type Assessment, type Hazard, type Incident, type IncidentSeverity, type IncidentType,
  type SafetyBundle, type WorkHeightStatus,
} from '../lib/workHeightSafety';

type Tab = 'assessments' | 'incidents' | 'reports';
const EMPTY_BUNDLE: SafetyBundle = { assessments: [], incidents: [], employees: [], locations: [] };

function localDateTime(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function dateOnly(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 10);
}

function monthStart() { return `${dateOnly().slice(0, 7)}-01`; }
function splitList(value: string) { return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean); }
function employeeName(employee: SafetyBundle['employees'][number]) { return [employee.last_name, employee.name].filter(Boolean).join(' ').trim() || employee.email || 'Ажилтан'; }

function blankAssessment(bundle: SafetyBundle): Assessment {
  const employee = bundle.employees.find((item) => item.user_id);
  const location = bundle.locations[0];
  const start = new Date(); const end = new Date(start.getTime() + 2 * 60 * 60_000);
  return {
    employee_id: employee?.user_id || '', employee_name: employee ? employeeName(employee) : '',
    employee_code: employee?.record_id || null, department_id: employee?.department_id || null,
    location_id: location?.id || null, location_name: location?.name || '', latitude: location?.latitude || null,
    longitude: location?.longitude || null, height_m: 2, work_type: '', starts_at: localDateTime(start),
    ends_at: localDateTime(end), weather: '', partner_ids: [], partner_names: [], equipment: [], notes: '',
    status: 'draft', hazards: DEFAULT_HAZARDS.map((item, index) => ({ ...item, sort_order: index })),
    ppe_checks: DEFAULT_PPE.map((item) => ({ ...item })), evidence: [], audit: [], approvals: [],
  };
}

function blankIncident(): Omit<Incident, 'evidence'> {
  return { assessment_id: null, incident_type: 'unsafe_condition', severity: 'medium', description: '', location_name: '', occurred_at: localDateTime() };
}

function Dialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-3 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`surface my-auto w-full ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-[rgba(12,18,30,.96)] px-5 py-4">
          <h2 className="text-xl font-semibold text-ink">{title}</h2>
          <button type="button" className="focus-ring rounded-full p-2 text-muted hover:bg-hover hover:text-ink" onClick={onClose} aria-label="Хаах"><X size={20} /></button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, required = false }: { label: string; children: ReactNode; required?: boolean }) {
  return <label className="block"><span className="mb-1.5 block text-[12px] font-semibold text-muted">{label}{required ? <span className="text-danger"> *</span> : null}</span>{children}</label>;
}

function RiskPill({ score }: { score: number }) {
  const tone = score >= 15 ? 'danger' : score >= 8 ? 'warning' : 'success';
  return <Badge tone={tone}>{score} · {score >= 15 ? 'Өндөр' : score >= 8 ? 'Дунд' : 'Бага'}</Badge>;
}

export default function WorkHeightSafetyPage() {
  const [bundle, setBundle] = useState<SafetyBundle>(EMPTY_BUNDLE);
  const [tab, setTab] = useState<Tab>('assessments');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(dateOnly());
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WorkHeightStatus>('all');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [assessmentForm, setAssessmentForm] = useState<Assessment | null>(null);
  const [assessmentFiles, setAssessmentFiles] = useState<File[]>([]);
  const [incidentForm, setIncidentForm] = useState<Omit<Incident, 'evidence'> | null>(null);
  const [incidentFiles, setIncidentFiles] = useState<File[]>([]);
  const [decisionNote, setDecisionNote] = useState('');
  const [resolution, setResolution] = useState('');

  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try { setBundle(await fetchSafetyBundle()); }
    catch (loadError) { setError(safetyError(loadError)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const filteredAssessments = useMemo(() => bundle.assessments.filter((item) => {
    const date = dateOnly(new Date(item.starts_at));
    return date >= from && date <= to
      && (!employeeFilter || item.employee_id === employeeFilter)
      && (!locationFilter || item.location_id === locationFilter)
      && (statusFilter === 'all' || item.status === statusFilter);
  }), [bundle.assessments, employeeFilter, from, locationFilter, statusFilter, to]);

  const filteredIncidents = useMemo(() => bundle.incidents.filter((item) => {
    const date = dateOnly(new Date(item.occurred_at));
    const employee = bundle.employees.find((row) => row.user_id === employeeFilter);
    return date >= from && date <= to
      && (!employeeFilter || item.reporter_id === employeeFilter || item.reporter_name === (employee ? employeeName(employee) : ''))
      && (!locationFilter || item.location_name === bundle.locations.find((row) => row.id === locationFilter)?.name);
  }), [bundle.employees, bundle.incidents, bundle.locations, employeeFilter, from, locationFilter, to]);

  const summary = useMemo(() => reportSummary(filteredAssessments, filteredIncidents), [filteredAssessments, filteredIncidents]);
  const selectedAssessment = bundle.assessments.find((item) => item.id === selectedAssessmentId) || null;
  const selectedIncident = bundle.incidents.find((item) => item.id === selectedIncidentId) || null;

  const run = async (task: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try { await task(); await reload(); if (success) window.alert(success); }
    catch (actionError) { window.alert(safetyError(actionError)); }
    finally { setBusy(false); }
  };

  const submitAssessment = async () => {
    if (!assessmentForm) return;
    const errors = validateAssessment(assessmentForm);
    if (errors.length) return window.alert(errors.join('\n'));
    setBusy(true);
    try {
      const id = await saveAssessment(assessmentForm);
      await Promise.all(assessmentFiles.map((file) => uploadEvidence(file, { assessmentId: id, type: 'ppe', caption: 'Admin web фото нотолгоо' })));
      setAssessmentForm(null); setAssessmentFiles([]); setSelectedAssessmentId(id);
      await reload();
    } catch (saveError) { window.alert(safetyError(saveError)); }
    finally { setBusy(false); }
  };

  const changeStatus = async (action: string, noteRequired = false) => {
    if (!selectedAssessment?.id) return;
    if (noteRequired && !decisionNote.trim()) return window.alert('Шалтгаан, тайлбар оруулна уу.');
    await run(() => transitionAssessment(selectedAssessment.id!, action, decisionNote), 'Төлөв амжилттай шинэчлэгдлээ.');
    setDecisionNote('');
  };

  const submitIncident = async () => {
    if (!incidentForm) return;
    if (!incidentForm.description.trim() || !incidentForm.location_name.trim()) return window.alert('Тайлбар болон байршил шаардлагатай.');
    setBusy(true);
    try {
      const id = await reportIncident(incidentForm);
      await Promise.all(incidentFiles.map((file) => uploadEvidence(file, { incidentId: id, assessmentId: incidentForm.assessment_id || undefined, type: 'incident', caption: incidentForm.description.slice(0, 120) })));
      setIncidentForm(null); setIncidentFiles([]); setSelectedIncidentId(id);
      await reload();
    } catch (incidentError) { window.alert(safetyError(incidentError)); }
    finally { setBusy(false); }
  };

  const finishIncident = async (close: boolean) => {
    if (!selectedIncident?.id || !resolution.trim()) return window.alert('Авсан арга хэмжээг оруулна уу.');
    await run(() => resolveIncident(selectedIncident.id!, resolution.trim(), close), close ? 'Зөрчлийг хаалаа.' : 'Зөрчлийг шийдвэрлэсэн төлөвт орууллаа.');
    setResolution('');
  };

  return (
    <>
      <PageHeader
        title="Өндөрт ажиллах ХАБЭА"
        crumb="Эрсдэлийн үнэлгээ · зөвшөөрөл · осол, зөрчил"
        actions={<><Button variant="outline" icon={<RefreshCw size={15} />} onClick={reload} disabled={loading}>Шинэчлэх</Button><Button icon={<Plus size={15} />} onClick={() => setAssessmentForm(blankAssessment(bundle))}>Шинэ үнэлгээ</Button></>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Нийт үнэлгээ" value={summary.total} note={`${from} — ${to}`} />
        <StatCard label="Зөвшөөрсөн" value={summary.approved} note="Удирдлага зөвшөөрсөн" />
        <StatCard label="Өндөр эрсдэл" value={summary.highRisk} note="15 ба түүнээс дээш" />
        <StatCard label="Шийдээгүй зөрчил" value={summary.unresolvedIncidents} note="Нээлттэй / шалгаж буй" />
        <StatCard label="PPE бүрэн" value={`${summary.ppeComplete}/${summary.total}`} note="Хамгаалалтын шалгалт" />
      </div>

      <Card className="mb-5" bodyClassName="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Эхлэх өдөр"><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
          <Field label="Дуусах өдөр"><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field>
          <Field label="Ажилтан"><Select className="w-full" value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}><option value="">Бүх ажилтан</option>{bundle.employees.filter((item) => item.user_id).map((item) => <option key={item.record_id} value={item.user_id || ''}>{employeeName(item)}</option>)}</Select></Field>
          <Field label="Байршил"><Select className="w-full" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}><option value="">Бүх байршил</option>{bundle.locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
          <Field label="Төлөв"><Select className="w-full" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">Бүх төлөв</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></Field>
        </div>
      </Card>

      <div className="mb-5 flex gap-1 rounded-[var(--radius)] border border-line bg-card p-1">
        {([['assessments', 'Эрсдэлийн үнэлгээ'], ['incidents', 'Осол, зөрчил'], ['reports', 'Тайлан']] as [Tab, string][]).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`focus-ring flex-1 rounded-[var(--radius-sm)] px-3 py-2.5 text-[13px] font-semibold ${tab === key ? 'bg-brand text-white' : 'text-muted hover:bg-hover hover:text-ink'}`}>{label}</button>
        ))}
      </div>

      {loading ? <Card><Loading text="ХАБЭА мэдээлэл ачаалж байна…" /></Card> : error ? <ErrorState text={error} onRetry={reload} /> : null}

      {!loading && !error && tab === 'assessments' ? (
        <Card title="Эрсдэлийн үнэлгээ" icon={<ClipboardCheck size={17} />} bodyClassName="p-0">
          {!filteredAssessments.length ? <EmptyState text="Сонгосон шүүлтүүрт үнэлгээ алга." /> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-[13px]"><thead className="border-b border-line bg-card2 text-[11px] uppercase tracking-wide text-subtle"><tr><th className="px-5 py-3">Ажилтан / ажил</th><th className="px-4 py-3">Байршил</th><th className="px-4 py-3">Хугацаа</th><th className="px-4 py-3">Өндөр</th><th className="px-4 py-3">Эрсдэл</th><th className="px-4 py-3">PPE</th><th className="px-4 py-3">Төлөв</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-line">{filteredAssessments.map((item) => <tr key={item.id} className="hover:bg-hover"><td className="px-5 py-4"><p className="font-semibold text-ink">{item.employee_name}</p><p className="mt-1 text-[12px] text-muted">{item.work_type}</p></td><td className="px-4 py-4 text-muted">{item.location_name}</td><td className="px-4 py-4 text-muted">{new Date(item.starts_at).toLocaleString('mn-MN')}</td><td className="px-4 py-4 text-ink">{item.height_m} м</td><td className="px-4 py-4"><RiskPill score={Number(item.max_risk_score || maxRisk(item.hazards))} /></td><td className="px-4 py-4"><Badge tone={item.ppe_complete ? 'success' : 'danger'}>{item.ppe_complete ? 'Бүрэн' : 'Дутуу'}</Badge></td><td className="px-4 py-4"><Badge tone={STATUS_TONES[item.status]}>{STATUS_LABELS[item.status]}</Badge></td><td className="px-4 py-4"><Button variant="ghost" icon={<Eye size={15} />} onClick={() => setSelectedAssessmentId(item.id || null)}>Харах</Button></td></tr>)}</tbody></table></div>
          )}
        </Card>
      ) : null}

      {!loading && !error && tab === 'incidents' ? (
        <Card title="Осол, зөрчил" icon={<AlertTriangle size={17} />} actions={<Button variant="danger" icon={<Plus size={15} />} onClick={() => setIncidentForm(blankIncident())}>Зөрчил бүртгэх</Button>} bodyClassName="p-0">
          {!filteredIncidents.length ? <EmptyState text="Сонгосон шүүлтүүрт осол, зөрчил алга." /> : <div className="divide-y divide-line">{filteredIncidents.map((item) => <button type="button" key={item.id} onClick={() => setSelectedIncidentId(item.id || null)} className="focus-ring flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-hover"><span className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${['serious', 'critical'].includes(item.severity) ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning'}`}><AlertTriangle size={18} /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="text-ink">{INCIDENT_TYPE_LABELS[item.incident_type]}</strong><Badge tone={['serious', 'critical'].includes(item.severity) ? 'danger' : item.severity === 'medium' ? 'warning' : 'success'}>{SEVERITY_LABELS[item.severity]}</Badge><Badge tone={['resolved', 'closed'].includes(item.status || '') ? 'success' : 'warning'}>{INCIDENT_STATUS_LABELS[item.status || 'open']}</Badge></span><span className="mt-1 block text-[13px] text-muted">{item.location_name} · {new Date(item.occurred_at).toLocaleString('mn-MN')}</span><span className="mt-2 line-clamp-2 block text-[13px] text-ink">{item.description}</span></span><Eye className="mt-2 shrink-0 text-subtle" size={17} /></button>)}</div>}
        </Card>
      ) : null}

      {!loading && !error && tab === 'reports' ? (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <Card title="Экспортлох тайлан" icon={<FileText size={17} />}>
            <p className="mb-4 text-[13px] leading-6 text-muted">Одоогийн өдөр, ажилтан, байршил, төлөвийн шүүлтүүрээр {filteredAssessments.length} үнэлгээ, {filteredIncidents.length} зөрчил экспортлогдоно.</p>
            <div className="flex flex-wrap gap-2"><Button icon={<FileText size={15} />} onClick={() => { try { printSafetyReport(filteredAssessments, filteredIncidents, `${from} — ${to} өндөрт ажиллах тайлан`); } catch (printError) { window.alert(safetyError(printError)); } }}>PDF / хэвлэх</Button><Button variant="success" icon={<Download size={15} />} onClick={() => run(() => downloadSafetyExcel(filteredAssessments, filteredIncidents, from, to))} disabled={busy}>Excel татах</Button></div>
          </Card>
          <Card title="Хамгаалалтын шалгалт" icon={<ShieldCheck size={17} />}><p className="text-4xl font-semibold text-success">{summary.ppeComplete} / {summary.total}</p><p className="mt-2 text-[13px] text-muted">PPE checklist бүрэн үнэлгээ</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-card2"><span className="block h-full rounded-full bg-success" style={{ width: `${summary.total ? (summary.ppeComplete / summary.total) * 100 : 0}%` }} /></div></Card>
        </div>
      ) : null}

      {assessmentForm ? (
        <Dialog title={assessmentForm.id ? 'Эрсдэлийн үнэлгээ засах' : 'Шинэ эрсдэлийн үнэлгээ'} onClose={() => { setAssessmentForm(null); setAssessmentFiles([]); }} wide>
          <AssessmentEditor value={assessmentForm} onChange={setAssessmentForm} bundle={bundle} files={assessmentFiles} setFiles={setAssessmentFiles} />
          <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setAssessmentForm(null)}>Болих</Button><Button icon={<ShieldCheck size={15} />} onClick={submitAssessment} disabled={busy}>{busy ? 'Хадгалж байна…' : 'Ноорог хадгалах'}</Button></div>
        </Dialog>
      ) : null}

      {selectedAssessment ? (
        <Dialog title="Өндөрт ажиллах зөвшөөрөл" onClose={() => { setSelectedAssessmentId(null); setDecisionNote(''); }} wide>
          <AssessmentDetail assessment={selectedAssessment} note={decisionNote} setNote={setDecisionNote} busy={busy} onAction={changeStatus} onEdit={() => setAssessmentForm(structuredClone(selectedAssessment))} onIncident={() => setIncidentForm({ ...blankIncident(), assessment_id: selectedAssessment.id, location_name: selectedAssessment.location_name })} />
        </Dialog>
      ) : null}

      {incidentForm ? (
        <Dialog title="Осол, зөрчил бүртгэх" onClose={() => { setIncidentForm(null); setIncidentFiles([]); }}>
          <IncidentEditor value={incidentForm} onChange={setIncidentForm} bundle={bundle} files={incidentFiles} setFiles={setIncidentFiles} />
          <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setIncidentForm(null)}>Болих</Button><Button variant={['serious', 'critical'].includes(incidentForm.severity) ? 'danger' : 'primary'} icon={<AlertTriangle size={15} />} onClick={submitIncident} disabled={busy}>{busy ? 'Бүртгэж байна…' : 'Зөрчил бүртгэх'}</Button></div>
        </Dialog>
      ) : null}

      {selectedIncident ? (
        <Dialog title="Осол, зөрчлийн дэлгэрэнгүй" onClose={() => { setSelectedIncidentId(null); setResolution(''); }}>
          <IncidentDetail incident={selectedIncident} resolution={resolution} setResolution={setResolution} busy={busy} onResolve={finishIncident} />
        </Dialog>
      ) : null}
    </>
  );
}

function AssessmentEditor({ value, onChange, bundle, files, setFiles }: { value: Assessment; onChange: (value: Assessment) => void; bundle: SafetyBundle; files: File[]; setFiles: (files: File[]) => void }) {
  const patch = (next: Partial<Assessment>) => onChange({ ...value, ...next });
  const patchHazard = (index: number, next: Partial<Hazard>) => patch({ hazards: value.hazards.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item) });
  const risk = maxRisk(value.hazards);
  return <div className="space-y-6">
    <section><h3 className="mb-3 font-semibold text-ink">1. Ажил ба байршил</h3><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      <Field label="Ажилтан" required><Select className="w-full" value={value.employee_id} onChange={(event) => { const employee = bundle.employees.find((item) => item.user_id === event.target.value); patch({ employee_id: event.target.value, employee_name: employee ? employeeName(employee) : '', employee_code: employee?.record_id || null, department_id: employee?.department_id || null }); }}><option value="">Сонгох</option>{bundle.employees.filter((item) => item.user_id).map((item) => <option key={item.record_id} value={item.user_id || ''}>{employeeName(item)}</option>)}</Select></Field>
      <Field label="Ажилтны ID"><Input value={value.employee_code || ''} onChange={(event) => patch({ employee_code: event.target.value })} /></Field>
      <Field label="Байршил" required><Select className="w-full" value={value.location_id || ''} onChange={(event) => { const location = bundle.locations.find((item) => item.id === event.target.value); patch({ location_id: event.target.value || null, location_name: location?.name || '', latitude: location?.latitude || null, longitude: location?.longitude || null }); }}><option value="">Сонгох</option>{bundle.locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
      <Field label="Ажиллах өндөр (метр)" required><Input type="number" min="0.1" max="1000" step="0.1" value={value.height_m} onChange={(event) => patch({ height_m: Number(event.target.value) })} /></Field>
      <Field label="Ажлын төрөл" required><Input value={value.work_type} onChange={(event) => patch({ work_type: event.target.value })} placeholder="Кабель татах, камер суурилуулах…" /></Field>
      <Field label="Цаг агаар" required><Input value={value.weather} onChange={(event) => patch({ weather: event.target.value })} placeholder="Цэлмэг, салхи 3 м/с…" /></Field>
      <Field label="Эхлэх хугацаа" required><Input type="datetime-local" value={localDateTime(new Date(value.starts_at))} onChange={(event) => patch({ starts_at: event.target.value })} /></Field>
      <Field label="Дуусах хугацаа" required><Input type="datetime-local" value={localDateTime(new Date(value.ends_at))} onChange={(event) => patch({ ends_at: event.target.value })} /></Field>
      <Field label="Хамтрагчид"><Input value={value.partner_names.join(', ')} onChange={(event) => patch({ partner_names: splitList(event.target.value) })} placeholder="Нэрсийг таслалаар" /></Field>
      <Field label="Тоног төхөөрөмж"><Input value={value.equipment.join(', ')} onChange={(event) => patch({ equipment: splitList(event.target.value) })} placeholder="Шат, өргөгч, дрилл…" /></Field>
      <div className="md:col-span-2"><Field label="Нэмэлт тайлбар"><Textarea rows={3} value={value.notes || ''} onChange={(event) => patch({ notes: event.target.value })} /></Field></div>
    </div></section>

    <section><div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-semibold text-ink">2. Аюулын үнэлгээ</h3><RiskPill score={risk} /></div><div className="space-y-3">{value.hazards.map((hazard, index) => <div key={`${hazard.hazard_type}-${index}`} className="rounded-[var(--radius)] border border-line bg-card2 p-4"><div className="mb-3 flex items-center justify-between"><strong className="text-[13px] text-ink">Аюул {index + 1}</strong><div className="flex items-center gap-2"><RiskPill score={hazard.likelihood * hazard.consequence} /><button type="button" className="text-danger" aria-label="Аюул хасах" onClick={() => patch({ hazards: value.hazards.filter((_, itemIndex) => itemIndex !== index) })}><X size={16} /></button></div></div><div className="grid gap-3 lg:grid-cols-[1fr_120px_120px_1.4fr]"><Field label="Аюул"><Input value={hazard.description} onChange={(event) => patchHazard(index, { description: event.target.value })} /></Field><Field label="Магадлал 1–5"><Select className="w-full" value={hazard.likelihood} onChange={(event) => patchHazard(index, { likelihood: Number(event.target.value) })}>{[1,2,3,4,5].map((score) => <option key={score}>{score}</option>)}</Select></Field><Field label="Үр дагавар 1–5"><Select className="w-full" value={hazard.consequence} onChange={(event) => patchHazard(index, { consequence: Number(event.target.value) })}>{[1,2,3,4,5].map((score) => <option key={score}>{score}</option>)}</Select></Field><Field label="Хяналтын арга хэмжээ"><Input value={hazard.control_measure} onChange={(event) => patchHazard(index, { control_measure: event.target.value })} /></Field></div></div>)}</div><Button className="mt-3" variant="outline" icon={<Plus size={15} />} onClick={() => patch({ hazards: [...value.hazards, { hazard_type: 'other', description: '', likelihood: 1, consequence: 1, control_measure: '', sort_order: value.hazards.length }] })}>Аюул нэмэх</Button></section>

    <section><h3 className="mb-3 font-semibold text-ink">3. Хамгаалах хэрэгслийн checklist</h3><div className="grid gap-2 md:grid-cols-2">{value.ppe_checks.map((item, index) => <label key={item.item_key} className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border p-3 ${item.passed ? 'border-success/40 bg-success-soft' : 'border-line bg-card2'}`}><input type="checkbox" checked={item.passed} onChange={(event) => patch({ ppe_checks: value.ppe_checks.map((row, rowIndex) => rowIndex === index ? { ...row, passed: event.target.checked } : row) })} className="h-4 w-4 accent-[var(--success)]" /><span className="text-[13px] font-medium text-ink">{item.item_label}</span>{item.required ? <span className="ml-auto text-danger">*</span> : null}</label>)}</div></section>

    <section><h3 className="mb-3 font-semibold text-ink">4. Фото нотолгоо</h3><label className="flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed border-line bg-card2 px-4 py-6 text-[13px] text-muted hover:border-brand hover:text-brand"><Camera size={18} />Зураг сонгох<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files || []))} /></label>{files.length ? <p className="mt-2 text-[12px] text-muted">{files.map((file) => file.name).join(', ')}</p> : null}</section>
  </div>;
}

function AssessmentDetail({ assessment, note, setNote, busy, onAction, onEdit, onIncident }: { assessment: Assessment; note: string; setNote: (value: string) => void; busy: boolean; onAction: (action: string, noteRequired?: boolean) => void; onEdit: () => void; onIncident: () => void }) {
  const block = approvalBlock(assessment); const editable = ['draft', 'changes_required'].includes(assessment.status);
  return <div className="space-y-5"><div className="grid gap-5 lg:grid-cols-[1fr_.7fr]"><Card title={assessment.work_type} icon={<HardHat size={17} />}><div className="mb-4 flex flex-wrap gap-2"><Badge tone={STATUS_TONES[assessment.status]}>{STATUS_LABELS[assessment.status]}</Badge><RiskPill score={Number(assessment.max_risk_score || maxRisk(assessment.hazards))} /><Badge tone={assessment.ppe_complete ? 'success' : 'danger'}>PPE {assessment.ppe_complete ? 'бүрэн' : 'дутуу'}</Badge></div><dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2 text-[13px]"><dt className="text-muted">Ажилтан</dt><dd className="text-ink">{assessment.employee_name} {assessment.employee_code ? `· ${assessment.employee_code}` : ''}</dd><dt className="text-muted">Байршил</dt><dd className="text-ink">{assessment.location_name}</dd><dt className="text-muted">Өндөр</dt><dd className="text-ink">{assessment.height_m} метр</dd><dt className="text-muted">Хугацаа</dt><dd className="text-ink">{new Date(assessment.starts_at).toLocaleString('mn-MN')} — {new Date(assessment.ends_at).toLocaleString('mn-MN')}</dd><dt className="text-muted">Цаг агаар</dt><dd className="text-ink">{assessment.weather}</dd><dt className="text-muted">Хамтрагч</dt><dd className="text-ink">{assessment.partner_names.join(', ') || '—'}</dd><dt className="text-muted">Төхөөрөмж</dt><dd className="text-ink">{assessment.equipment.join(', ') || '—'}</dd></dl>{editable ? <Button className="mt-4" variant="outline" onClick={onEdit}>Үнэлгээ засах</Button> : null}</Card><Card title="Зөвшөөрөл ба үйлдэл" icon={<ShieldCheck size={17} />}>{block ? <div className="mb-4 rounded-[var(--radius-sm)] border border-danger/30 bg-danger-soft p-3 text-[13px] text-danger"><strong className="block">ЗӨВШӨӨРӨЛ ХААЛТТАЙ</strong><span className="mt-1 block text-ink">{block}</span></div> : null}<Field label="Шийдвэрийн тайлбар"><Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Засвар, зогсоох шалтгаан…" /></Field><div className="mt-3 grid gap-2">{['draft','changes_required'].includes(assessment.status) ? <Button onClick={() => onAction('submit')} disabled={busy}>Үнэлгээнд илгээх</Button> : null}{assessment.status === 'pending_review' ? <Button icon={<ShieldCheck size={15} />} onClick={() => onAction('hse_approve')} disabled={busy || Boolean(block)}>ХАБЭА баталгаажуулах</Button> : null}{['pending_review','hse_approved'].includes(assessment.status) ? <Button variant="outline" onClick={() => onAction('request_changes', true)} disabled={busy}>Засвар буцаах</Button> : null}{assessment.status === 'hse_approved' ? <Button variant="success" onClick={() => onAction('management_approve')} disabled={busy || Boolean(block)}>Удирдлага зөвшөөрөх</Button> : null}{assessment.status === 'management_approved' ? <Button variant="success" onClick={() => onAction('start')} disabled={busy || Boolean(block)}>Ажил эхлүүлэх</Button> : null}{assessment.status === 'in_progress' ? <Button variant="success" onClick={() => onAction('complete')} disabled={busy}>Ажил дуусгах</Button> : null}{!['completed','stopped'].includes(assessment.status) ? <Button variant="danger" onClick={() => onAction('stop', true)} disabled={busy}>Ажил зогсоох</Button> : null}<Button variant="outline" icon={<AlertTriangle size={15} />} onClick={onIncident}>Осол, зөрчил бүртгэх</Button></div></Card></div>
    <Card title="Аюул ба эрсдэлийн оноо"><div className="grid gap-3 md:grid-cols-2">{assessment.hazards.map((item, index) => <div key={item.id || index} className="rounded-[var(--radius-sm)] border border-line bg-card2 p-4"><div className="flex items-start justify-between gap-2"><strong className="text-[13px] text-ink">{index + 1}. {item.description}</strong><RiskPill score={Number(item.risk_score || item.likelihood * item.consequence)} /></div><p className="mt-2 text-[12px] text-muted">Магадлал {item.likelihood} × Үр дагавар {item.consequence}</p><p className="mt-2 text-[13px] text-ink">Хяналт: {item.control_measure}</p></div>)}</div></Card>
    <Card title="Хамгаалах хэрэгсэл"><div className="grid gap-2 md:grid-cols-2">{assessment.ppe_checks.map((item) => <div key={item.item_key} className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-card2 p-3">{item.passed ? <CheckCircle2 className="text-success" size={17} /> : <XCircle className="text-danger" size={17} />}<span className="text-[13px] text-ink">{item.item_label}</span></div>)}</div></Card>
    {assessment.evidence.length ? <Card title="Фото нотолгоо" icon={<Camera size={17} />}><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{assessment.evidence.map((item) => item.signed_url ? <a key={item.id} href={item.signed_url} target="_blank" rel="noreferrer"><img src={item.signed_url} alt={item.caption || 'Фото нотолгоо'} className="aspect-square w-full rounded-[var(--radius-sm)] object-cover" loading="lazy" /></a> : null)}</div></Card> : null}
    <Card title="Audit trail"><div className="space-y-3">{assessment.audit.length ? assessment.audit.map((item) => <div key={item.id} className="border-l-2 border-brand pl-3"><p className="text-[13px] font-semibold text-ink">{item.actor_name} · {AUDIT_LABELS[item.action] || item.action}</p><p className="mt-1 text-[12px] text-muted">{new Date(item.created_at).toLocaleString('mn-MN')}{item.to_status ? ` · ${STATUS_LABELS[item.to_status]}` : ''}</p>{item.note ? <p className="mt-1 text-[13px] text-ink">{item.note}</p> : null}</div>) : <EmptyState text="Түүх байхгүй." />}</div></Card>
  </div>;
}

function IncidentEditor({ value, onChange, bundle, files, setFiles }: { value: Omit<Incident, 'evidence'>; onChange: (value: Omit<Incident, 'evidence'>) => void; bundle: SafetyBundle; files: File[]; setFiles: (files: File[]) => void }) {
  const patch = (next: Partial<Omit<Incident, 'evidence'>>) => onChange({ ...value, ...next });
  return <div className="space-y-4"><Field label="Холбогдох үнэлгээ"><Select className="w-full" value={value.assessment_id || ''} onChange={(event) => { const assessment = bundle.assessments.find((item) => item.id === event.target.value); patch({ assessment_id: event.target.value || null, location_name: assessment?.location_name || value.location_name }); }}><option value="">Тусдаа зөрчил</option>{bundle.assessments.map((item) => <option key={item.id} value={item.id}>{item.employee_name} · {item.location_name} · {item.work_type}</option>)}</Select></Field><div className="grid gap-3 md:grid-cols-2"><Field label="Төрөл" required><Select className="w-full" value={value.incident_type} onChange={(event) => patch({ incident_type: event.target.value as IncidentType })}>{Object.entries(INCIDENT_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></Field><Field label="Ноцтой байдал" required><Select className="w-full" value={value.severity} onChange={(event) => patch({ severity: event.target.value as IncidentSeverity })}>{Object.entries(SEVERITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></Field><Field label="Байршил" required><Input value={value.location_name} onChange={(event) => patch({ location_name: event.target.value })} /></Field><Field label="Огноо, цаг" required><Input type="datetime-local" value={localDateTime(new Date(value.occurred_at))} onChange={(event) => patch({ occurred_at: event.target.value })} /></Field></div><Field label="Тайлбар" required><Textarea rows={5} value={value.description} onChange={(event) => patch({ description: event.target.value })} placeholder="Юу болсон, ямар аюул илэрсэн…" /></Field><Field label="Фото нотолгоо"><label className="flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-line bg-card2 p-5 text-[13px] text-muted"><Camera size={17} />Зураг сонгох<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files || []))} /></label></Field>{files.length ? <p className="text-[12px] text-muted">{files.map((file) => file.name).join(', ')}</p> : null}{['serious','critical'].includes(value.severity) ? <div className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger-soft p-3 text-[13px] text-danger">Ноцтой зөрчлийн мэдэгдэл админуудад илгээгдэж, холбогдох ажил автоматаар зогсоно.</div> : null}</div>;
}

function IncidentDetail({ incident, resolution, setResolution, busy, onResolve }: { incident: Incident; resolution: string; setResolution: (value: string) => void; busy: boolean; onResolve: (close: boolean) => void }) {
  const open = !['resolved', 'closed'].includes(incident.status || 'open');
  return <div className="space-y-5"><Card title={INCIDENT_TYPE_LABELS[incident.incident_type]} icon={<AlertTriangle size={17} />}><div className="mb-3 flex flex-wrap gap-2"><Badge tone={['serious','critical'].includes(incident.severity) ? 'danger' : incident.severity === 'medium' ? 'warning' : 'success'}>{SEVERITY_LABELS[incident.severity]}</Badge><Badge tone={open ? 'warning' : 'success'}>{INCIDENT_STATUS_LABELS[incident.status || 'open']}</Badge></div><p className="text-[13px] leading-6 text-ink">{incident.description}</p><p className="mt-3 text-[12px] text-muted">{incident.location_name} · {new Date(incident.occurred_at).toLocaleString('mn-MN')} · {incident.reporter_name || 'Ажилтан'}</p></Card>{incident.evidence.length ? <Card title="Фото нотолгоо"><div className="grid grid-cols-2 gap-3 md:grid-cols-3">{incident.evidence.map((item) => item.signed_url ? <a key={item.id} href={item.signed_url} target="_blank" rel="noreferrer"><img src={item.signed_url} alt={item.caption || 'Зөрчлийн зураг'} loading="lazy" className="aspect-square w-full rounded-[var(--radius-sm)] object-cover" /></a> : null)}</div></Card> : null}{incident.resolution && !open ? <Card title="Шийдвэрлэсэн арга хэмжээ"><p className="text-[13px] leading-6 text-ink">{incident.resolution}</p></Card> : null}{open ? <Card title="Зөрчил шийдвэрлэх"><Field label="Авсан арга хэмжээ" required><Textarea rows={5} value={resolution} onChange={(event) => setResolution(event.target.value)} placeholder="Шалтгаан, засвар, дахин гарахаас сэргийлсэн арга хэмжээ…" /></Field><div className="mt-3 flex flex-wrap gap-2"><Button icon={<CheckCircle2 size={15} />} onClick={() => onResolve(false)} disabled={busy}>Шийдвэрлэсэн</Button><Button variant="success" onClick={() => onResolve(true)} disabled={busy}>Хаах</Button></div></Card> : null}</div>;
}

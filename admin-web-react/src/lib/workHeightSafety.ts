import { supabase } from './supabase';
import { fetchEmployees, type Employee } from './data';

export type WorkHeightStatus =
  | 'draft' | 'pending_review' | 'changes_required' | 'hse_approved'
  | 'management_approved' | 'in_progress' | 'completed' | 'stopped';
export type IncidentType = 'unsafe_condition' | 'near_miss' | 'accident';
export type IncidentSeverity = 'low' | 'medium' | 'serious' | 'critical';

export type Hazard = {
  id?: string;
  hazard_type: string;
  description: string;
  likelihood: number;
  consequence: number;
  risk_score?: number;
  control_measure: string;
  sort_order?: number;
};

export type PpeCheck = {
  id?: string;
  item_key: string;
  item_label: string;
  required: boolean;
  passed: boolean;
  note?: string | null;
};

export type Evidence = {
  id: string;
  assessment_id?: string | null;
  incident_id?: string | null;
  evidence_type: 'ppe' | 'site' | 'incident' | 'resolution';
  storage_path: string;
  caption?: string | null;
  signed_url?: string;
};

export type AuditRow = {
  id: string;
  actor_name: string;
  action: string;
  from_status?: WorkHeightStatus | null;
  to_status?: WorkHeightStatus | null;
  note?: string | null;
  created_at: string;
};

export type ApprovalRow = {
  id: string;
  stage: 'hse' | 'management';
  decision: 'approved' | 'changes_required' | 'stopped';
  approver_name: string;
  note?: string | null;
  created_at: string;
};

export type Assessment = {
  id?: string;
  employee_id: string;
  employee_name: string;
  employee_code?: string | null;
  department_id?: string | null;
  location_id?: string | null;
  location_name: string;
  latitude?: number | null;
  longitude?: number | null;
  height_m: number;
  work_type: string;
  starts_at: string;
  ends_at: string;
  weather: string;
  partner_ids: string[];
  partner_names: string[];
  equipment: string[];
  notes?: string | null;
  status: WorkHeightStatus;
  max_risk_score?: number;
  ppe_complete?: boolean;
  created_by?: string;
  created_at?: string;
  hazards: Hazard[];
  ppe_checks: PpeCheck[];
  evidence: Evidence[];
  audit: AuditRow[];
  approvals: ApprovalRow[];
};

export type Incident = {
  id?: string;
  assessment_id?: string | null;
  reporter_id?: string;
  reporter_name?: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  location_name: string;
  latitude?: number | null;
  longitude?: number | null;
  occurred_at: string;
  status?: 'open' | 'investigating' | 'resolved' | 'closed';
  resolution?: string | null;
  evidence: Evidence[];
};

export type LocationOption = { id: string; name: string; latitude?: number | null; longitude?: number | null };
export type SafetyBundle = { assessments: Assessment[]; incidents: Incident[]; employees: Employee[]; locations: LocationOption[] };

export const STATUS_LABELS: Record<WorkHeightStatus, string> = {
  draft: 'Ноорог', pending_review: 'Үнэлгээ хүлээгдэж байна', changes_required: 'Засвар шаардлагатай',
  hse_approved: 'ХАБЭА баталгаажуулсан', management_approved: 'Удирдлага зөвшөөрсөн',
  in_progress: 'Ажил үргэлжилж байна', completed: 'Ажил дууссан', stopped: 'Ажил зогсоосон',
};

export const STATUS_TONES: Record<WorkHeightStatus, 'neutral' | 'warning' | 'danger' | 'brand' | 'success'> = {
  draft: 'neutral', pending_review: 'warning', changes_required: 'danger', hse_approved: 'brand',
  management_approved: 'success', in_progress: 'brand', completed: 'success', stopped: 'danger',
};

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  unsafe_condition: 'Аюултай нөхцөл', near_miss: 'Осол дөхсөн', accident: 'Осол',
};
export const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  low: 'Бага', medium: 'Дунд', serious: 'Ноцтой', critical: 'Маш ноцтой',
};
export const INCIDENT_STATUS_LABELS: Record<string, string> = {
  open: 'Нээлттэй', investigating: 'Шалгаж байна', resolved: 'Шийдвэрлэсэн', closed: 'Хаасан',
};
export const AUDIT_LABELS: Record<string, string> = {
  created: 'Үнэлгээ үүсгэсэн', updated: 'Үнэлгээ шинэчилсэн', submit: 'Үнэлгээнд илгээсэн',
  request_changes: 'Засвар шаардсан', hse_approve: 'ХАБЭА баталгаажуулсан',
  management_approve: 'Удирдлага зөвшөөрсөн', start: 'Ажил эхлүүлсэн', complete: 'Ажил дуусгасан',
  stop: 'Ажил зогсоосон', incident_auto_stop: 'Ноцтой зөрчлөөр автоматаар зогсоосон',
};

export const DEFAULT_HAZARDS: Hazard[] = [
  { hazard_type: 'fall', description: 'Өндрөөс унах', likelihood: 3, consequence: 5, control_measure: 'Хамгаалах бүс, амь шугам, найдвартай бэхэлгээ ашиглах' },
  { hazard_type: 'falling_object', description: 'Дээрээс эд зүйл унах', likelihood: 3, consequence: 4, control_measure: 'Ажлын бүсийг тусгаарлаж, багажийг уналтаас бэхлэх' },
  { hazard_type: 'ladder_scaffold', description: 'Шат, тавцан эвдрэх эсвэл хазайх', likelihood: 2, consequence: 5, control_measure: 'Шат, тавцангийн бүрэн бүтэн байдал ба суурийг шалгах' },
  { hazard_type: 'weather', description: 'Салхи, бороо, мөстөлт', likelihood: 2, consequence: 5, control_measure: 'Цаг агаарын нөхцөл муудвал ажлыг зогсоох' },
  { hazard_type: 'electricity', description: 'Цахилгаанд цохиулах', likelihood: 2, consequence: 5, control_measure: 'Хүчдэлээс тусгаарлах, аюулгүй зай барих' },
];

export const DEFAULT_PPE: PpeCheck[] = [
  ['helmet', 'Бэхэлгээтэй хамгаалалтын каск'], ['harness', 'Бүтэн биеийн хамгаалах бүс'],
  ['anchor', 'Бэхэлгээ ба амь шугам'], ['ladder', 'Шат / ажлын тавцан'],
  ['guardrail', 'Хашлага / уналтаас хамгаалалт'], ['shoes', 'Хальтиргаагүй хамгаалалтын гутал'],
  ['tools', 'Багажны уналтаас хамгаалах бэхэлгээ'], ['rescue', 'Аврах төлөвлөгөө ба хэрэгсэл'],
].map(([item_key, item_label]) => ({ item_key, item_label, required: true, passed: false }));

const BUCKET = 'work-height-evidence';
const HIGH_RISK = 15;
const NESTED_SELECT = `*, hazards:work_height_hazards(*), ppe_checks:work_height_ppe_checks(*), evidence:work_height_evidence(*), audit:work_height_audit(*), approvals:work_height_approvals(*)`;

function sortNested(row: Assessment): Assessment {
  return {
    ...row,
    height_m: Number(row.height_m || 0),
    max_risk_score: Number(row.max_risk_score || 0),
    hazards: [...(row.hazards || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
    ppe_checks: row.ppe_checks || [], evidence: row.evidence || [],
    audit: [...(row.audit || [])].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    approvals: [...(row.approvals || [])].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
  };
}

async function signEvidence(assessments: Assessment[], incidents: Incident[]) {
  const evidence = [...assessments.flatMap((row) => row.evidence || []), ...incidents.flatMap((row) => row.evidence || [])];
  const paths = [...new Set(evidence.map((row) => row.storage_path).filter(Boolean))];
  if (!paths.length) return;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  const signed = new Map((data || []).map((row) => [row.path, row.signedUrl]));
  evidence.forEach((row) => { row.signed_url = signed.get(row.storage_path) || undefined; });
}

export async function fetchSafetyBundle(): Promise<SafetyBundle> {
  const assessmentQuery = supabase.from('work_height_assessments').select(NESTED_SELECT).order('created_at', { ascending: false }).limit(500);
  const incidentQuery = supabase.from('work_height_incidents').select('*, evidence:work_height_evidence(*)').order('occurred_at', { ascending: false }).limit(500);
  const locationQuery = supabase.from('attendance_locations').select('id,name,latitude,longitude').order('name');
  const [{ data: rawAssessments, error: assessmentError }, { data: rawIncidents, error: incidentError }, employees, { data: locations, error: locationError }] = await Promise.all([
    assessmentQuery, incidentQuery, fetchEmployees(), locationQuery,
  ]);
  if (assessmentError) throw assessmentError;
  if (incidentError) throw incidentError;
  if (locationError) throw locationError;
  const assessments = ((rawAssessments || []) as unknown as Assessment[]).map(sortNested);
  const incidents = (rawIncidents || []) as unknown as Incident[];
  await signEvidence(assessments, incidents);
  return { assessments, incidents, employees, locations: (locations || []) as LocationOption[] };
}

export function maxRisk(hazards: Hazard[]) {
  let value = 0;
  for (const hazard of hazards) value = Math.max(value, Number(hazard.likelihood) * Number(hazard.consequence));
  return value;
}

export function approvalBlock(assessment: Pick<Assessment, 'hazards' | 'ppe_checks'>) {
  const risk = maxRisk(assessment.hazards);
  if (risk >= HIGH_RISK) return `Өндөр эрсдэлтэй (${risk}). Хяналтын арга хэмжээг сайжруулна уу.`;
  if (!assessment.ppe_checks.length || assessment.ppe_checks.some((item) => item.required && !item.passed)) return 'Шаардлагатай хамгаалах хэрэгслийн шалгалт бүрэн биш.';
  return '';
}

export function validateAssessment(value: Assessment) {
  const errors: string[] = [];
  if (!value.employee_id || !value.employee_name.trim()) errors.push('Ажилтан сонгоно уу.');
  if (!value.location_name.trim()) errors.push('Байршил сонгоно уу.');
  if (!(Number(value.height_m) > 0)) errors.push('Ажиллах өндрийг зөв оруулна уу.');
  if (!value.work_type.trim()) errors.push('Ажлын төрлийг оруулна уу.');
  if (!value.weather.trim()) errors.push('Цаг агаарын нөхцөлийг оруулна уу.');
  if (!value.starts_at || !value.ends_at || new Date(value.ends_at) <= new Date(value.starts_at)) errors.push('Ажлын хугацаа буруу байна.');
  if (!value.hazards.length) errors.push('Дор хаяж нэг аюул үнэлнэ үү.');
  value.hazards.forEach((item, index) => {
    if (!item.description.trim() || !item.control_measure.trim()) errors.push(`${index + 1}-р аюулын тайлбар эсвэл хяналтын арга хэмжээ дутуу.`);
  });
  return errors;
}

export async function saveAssessment(value: Assessment) {
  const { evidence: _evidence, audit: _audit, approvals: _approvals, ...payload } = value;
  const { data, error } = await supabase.rpc('save_work_height_assessment', {
    p_assessment_id: value.id || null,
    p_payload: {
      ...payload,
      starts_at: new Date(value.starts_at).toISOString(),
      ends_at: new Date(value.ends_at).toISOString(),
    },
  });
  if (error) throw error;
  return String(data);
}

export async function transitionAssessment(id: string, action: string, note = '') {
  const { data, error } = await supabase.rpc('transition_work_height_assessment', { p_assessment_id: id, p_action: action, p_note: note || null });
  if (error) throw error;
  return data;
}

export async function reportIncident(value: Omit<Incident, 'evidence'>) {
  const payload = { ...value, occurred_at: new Date(value.occurred_at).toISOString() };
  const { data, error } = await supabase.rpc('report_work_height_incident', { p_payload: payload });
  if (error) throw error;
  const id = String(data);
  if (['serious', 'critical'].includes(value.severity)) {
    await supabase.functions.invoke('send-push', {
      body: {
        audience: { kind: 'role', role: 'admin' },
        notification: {
          title: 'НОЦТОЙ ХАБЭА ЗӨРЧИЛ', body: `${value.location_name} · ${value.description}`.slice(0, 220),
          type: 'urgent', screen: 'WorkHeightIncident', entityId: id, channelId: 'urgent',
          data: { type: 'work_height_incident', screen: 'WorkHeightIncident', entityId: id },
        },
      },
    }).catch(() => null);
  }
  return id;
}

export async function resolveIncident(id: string, resolution: string, close: boolean) {
  const { data, error } = await supabase.rpc('resolve_work_height_incident', { p_incident_id: id, p_resolution: resolution, p_close: close });
  if (error) throw error;
  return data;
}

export async function uploadEvidence(file: File, input: { assessmentId?: string; incidentId?: string; type: Evidence['evidence_type']; caption?: string }) {
  const root = input.assessmentId || input.incidentId;
  if (!root) throw new Error('Зураг холбох бүртгэл олдсонгүй.');
  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${root}/${input.type}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
  if (uploadError) throw uploadError;
  const { error: insertError } = await supabase.from('work_height_evidence').insert({
    assessment_id: input.assessmentId || null, incident_id: input.incidentId || null,
    evidence_type: input.type, storage_path: path, mime_type: file.type || 'image/jpeg', caption: input.caption || null,
  });
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => null);
    throw insertError;
  }
}

export function reportSummary(assessments: Assessment[], incidents: Incident[]) {
  let approved = 0; let highRisk = 0; let ppeComplete = 0;
  for (const item of assessments) {
    if (['management_approved', 'in_progress', 'completed'].includes(item.status)) approved += 1;
    if (Number(item.max_risk_score || maxRisk(item.hazards)) >= HIGH_RISK) highRisk += 1;
    if (item.ppe_complete) ppeComplete += 1;
  }
  return {
    total: assessments.length, approved, highRisk, ppeComplete,
    unresolvedIncidents: incidents.filter((item) => !['resolved', 'closed'].includes(item.status || 'open')).length,
  };
}

function esc(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function printSafetyReport(assessments: Assessment[], incidents: Incident[], title: string) {
  const summary = reportSummary(assessments, incidents);
  const report = window.open('', '_blank', 'noopener,noreferrer');
  if (!report) throw new Error('Popup хаалттай байна. Тайлан нээх зөвшөөрөл өгнө үү.');
  report.document.write(`<!doctype html><html lang="mn"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{margin:18mm}body{font-family:Arial,sans-serif;color:#111827}h1{font-size:22px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px 0}.stat{border:1px solid #cbd5e1;padding:10px}.stat b{font-size:20px}table{width:100%;border-collapse:collapse;margin:12px 0 22px}th,td{border:1px solid #cbd5e1;padding:6px;font-size:10px;text-align:left}th{background:#f1f5f9}.muted{color:#64748b;font-size:11px}</style></head><body><h1>Gennetex ERP — ${esc(title)}</h1><p class="muted">${esc(new Date().toLocaleString('mn-MN'))}</p><div class="stats"><div class="stat">Нийт<br><b>${summary.total}</b></div><div class="stat">Зөвшөөрсөн<br><b>${summary.approved}</b></div><div class="stat">Өндөр эрсдэл<br><b>${summary.highRisk}</b></div><div class="stat">Шийдээгүй зөрчил<br><b>${summary.unresolvedIncidents}</b></div></div><h2>Эрсдэлийн үнэлгээ</h2><table><thead><tr><th>Огноо</th><th>Ажилтан</th><th>Байршил</th><th>Өндөр</th><th>Эрсдэл</th><th>PPE</th><th>Төлөв</th></tr></thead><tbody>${assessments.map((a) => `<tr><td>${esc(new Date(a.starts_at).toLocaleDateString('mn-MN'))}</td><td>${esc(a.employee_name)}</td><td>${esc(a.location_name)}</td><td>${esc(a.height_m)} м</td><td>${esc(a.max_risk_score || maxRisk(a.hazards))}</td><td>${a.ppe_complete ? 'Бүрэн' : 'Дутуу'}</td><td>${esc(STATUS_LABELS[a.status])}</td></tr>`).join('')}</tbody></table><h2>Осол, зөрчил</h2><table><thead><tr><th>Огноо</th><th>Төрөл</th><th>Ноцтой байдал</th><th>Байршил</th><th>Тайлбар</th><th>Төлөв</th></tr></thead><tbody>${incidents.map((i) => `<tr><td>${esc(new Date(i.occurred_at).toLocaleString('mn-MN'))}</td><td>${esc(INCIDENT_TYPE_LABELS[i.incident_type])}</td><td>${esc(SEVERITY_LABELS[i.severity])}</td><td>${esc(i.location_name)}</td><td>${esc(i.description)}</td><td>${esc(INCIDENT_STATUS_LABELS[i.status || 'open'])}</td></tr>`).join('')}</tbody></table><script>window.onload=()=>window.print();<\/script></body></html>`);
  report.document.close();
}

export async function downloadSafetyExcel(assessments: Assessment[], incidents: Incident[], from: string, to: string) {
  await import('../../../admin-web/xlsx-chart.js');
  const xlsx = (globalThis as unknown as { XlsxChart: { build: (input: unknown) => Uint8Array } }).XlsxChart;
  const summary = reportSummary(assessments, incidents);
  const bytes = xlsx.build({ sheets: [
    { name: 'Нэгтгэл', rows: [['Үзүүлэлт', 'Утга'], ['Нийт үнэлгээ', summary.total], ['Зөвшөөрөгдсөн', summary.approved], ['Өндөр эрсдэлтэй', summary.highRisk], ['Шийдээгүй зөрчил', summary.unresolvedIncidents], ['PPE бүрэн', summary.ppeComplete]] },
    { name: 'Үнэлгээ', rows: [['Огноо', 'Ажилтан', 'ID', 'Байршил', 'Өндөр (м)', 'Ажлын төрөл', 'Эрсдэл', 'PPE', 'Төлөв'], ...assessments.map((a) => [a.starts_at, a.employee_name, a.employee_code || a.employee_id, a.location_name, a.height_m, a.work_type, a.max_risk_score || maxRisk(a.hazards), a.ppe_complete ? 'Бүрэн' : 'Дутуу', STATUS_LABELS[a.status]])] },
    { name: 'Зөрчил', rows: [['Огноо', 'Мэдээлэгч', 'Төрөл', 'Ноцтой байдал', 'Байршил', 'Тайлбар', 'Төлөв'], ...incidents.map((i) => [i.occurred_at, i.reporter_name || '', INCIDENT_TYPE_LABELS[i.incident_type], SEVERITY_LABELS[i.severity], i.location_name, i.description, INCIDENT_STATUS_LABELS[i.status || 'open']])] },
    { name: 'PPE шалгалт', rows: [['Огноо', 'Ажилтан', 'Байршил', 'Хэрэгсэл', 'Шаардлагатай', 'Тэнцсэн'], ...assessments.flatMap((a) => a.ppe_checks.map((p) => [a.starts_at, a.employee_name, a.location_name, p.item_label, p.required ? 'Тийм' : 'Үгүй', p.passed ? 'Тийм' : 'Үгүй']))] },
  ] });
  const blob = new Blob([new Uint8Array(bytes).buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `gennetex_habea_${from.replace(/-/g, '')}_${to.replace(/-/g, '')}.xlsx`;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safetyError(error: unknown) {
  const message = String((error as { message?: string })?.message || error || 'Алдаа гарлаа.');
  if (/high_risk_blocked|work_blocked/.test(message)) return 'Өндөр эрсдэлтэй ажлыг зөвшөөрөх боломжгүй. Хяналтын арга хэмжээг сайжруулна уу.';
  if (/ppe_incomplete/.test(message)) return 'Шаардлагатай хамгаалах хэрэгслийн шалгалт бүрэн биш.';
  if (/permission_denied/.test(message)) return 'Энэ үйлдлийг хийх эрх хүрэхгүй байна.';
  if (/invalid_transition/.test(message)) return 'Одоогийн төлөвөөс энэ үйлдлийг хийх боломжгүй.';
  if (/note_required/.test(message)) return 'Шалтгаан, тайлбар оруулна уу.';
  if (/required_fields_missing/.test(message)) return 'Шаардлагатай мэдээлэл дутуу байна.';
  return message;
}

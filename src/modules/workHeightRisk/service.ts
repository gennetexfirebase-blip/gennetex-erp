import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform, Share } from 'react-native';
import { supabase } from '../../lib/supabase';
import * as notificationApi from '../../services/notificationService';
import type {
  WorkHeightAssessment,
  WorkHeightEvidence,
  WorkHeightFilters,
  WorkHeightIncident,
  WorkHeightStatus,
} from './types';
import { STATUS_LABELS, maxRiskScore } from './domain';

const BUCKET = 'work-height-evidence';
const OFFLINE_KEY = '@gennetex_work_height_drafts_v1';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const INCIDENT_TYPE_LABELS: Record<string, string> = { unsafe_condition: 'Аюултай нөхцөл', near_miss: 'Осол дөхсөн', accident: 'Осол' };
const INCIDENT_SEVERITY_LABELS: Record<string, string> = { low: 'Бага', medium: 'Дунд', serious: 'Ноцтой', critical: 'Маш ноцтой' };
const INCIDENT_STATUS_LABELS: Record<string, string> = { open: 'Нээлттэй', investigating: 'Шалгаж байна', resolved: 'Шийдвэрлэсэн', closed: 'Хаасан' };

function requireClient() {
  if (!supabase) throw new Error('Supabase холболт тохируулаагүй байна.');
  return supabase;
}

export function mapWorkHeightError(error: unknown) {
  const message = String((error as { message?: string })?.message || error || 'Алдаа гарлаа.');
  if (/high_risk_blocked|work_blocked/.test(message)) return 'Өндөр эрсдэлтэй ажлыг зөвшөөрөх боломжгүй. Хяналтын арга хэмжээг сайжруулна уу.';
  if (/ppe_incomplete/.test(message)) return 'Шаардлагатай хамгаалах хэрэгслийн шалгалт бүрэн биш байна.';
  if (/permission_denied/.test(message)) return 'Танд энэ үйлдлийг хийх эрх байхгүй.';
  if (/invalid_transition/.test(message)) return 'Одоогийн төлөвөөс энэ үйлдлийг хийх боломжгүй.';
  if (/note_required/.test(message)) return 'Шалтгаан, тайлбар оруулна уу.';
  if (/hazards_required/.test(message)) return 'Дор хаяж нэг аюулын үнэлгээ шаардлагатай.';
  if (/ppe_required/.test(message)) return 'Хамгаалах хэрэгслийн checklist шаардлагатай.';
  if (/assessment_locked/.test(message)) return 'Энэ үнэлгээ түгжигдсэн. Зөвхөн ноорог эсвэл засвар шаардлагатай төлөвт засна.';
  return message;
}

function mapAssessment(row: any): WorkHeightAssessment {
  return {
    ...row,
    height_m: Number(row.height_m || 0),
    max_risk_score: Number(row.max_risk_score || 0),
    hazards: (row.hazards || []).sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
    ppe_checks: row.ppe_checks || [],
    evidence: row.evidence || [],
    audit: (row.audit || []).sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at))),
    approvals: row.approvals || [],
  };
}

export async function fetchAssessments(filters: WorkHeightFilters = {}) {
  let query = requireClient()
    .from('work_height_assessments')
    .select('*, hazards:work_height_hazards(*), ppe_checks:work_height_ppe_checks(*)')
    .order('created_at', { ascending: false })
    .limit(500);
  if (filters.from) query = query.gte('starts_at', `${filters.from}T00:00:00+08:00`);
  if (filters.to) query = query.lte('starts_at', `${filters.to}T23:59:59+08:00`);
  if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
  if (filters.locationId) query = query.eq('location_id', filters.locationId);
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
  const { data, error } = await query;
  if (error) throw new Error(mapWorkHeightError(error));
  return (data || []).map(mapAssessment);
}

export async function fetchAssessment(id: string) {
  const { data, error } = await requireClient()
    .from('work_height_assessments')
    .select('*, hazards:work_height_hazards(*), ppe_checks:work_height_ppe_checks(*), evidence:work_height_evidence(*), audit:work_height_audit(*), approvals:work_height_approvals(*)')
    .eq('id', id)
    .single();
  if (error) throw new Error(mapWorkHeightError(error));
  const assessment = mapAssessment(data);
  assessment.evidence = await attachSignedUrls(assessment.evidence || []);
  return assessment;
}

export async function saveAssessment(input: WorkHeightAssessment) {
  const payload = {
    employee_id: input.employee_id,
    employee_name: input.employee_name,
    employee_code: input.employee_code || '',
    department_id: input.department_id || '',
    location_id: input.location_id || '',
    location_name: input.location_name,
    latitude: input.latitude ?? '',
    longitude: input.longitude ?? '',
    height_m: Number(input.height_m),
    work_type: input.work_type,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    weather: input.weather,
    partner_ids: input.partner_ids || [],
    partner_names: input.partner_names || [],
    equipment: input.equipment || [],
    notes: input.notes || '',
    hazards: (input.hazards || []).map((item, index) => ({ ...item, sort_order: index })),
    ppe_checks: input.ppe_checks || [],
  };
  const { data, error } = await requireClient().rpc('save_work_height_assessment', {
    p_assessment_id: input.id || null,
    p_payload: payload,
  });
  if (error) throw new Error(mapWorkHeightError(error));
  return String(data);
}

export async function transitionAssessment(id: string, action: string, note = '') {
  const { data, error } = await requireClient().rpc('transition_work_height_assessment', {
    p_assessment_id: id,
    p_action: action,
    p_note: note || null,
  });
  if (error) throw new Error(mapWorkHeightError(error));
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.employee_id && ['hse_approve', 'management_approve', 'request_changes', 'stop'].includes(action)) {
    const label = STATUS_LABELS[row.status as WorkHeightStatus] || row.status;
    notificationApi.notifyUsers([row.employee_id], {
      title: 'Өндөрт ажиллах зөвшөөрөл шинэчлэгдлээ',
      body: `${row.location_name} · ${label}`,
      data: { type: 'work_height_risk', screen: 'WorkHeightRiskDetail', entityId: id },
      channelId: action === 'stop' ? 'urgent' : 'general_v2',
      priority: 'high',
    }).catch(() => {});
  }
  return row;
}

function extensionFor(uri: string) {
  const clean = uri.split('?')[0].toLowerCase();
  if (clean.endsWith('.png')) return { ext: 'png', mime: 'image/png' };
  if (clean.endsWith('.webp')) return { ext: 'webp', mime: 'image/webp' };
  return { ext: 'jpg', mime: 'image/jpeg' };
}

export async function uploadEvidence(
  uri: string,
  options: { assessmentId?: string; incidentId?: string; type: WorkHeightEvidence['evidence_type']; caption?: string },
) {
  const rootId = options.assessmentId || options.incidentId;
  if (!rootId) throw new Error('Нотолгооны холбоос дутуу байна.');
  const { ext, mime } = extensionFor(uri);
  const path = `${rootId}/${options.type}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const client = requireClient();
  const { error: uploadError } = await client.storage.from(BUCKET).upload(path, decode(base64), { contentType: mime, upsert: false });
  if (uploadError) throw uploadError;
  const { data, error } = await client.from('work_height_evidence').insert({
    assessment_id: options.assessmentId || null,
    incident_id: options.incidentId || null,
    evidence_type: options.type,
    storage_path: path,
    mime_type: mime,
    caption: options.caption || null,
  }).select().single();
  if (error) {
    await client.storage.from(BUCKET).remove([path]).catch(() => {});
    throw error;
  }
  return data;
}

async function attachSignedUrls(rows: WorkHeightEvidence[]) {
  const client = requireClient();
  return Promise.all(rows.map(async (row) => {
    if (!row.storage_path) return row;
    const { data } = await client.storage.from(BUCKET).createSignedUrl(row.storage_path, 3600);
    return { ...row, signed_url: data?.signedUrl || undefined };
  }));
}

export async function reportIncident(input: WorkHeightIncident) {
  const { data, error } = await requireClient().rpc('report_work_height_incident', { p_payload: input });
  if (error) throw new Error(mapWorkHeightError(error));
  const id = String(data);
  if (input.severity === 'serious' || input.severity === 'critical') {
    notificationApi.notifyAdmins({
      title: 'НОЦТОЙ ХАБЭА ЗӨРЧИЛ',
      body: `${input.location_name} · ${input.description}`.slice(0, 220),
      data: { type: 'work_height_incident', screen: 'WorkHeightIncident', entityId: id },
      channelId: 'urgent',
      priority: 'high',
    }).catch(() => {});
    notificationApi.notifySuperadmins({
      title: 'НОЦТОЙ ХАБЭА ЗӨРЧИЛ',
      body: `${input.location_name} · ${input.description}`.slice(0, 220),
      data: { type: 'work_height_incident', screen: 'WorkHeightIncident', entityId: id },
      channelId: 'urgent',
      priority: 'high',
    }).catch(() => {});
  }
  return id;
}

export async function fetchIncidents(filters: WorkHeightFilters = {}) {
  let query = requireClient().from('work_height_incidents').select('*, evidence:work_height_evidence(*)').order('occurred_at', { ascending: false }).limit(500);
  if (filters.from) query = query.gte('occurred_at', `${filters.from}T00:00:00+08:00`);
  if (filters.to) query = query.lte('occurred_at', `${filters.to}T23:59:59+08:00`);
  const { data, error } = await query;
  if (error) throw error;
  return Promise.all((data || []).map(async (row: any) => ({ ...row, evidence: await attachSignedUrls(row.evidence || []) })));
}

export async function resolveIncident(id: string, resolution: string, close = false) {
  const { data, error } = await requireClient().rpc('resolve_work_height_incident', {
    p_incident_id: id,
    p_resolution: resolution,
    p_close: close,
  });
  if (error) throw new Error(mapWorkHeightError(error));
  return Array.isArray(data) ? data[0] : data;
}

export async function loadOfflineDrafts(userId: string) {
  const raw = await AsyncStorage.getItem(`${OFFLINE_KEY}:${userId}`);
  if (!raw) return [] as WorkHeightAssessment[];
  try { return JSON.parse(raw) as WorkHeightAssessment[]; } catch { return []; }
}

export async function saveOfflineDraft(userId: string, draft: WorkHeightAssessment) {
  const drafts = await loadOfflineDrafts(userId);
  const offlineId = draft.offline_id || `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const next = [{ ...draft, offline_id: offlineId, status: 'draft' as const, updated_at: new Date().toISOString() }, ...drafts.filter((item) => item.offline_id !== offlineId)];
  await AsyncStorage.setItem(`${OFFLINE_KEY}:${userId}`, JSON.stringify(next.slice(0, 30)));
  return offlineId;
}

export async function removeOfflineDraft(userId: string, offlineId: string) {
  const drafts = await loadOfflineDrafts(userId);
  await AsyncStorage.setItem(`${OFFLINE_KEY}:${userId}`, JSON.stringify(drafts.filter((item) => item.offline_id !== offlineId)));
}

export async function syncOfflineDrafts(userId: string) {
  const drafts = await loadOfflineDrafts(userId);
  const synced: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const draft of drafts) {
    try {
      const assessmentId = await saveAssessment({ ...draft, id: undefined });
      for (const evidence of draft.evidence || []) {
        if (evidence.local_uri) {
          await uploadEvidence(evidence.local_uri, {
            assessmentId,
            type: evidence.evidence_type || 'ppe',
            caption: evidence.caption,
          });
        }
      }
      if (draft.offline_id) synced.push(draft.offline_id);
    } catch (error) {
      failed.push({ id: draft.offline_id || '', error: mapWorkHeightError(error) });
    }
  }
  if (synced.length) {
    await AsyncStorage.setItem(`${OFFLINE_KEY}:${userId}`, JSON.stringify(drafts.filter((item) => !item.offline_id || !synced.includes(item.offline_id))));
  }
  return { synced: synced.length, failed };
}

function esc(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function reportSummary(assessments: WorkHeightAssessment[], incidents: WorkHeightIncident[]) {
  return {
    total: assessments.length,
    approved: assessments.filter((item) => ['management_approved', 'in_progress', 'completed'].includes(item.status)).length,
    highRisk: assessments.filter((item) => Number(item.max_risk_score ?? maxRiskScore(item.hazards)) >= 15).length,
    unresolvedIncidents: incidents.filter((item) => !['resolved', 'closed'].includes(item.status || 'open')).length,
    ppeComplete: assessments.filter((item) => item.ppe_complete).length,
  };
}

export async function exportReportPdf(assessments: WorkHeightAssessment[], incidents: WorkHeightIncident[], title = 'Өндөрт ажиллах эрсдэлийн тайлан') {
  const Print = await import('expo-print');
  const summary = reportSummary(assessments, incidents);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{margin:24px} body{font-family:Arial,sans-serif;color:#111827} h1{font-size:20px} .meta{color:#64748b;font-size:11px}
    .stats{display:flex;gap:8px;margin:16px 0}.stat{border:1px solid #cbd5e1;padding:10px;min-width:100px}
    table{width:100%;border-collapse:collapse;margin:12px 0 22px}th,td{border:1px solid #cbd5e1;padding:6px;font-size:10px}th{background:#f1f5f9;text-align:left}
  </style></head><body><h1>Gennetex ERP — ${esc(title)}</h1><div class="meta">${esc(new Date().toLocaleString('mn-MN'))}</div>
  <div class="stats"><div class="stat">Нийт<br><b>${summary.total}</b></div><div class="stat">Зөвшөөрсөн<br><b>${summary.approved}</b></div><div class="stat">Өндөр эрсдэл<br><b>${summary.highRisk}</b></div><div class="stat">Шийдээгүй зөрчил<br><b>${summary.unresolvedIncidents}</b></div></div>
  <h2>Эрсдэлийн үнэлгээ</h2><table><thead><tr><th>Огноо</th><th>Ажилтан</th><th>Байршил</th><th>Өндөр</th><th>Эрсдэл</th><th>PPE</th><th>Төлөв</th></tr></thead><tbody>${assessments.map((a) => `<tr><td>${esc(new Date(a.starts_at).toLocaleDateString('mn-MN'))}</td><td>${esc(a.employee_name)}</td><td>${esc(a.location_name)}</td><td>${esc(a.height_m)} м</td><td>${esc(a.max_risk_score ?? maxRiskScore(a.hazards))}</td><td>${a.ppe_complete ? 'Бүрэн' : 'Дутуу'}</td><td>${esc(STATUS_LABELS[a.status])}</td></tr>`).join('')}</tbody></table>
  <h2>Осол, зөрчил</h2><table><thead><tr><th>Огноо</th><th>Төрөл</th><th>Ноцтой байдал</th><th>Байршил</th><th>Тайлбар</th><th>Төлөв</th></tr></thead><tbody>${incidents.map((i) => `<tr><td>${esc(new Date(i.occurred_at).toLocaleString('mn-MN'))}</td><td>${esc(INCIDENT_TYPE_LABELS[i.incident_type] || i.incident_type)}</td><td>${esc(INCIDENT_SEVERITY_LABELS[i.severity] || i.severity)}</td><td>${esc(i.location_name)}</td><td>${esc(i.description)}</td><td>${esc(INCIDENT_STATUS_LABELS[i.status || 'open'])}</td></tr>`).join('')}</tbody></table></body></html>`;
  const { uri } = await Print.printToFileAsync({ html });
  if (Platform.OS === 'web') return uri;
  await Share.share({ url: uri, title: 'work_height_risk.pdf', message: 'Өндөрт ажиллах эрсдэлийн тайлан' });
  return uri;
}

export async function exportReportExcel(assessments: WorkHeightAssessment[], incidents: WorkHeightIncident[]) {
  const [{ default: XlsxChart }, Sharing] = await Promise.all([
    import('../../../admin-web/xlsx-chart.js'),
    import('expo-sharing'),
  ]);
  const summary = reportSummary(assessments, incidents);
  const bytes = XlsxChart.build({ sheets: [
    { name: 'Нэгтгэл', rows: [['Үзүүлэлт', 'Утга'], ['Нийт үнэлгээ', summary.total], ['Зөвшөөрөгдсөн', summary.approved], ['Өндөр эрсдэлтэй', summary.highRisk], ['Шийдээгүй зөрчил', summary.unresolvedIncidents], ['PPE бүрэн', summary.ppeComplete]] },
    { name: 'Үнэлгээ', rows: [['Огноо', 'Ажилтан', 'ID', 'Байршил', 'Өндөр (м)', 'Ажлын төрөл', 'Эрсдэлийн оноо', 'PPE', 'Төлөв'], ...assessments.map((a) => [a.starts_at, a.employee_name, a.employee_code || a.employee_id, a.location_name, a.height_m, a.work_type, a.max_risk_score ?? maxRiskScore(a.hazards), a.ppe_complete ? 'Бүрэн' : 'Дутуу', STATUS_LABELS[a.status]])] },
    { name: 'Зөрчил', rows: [['Огноо', 'Мэдээлэгч', 'Төрөл', 'Ноцтой байдал', 'Байршил', 'Тайлбар', 'Төлөв'], ...incidents.map((i) => [i.occurred_at, i.reporter_name || '', INCIDENT_TYPE_LABELS[i.incident_type] || i.incident_type, INCIDENT_SEVERITY_LABELS[i.severity] || i.severity, i.location_name, i.description, INCIDENT_STATUS_LABELS[i.status || 'open']])] },
    { name: 'PPE шалгалт', rows: [['Огноо', 'Ажилтан', 'Байршил', 'Хэрэгсэл', 'Шаардлагатай', 'Тэнцсэн'], ...assessments.flatMap((a) => a.ppe_checks.map((p) => [a.starts_at, a.employee_name, a.location_name, p.item_label, p.required ? 'Тийм' : 'Үгүй', p.passed ? 'Тийм' : 'Үгүй']))] },
  ] });
  const uri = `${FileSystem.cacheDirectory}work_height_risk_${Date.now()}.xlsx`;
  await FileSystem.writeAsStringAsync(uri, XlsxChart.toBase64(bytes), { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync().catch(() => false)) await Sharing.shareAsync(uri, { mimeType: XLSX_MIME, dialogTitle: 'Өндөрт ажиллах эрсдэлийн тайлан' });
  return uri;
}

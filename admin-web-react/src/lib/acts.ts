import { supabase } from './supabase';

export type ActStatus = 'draft' | 'ready' | 'approved' | 'delivered' | 'cancelled' | 'archived';
export type ActSourceType = 'service_call' | 'site_session' | 'manual';
export type ChecklistResult = 'yes' | 'no' | 'na';
export type ReceiverType = 'customer' | 'site' | 'contractor' | 'nextmind' | 'custom';
export type ReceiverAudience = 'household' | 'organization';

export type ActTemplate = {
  id: string;
  name: string;
  title: string;
  company: string;
  logo_url: string | null;
  project_types: string[];
  configuration: {
    fields?: string[];
    checklist?: string[];
    signature_sections?: ReceiverType[];
    tagline?: string;
  };
  photo_layout: 1 | 2 | 4;
  footer_text: string;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ActMaterial = {
  id?: string;
  material_id: string | null;
  material_name: string;
  unit: string;
  quantity: number;
  source_transaction_id?: string | null;
  sort_order?: number;
};

export type ActInventoryItem = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
};

export type ActChecklist = {
  id?: string;
  requirement: string;
  result: ChecklistResult;
  reason: string;
  sort_order?: number;
};

export type ActReceiver = {
  id?: string;
  type: ReceiverType;
  contact_id: string | null;
  audience_type: ReceiverAudience;
  is_enabled: boolean;
  organization: string;
  employee_id: string | null;
  name: string;
  position: string;
  signature_url: string;
  stamp_url: string;
  signature_preview_url?: string;
  stamp_preview_url?: string;
  signature_mode: 'upload' | 'draw' | 'none';
  sort_order?: number;
};

export type ActReceiverContact = {
  id: string;
  audience_type: ReceiverAudience;
  preset_group: string | null;
  receiver_type: ReceiverType;
  sort_order: number;
  organization: string;
  name: string;
  position: string;
  employee_id: string | null;
  signature_url: string;
  stamp_url: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ActPhoto = {
  id?: string;
  storage_path: string | null;
  image_url: string;
  preview_url?: string;
  caption: string;
  taken_at: string;
  taken_by_employee_id: string | null;
  taken_by_employee_name: string;
  source_kind: 'upload' | 'service_call' | 'site_session' | 'visit_log' | 'attendance' | 'work_log';
  source_id: string | null;
  sort_order?: number;
};

export type ActAudit = {
  id: number;
  actor_name: string | null;
  event_type: string;
  detail: Record<string, unknown>;
  created_at: string;
};

export type Act = {
  id: string;
  act_number: string;
  template_id: string | null;
  source_type: ActSourceType;
  source_id: string | null;
  act_type: 'work_completion' | 'work_handover';
  project_name: string;
  project_type: string;
  location: string;
  contractor_name: string;
  customer_name: string;
  work_description: string;
  start_date: string;
  end_date: string;
  photo_layout: 1 | 2 | 4;
  status: ActStatus;
  created_by: string;
  created_by_name: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  delivered_at?: string | null;
  archived_at?: string | null;
  public_share_enabled?: boolean;
  public_share_token?: string | null;
  public_share_slug?: string | null;
  public_shared_at?: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  template?: ActTemplate;
  materials: ActMaterial[];
  checklists: ActChecklist[];
  receivers: ActReceiver[];
  photos: ActPhoto[];
  audit: ActAudit[];
};

export type ActDraft = Omit<Act, 'id' | 'act_number' | 'status' | 'created_by' | 'created_by_name' | 'created_at' | 'updated_at' | 'version' | 'template' | 'audit'> & {
  id?: string;
  act_number?: string;
  status?: ActStatus;
};

export type ActSource = {
  source_type: Exclude<ActSourceType, 'manual'>;
  source_id: string;
  project_name: string;
  customer_name: string | null;
  location: string | null;
  work_description: string | null;
  start_date: string | null;
  end_date: string | null;
  project_type: string | null;
  source_status: string | null;
};

export type SourceSnapshot = Omit<ActSource, 'source_status'> & {
  materials: Array<{
    id?: string;
    item_id?: string;
    name?: string;
    item_name?: string;
    unit?: string;
    qty?: number;
    quantity?: number;
    transaction_id?: string;
  }>;
  photos: Array<string | {
    url?: string;
    image_url?: string;
    caption?: string;
    taken_at?: string;
    employee_name?: string;
    source_kind?: ActPhoto['source_kind'];
    source_id?: string;
  }>;
};

export type ActListFilters = {
  search?: string;
  status?: ActStatus | '';
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export const ACT_STATUS_LABELS: Record<ActStatus, string> = {
  draft: 'Draft',
  ready: 'Бэлэн',
  approved: 'Баталгаажсан',
  delivered: 'Хүлээлгэн өгсөн',
  cancelled: 'Цуцлагдсан',
  archived: 'Архивласан',
};

export const ACT_AUDIT_LABELS: Record<string, string> = {
  created: 'акт үүсгэсэн',
  materials_updated: 'материалын мэдээлэл өөрчилсөн',
  checklist_updated: 'шалгах хуудас өөрчилсөн',
  ready: 'актыг бэлэн болгосон',
  approved: 'актыг баталгаажуулсан',
  delivered: 'актыг хүлээлгэн өгсөн',
  cancelled: 'актыг цуцалсан',
  archived: 'актыг архивласан',
  duplicated: 'актыг хуулбарласан',
  exported: 'файл татсан',
  public_share_enabled: 'public share link нээсэн',
  public_share_disabled: 'public share link хаасан',
  materials_issued: 'актын материалыг агуулахаас зарлага гаргасан',
  email_sent: 'актыг и-мэйлээр илгээсэн',
};

function blank(value: unknown) {
  return String(value ?? '');
}

function normalizeAct(row: Record<string, any>): Act {
  return {
    ...row,
    project_name: blank(row.project_name),
    project_type: blank(row.project_type),
    location: blank(row.location),
    contractor_name: blank(row.contractor_name || 'Женнетекс ХХК'),
    customer_name: blank(row.customer_name),
    work_description: blank(row.work_description),
    start_date: blank(row.start_date),
    end_date: blank(row.end_date),
    materials: [...(row.materials || [])].sort((a, b) => Number(a.sort_order) - Number(b.sort_order)),
    checklists: [...(row.checklists || [])].sort((a, b) => Number(a.sort_order) - Number(b.sort_order)).map((item) => ({ ...item, reason: blank(item.reason) })),
    receivers: [...(row.receivers || [])].sort((a, b) => Number(a.sort_order) - Number(b.sort_order)).map((item) => ({
      ...item,
      contact_id: item.contact_id || null,
      audience_type: item.audience_type === 'household' ? 'household' : 'organization',
      is_enabled: item.is_enabled !== false,
      organization: blank(item.organization), name: blank(item.name), position: blank(item.position),
      signature_url: blank(item.signature_url), stamp_url: blank(item.stamp_url),
    })),
    photos: [...(row.photos || [])].sort((a, b) => Number(a.sort_order) - Number(b.sort_order)).map((item) => ({ ...item, image_url: blank(item.image_url), caption: blank(item.caption), taken_at: blank(item.taken_at), taken_by_employee_name: blank(item.taken_by_employee_name) })),
    audit: [...(row.audit || [])].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
  } as Act;
}

export async function fetchActs(filters: ActListFilters = {}) {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize || 20));
  let query = supabase
    .from('acts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.from) query = query.gte('created_at', `${filters.from}T00:00:00`);
  if (filters.to) query = query.lte('created_at', `${filters.to}T23:59:59.999`);
  const q = filters.search?.trim();
  if (q) {
    const safe = q.replace(/[%_,()]/g, ' ');
    query = query.or(`act_number.ilike.%${safe}%,project_name.ilike.%${safe}%,customer_name.ilike.%${safe}%,work_description.ilike.%${safe}%`);
  }
  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data || []) as Act[], count: count || 0, page, pageSize };
}

export async function fetchAct(id: string): Promise<Act> {
  const { data, error } = await supabase
    .from('acts')
    .select('*, template:act_templates(*), materials:act_materials(*), checklists:act_checklists(*), receivers:act_receivers(*), photos:act_photos(*), audit:act_audit_logs(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  const act = normalizeAct(data as Record<string, any>);
  return hydrateActAssets(act);
}

async function hydrateActAssets(act: Act): Promise<Act> {
  const paths = act.photos.map((photo) => photo.storage_path).filter(Boolean) as string[];
  const signaturePaths = act.receivers.flatMap((item) => [item.signature_url, item.stamp_url]).filter((url) => url && !/^https?:|^data:/i.test(url));
  const allPaths = [...new Set([...paths, ...signaturePaths])];
  if (allPaths.length) {
    const { data: signed } = await supabase.storage.from('act-files').createSignedUrls(allPaths, 3600);
    const urls = new Map((signed || []).map((item) => [item.path, item.signedUrl]));
    act.photos = act.photos.map((photo) => ({ ...photo, preview_url: photo.storage_path ? urls.get(photo.storage_path) || photo.image_url : photo.image_url }));
    act.receivers = act.receivers.map((item) => ({
      ...item,
      signature_preview_url: urls.get(item.signature_url) || item.signature_url,
      stamp_preview_url: urls.get(item.stamp_url) || item.stamp_url,
    }));
  }
  return act;
}

export async function fetchPublicAct(token: string): Promise<Act> {
  const isShortSlug = /^[a-f0-9]{8,20}$/i.test(token);
  const { data, error } = isShortSlug
    ? await supabase.rpc('get_public_act_by_slug', { p_slug: token })
    : await supabase.rpc('get_public_act', { p_token: token });
  if (error) throw error;
  return hydrateActAssets(normalizeAct(data as Record<string, any>));
}

export async function setActPublicShare(id: string, enabled: boolean) {
  const { data, error } = await supabase.rpc('set_act_public_share', { p_act_id: id, p_enabled: enabled });
  if (error) throw error;
  return String(data);
}

export async function fetchActInventory(): Promise<ActInventoryItem[]> {
  const { data, error } = await supabase
    .from('inventory')
    .select('id,name,unit,quantity')
    .order('name');
  if (error) throw error;
  return (data || []).map((item) => ({ ...item, unit: item.unit || 'ширхэг', quantity: Number(item.quantity) || 0 })) as ActInventoryItem[];
}

export async function issueActMaterials(id: string): Promise<{ issued_count: number; already_issued_count: number; total_quantity: number }> {
  const { data, error } = await supabase.rpc('issue_act_materials', { p_act_id: id });
  if (error) throw error;
  return data as { issued_count: number; already_issued_count: number; total_quantity: number };
}

export async function logActEmail(id: string, to: string) {
  const { error } = await supabase.rpc('log_act_email', { p_act_id: id, p_to_email: to });
  if (error) throw error;
}

export async function sendActEmail(payload: { to: string; actNumber: string; projectName: string; publicUrl: string; pdfUrl: string; pdfFilename: string }) {
  const { data, error } = await supabase.functions.invoke('send-act-email', { body: payload });
  if (error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const detail = await context.clone().json() as { error?: string };
        if (detail.error) throw new Error(detail.error);
      } catch (cause) {
        if (cause instanceof Error && cause.message !== 'Unexpected end of JSON input') throw cause;
      }
    }
    throw error;
  }
  if (!data?.ok) throw new Error(data?.error || 'И-мэйл илгээж чадсангүй.');
  return data as { ok: true; id: string; to: string };
}

export async function fetchActTemplates(): Promise<ActTemplate[]> {
  const { data, error } = await supabase.from('act_templates').select('*').order('is_default', { ascending: false }).order('name');
  if (error) throw error;
  return (data || []) as ActTemplate[];
}

export async function fetchActReceiverContacts(): Promise<ActReceiverContact[]> {
  const { data, error } = await supabase
    .from('act_receiver_contacts')
    .select('id,audience_type,preset_group,receiver_type,sort_order,organization,name,position,employee_id,signature_url,stamp_url,is_active,created_at,updated_at')
    .order('audience_type')
    .order('preset_group')
    .order('sort_order')
    .order('organization')
    .order('name');
  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    organization: blank(row.organization),
    position: blank(row.position),
    signature_url: blank(row.signature_url),
    stamp_url: blank(row.stamp_url),
  })) as ActReceiverContact[];
}

export async function saveActReceiverContact(contact: Omit<ActReceiverContact, 'id' | 'preset_group' | 'receiver_type' | 'sort_order'> & {
  id?: string;
  preset_group?: string | null;
  receiver_type?: ReceiverType;
  sort_order?: number;
}) {
  const { data, error } = await supabase.rpc('save_act_receiver_contact', {
    p_contact_id: contact.id || null,
    p_payload: contact,
  });
  if (error) throw error;
  return String(data);
}

export async function fetchActSources(): Promise<ActSource[]> {
  const { data, error } = await supabase.rpc('list_act_sources');
  if (error) throw error;
  return (data || []) as ActSource[];
}

export async function fetchSourceSnapshot(sourceType: string, sourceId: string): Promise<SourceSnapshot> {
  const { data, error } = await supabase.rpc('get_act_source_snapshot', { p_source_type: sourceType, p_source_id: sourceId });
  if (error) throw error;
  return data as SourceSnapshot;
}

export function normalizeSourceMaterials(rows: SourceSnapshot['materials']): ActMaterial[] {
  const merged = new Map<string, ActMaterial>();
  for (const row of rows || []) {
    const materialId = row.id || row.item_id || null;
    const name = String(row.name || row.item_name || '').trim();
    if (!name) continue;
    const key = materialId || `${name.toLocaleLowerCase('mn')}|${row.unit || 'ширхэг'}`;
    const quantity = Number(row.qty ?? row.quantity ?? 0) || 0;
    const previous = merged.get(key);
    if (previous) previous.quantity += quantity;
    else merged.set(key, { material_id: materialId, material_name: name, unit: row.unit || 'ширхэг', quantity, source_transaction_id: row.transaction_id || null });
  }
  return [...merged.values()];
}

export function normalizeSourcePhotos(rows: SourceSnapshot['photos']): ActPhoto[] {
  return (rows || []).map((row, index) => {
    const value = typeof row === 'string' ? { url: row } : row;
    return {
      storage_path: null,
      image_url: value.url || value.image_url || '',
      preview_url: value.url || value.image_url || '',
      caption: value.caption || `Ажлын зураг ${index + 1}`,
      taken_at: value.taken_at || '',
      taken_by_employee_id: null,
      taken_by_employee_name: value.employee_name || '',
      source_kind: value.source_kind || 'work_log',
      source_id: value.source_id || null,
    };
  }).filter((item) => item.image_url);
}

export async function saveAct(id: string | undefined, payload: ActDraft, forceApprovedEdit = false): Promise<string> {
  const { data, error } = await supabase.rpc('save_act', {
    p_act_id: id || null,
    p_payload: payload,
    p_force_approved_edit: forceApprovedEdit,
  });
  if (error) throw error;
  const savedId = String(data);
  const { error: metadataError } = await supabase.rpc('set_act_receiver_metadata', {
    p_act_id: savedId,
    p_receivers: payload.receivers || [],
  });
  if (metadataError) throw metadataError;
  return savedId;
}

export async function transitionAct(id: string, action: 'ready' | 'approve' | 'deliver' | 'cancel' | 'archive') {
  const { data, error } = await supabase.rpc('transition_act', { p_act_id: id, p_action: action });
  if (error) throw error;
  return data;
}

export async function duplicateAct(id: string) {
  const { data, error } = await supabase.rpc('duplicate_act', { p_act_id: id });
  if (error) throw error;
  return String(data);
}

export async function deleteAct(id: string) {
  const { error } = await supabase.rpc('delete_act', { p_act_id: id });
  if (error) throw error;
}

export async function logActExport(id: string, format: 'pdf' | 'docx' | 'print') {
  const { error } = await supabase.rpc('log_act_export', { p_act_id: id, p_format: format });
  if (error) throw error;
}

export async function addActPhoto(id: string, photo: ActPhoto) {
  const { data, error } = await supabase.rpc('add_act_photo', { p_act_id: id, p_photo: photo });
  if (error) throw error;
  return String(data);
}

export async function saveActTemplate(id: string | undefined, payload: Partial<ActTemplate>) {
  const { data, error } = await supabase.rpc('save_act_template', { p_template_id: id || null, p_payload: payload });
  if (error) throw error;
  return String(data);
}

function extension(file: File) {
  const raw = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (raw) return raw;
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

export async function uploadActImage(actId: string, file: File | Blob, folder: 'photos' | 'signatures' | 'stamps' = 'photos') {
  const fileValue = file instanceof File ? file : new File([file], `${folder}.png`, { type: file.type || 'image/png' });
  const path = `${actId}/${folder}/${crypto.randomUUID()}.${extension(fileValue)}`;
  const { error } = await supabase.storage.from('act-files').upload(path, fileValue, { contentType: fileValue.type || 'image/jpeg', upsert: false });
  if (error) throw error;
  const { data } = await supabase.storage.from('act-files').createSignedUrl(path, 3600);
  return { storagePath: path, signedUrl: data?.signedUrl || '' };
}

export async function uploadActPdf(actId: string, blob: Blob, fileName: string) {
  // Supabase Storage object keys reject some Unicode code points. Keep the
  // customer-facing attachment filename separate and use an ASCII-only key.
  const path = `${actId}/exports/email-${actId}.pdf`;
  const { error } = await supabase.storage.from('act-files').upload(path, blob, { contentType: 'application/pdf', upsert: true });
  if (error) throw error;
  const { data, error: signError } = await supabase.storage.from('act-files').createSignedUrl(path, 600);
  if (signError) throw signError;
  return { storagePath: path, signedUrl: data.signedUrl };
}

export async function removeActImage(path: string) {
  if (!path) return;
  const { error } = await supabase.storage.from('act-files').remove([path]);
  if (error) throw error;
}

export function emptyActDraft(template?: ActTemplate): ActDraft {
  return {
    template_id: template?.id || null,
    source_type: 'manual',
    source_id: null,
    act_type: 'work_completion',
    project_name: '',
    project_type: '',
    location: '',
    contractor_name: template?.company || 'Женнетекс ХХК',
    customer_name: '',
    work_description: '',
    start_date: '',
    end_date: '',
    photo_layout: template?.photo_layout || 1,
    materials: [],
    checklists: (template?.configuration?.checklist || []).map((requirement) => ({ requirement, result: 'na', reason: '' })),
    receivers: [],
    photos: [],
  };
}

export function actError(error: unknown) {
  const message = String((error as { message?: string })?.message || error || 'Алдаа гарлаа.');
  if (/approved_act_locked/i.test(message)) return 'Баталгаажсан актыг өөрчлөх гэж байна. Админ эрхээр баталгаажуулж үргэлжлүүлнэ үү.';
  if (/permission_denied/i.test(message)) return 'Энэ үйлдлийг хийх эрх хүрэхгүй байна.';
  if (/checklist_reason_required/i.test(message)) return '“Үгүй” гэж сонгосон шаардлагын шалтгааныг оруулна уу.';
  if (/receiver_name_required/i.test(message)) return 'Хүлээлцэх хүний нэрийг оруулна уу.';
  if (/share_requires_ready/i.test(message)) return 'Public link үүсгэхийн өмнө актыг “Бэлэн” болгоно уу.';
  if (/public_act_not_found/i.test(message)) return 'Public акт олдсонгүй эсвэл share link хаагдсан байна.';
  if (/act_inventory_locked/i.test(message)) return 'Баталгаажсан эсвэл хаагдсан актаас агуулахын зарлага гаргах боломжгүй.';
  if (/act_material_not_linked:([^\n]+)/i.test(message)) return `“${message.split(':').slice(1).join(':')}” материалыг агуулахын бараатай холбоно уу.`;
  if (/inventory_shortage:([^:]+):([^:]+):([^\s]+)/i.test(message)) {
    const match = message.match(/inventory_shortage:([^:]+):([^:]+):([^\s]+)/i);
    return match ? `“${match[1]}” барааны үлдэгдэл хүрэлцэхгүй. Үлдэгдэл: ${match[2]}, шаардлагатай: ${match[3]}.` : message;
  }
  if (/act_not_found/i.test(message)) return 'Акт олдсонгүй эсвэл хандах эрхгүй байна.';
  return message;
}

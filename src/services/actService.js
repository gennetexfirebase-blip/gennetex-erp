/**
 * Ажил гүйцэтгэлийн акт — akt.gennetex.com (admin-web-react/src/lib/acts.ts)-тэй
 * ИЖИЛ Supabase хүснэгт, RPC-г ашиглана. Тиймээс аппаас бичсэн акт вэб
 * дээр шууд харагдана (PDF/DOCX экспорт вэбээс).
 *
 * Эрх (сервер дээр `act_can` шалгана — 20261011150000_act_director_only.sql):
 *   • `acts.create` эрхтэй хүн (энгийн админ ч гэсэн) — зөвхөн өөрийн актаа
 *     харна, ноорог үедээ засна, «Илгээх» → Захирал, sysadmin руу мэдэгдэл
 *   • Захирал (DIRECTOR_EMAIL) — бүх акт, ГАНЦААРАА баталгаажуулна/буцаана
 *   • Sysadmin — бүх акт харна, хэнд эрх олгохыг тохируулна
 */
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import * as notifyApi from './notificationService';

export const ACT_WEB_URL = 'https://akt.gennetex.com';

/** Захирал — зөвхөн энэ имэйлээр нэвтэрсэн хүн актыг баталгаажуулна. */
export const DIRECTOR_EMAIL = 'bayasgalan.gennetex@gmail.com';

export function isActDirector(profile) {
  return String(profile?.email || '').trim().toLowerCase() === DIRECTOR_EMAIL;
}

/** Бүх актыг харах — Захирал, sysadmin. Бусад нь зөвхөн өөрийнхийгөө. */
export function canSeeAllActs(profile) {
  return isActDirector(profile) || profile?.role === 'superadmin';
}

/** Акт модуль нээгдэх эсэх — эрх олгогдсон эсвэл Захирал/sysadmin. */
export function canUseActs(profile) {
  return canSeeAllActs(profile) || profile?.permissions?.['acts.create'] === true;
}

export const ACT_STATUS = {
  draft: { label: 'Ноорог', tone: 'muted' },
  ready: { label: 'Илгээсэн', tone: 'warn' },
  approved: { label: 'Баталгаажсан', tone: 'ok' },
  delivered: { label: 'Хүлээлгэн өгсөн', tone: 'blue' },
  cancelled: { label: 'Цуцлагдсан', tone: 'bad' },
  archived: { label: 'Архивласан', tone: 'muted' },
};

export const ACT_AUDIT_LABELS = {
  created: 'акт үүсгэсэн',
  materials_updated: 'материал өөрчилсөн',
  checklist_updated: 'шалгах хуудас өөрчилсөн',
  ready: 'Захирал руу илгээсэн',
  returned: 'засуулахаар буцаасан',
  approved: 'баталгаажуулсан',
  delivered: 'хүлээлгэн өгсөн',
  cancelled: 'цуцалсан',
  archived: 'архивласан',
  exported: 'файл татсан',
};

const blank = (v) => (v == null ? '' : String(v));

function normalizeAct(row) {
  const by = (a, b) => Number(a.sort_order) - Number(b.sort_order);
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
    materials: [...(row.materials || [])].sort(by),
    checklists: [...(row.checklists || [])].sort(by).map((c) => ({ ...c, reason: blank(c.reason) })),
    receivers: [...(row.receivers || [])].sort(by),
    photos: [...(row.photos || [])].sort(by),
    audit: [...(row.audit || [])].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
  };
}

/**
 * Жагсаалт — RLS нь ажилтанд зөвхөн өөрийнхийг нь буцаана. `ownerId`
 * өгвөл (Захирал/sysadmin биш хүн) тэр хүний бичсэнээр л шүүнэ.
 */
export async function fetchActs({ status, search, ownerId, limit = 100 } = {}) {
  let query = supabase
    .from('acts')
    .select('id, act_number, status, project_name, customer_name, location, created_by, created_by_name, approved_by_name, created_at, updated_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (ownerId) query = query.eq('created_by', ownerId);
  if (status) query = query.eq('status', status);
  const q = String(search || '').trim();
  if (q) {
    const safe = q.replace(/[%_,()]/g, ' ');
    query = query.or(`act_number.ilike.%${safe}%,project_name.ilike.%${safe}%,customer_name.ilike.%${safe}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchAct(id) {
  const { data, error } = await supabase
    .from('acts')
    .select('*, template:act_templates(*), materials:act_materials(*), checklists:act_checklists(*), receivers:act_receivers(*), photos:act_photos(*), audit:act_audit_logs(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  const act = normalizeAct(data);
  // Хувийн bucket — зураг, гарын үсэг, тамгыг түр URL-ээр харуулна
  // (вэбийн hydrateActAssets-тэй ижил).
  const isPath = (u) => u && !/^https?:|^data:/i.test(u);
  const paths = [
    ...act.photos.map((p) => p.storage_path),
    ...act.receivers.flatMap((r) => [r.signature_url, r.stamp_url]).filter(isPath),
  ].filter(Boolean);
  const map = new Map();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from('act-files').createSignedUrls([...new Set(paths)], 3600);
    (signed || []).forEach((s) => map.set(s.path, s.signedUrl));
  }
  act.photos = act.photos.map((p) => ({ ...p, preview_url: map.get(p.storage_path) || p.image_url }));
  act.receivers = act.receivers.map((r) => ({
    ...r,
    signature_preview_url: map.get(r.signature_url) || (isPath(r.signature_url) ? '' : r.signature_url || ''),
    stamp_preview_url: map.get(r.stamp_url) || (isPath(r.stamp_url) ? '' : r.stamp_url || ''),
  }));
  return act;
}

// ---------------------------------------------------------------------------
// Хүлээлцэх хүмүүс — вэбийн (admin-web-react/src/pages/ActEditor.tsx) логик.
// Захиалагч (Нексмайнд / Юнивишн …) сонгоход тэр байгууллагын бүрэлдэхүүн,
// мөн Женнетексийн Захирал автоматаар орно.
// ---------------------------------------------------------------------------

const HANDOVER_GROUP = 'gennetex_handover';

const isDirectorContact = (c) => c.preset_group === HANDOVER_GROUP && /захирал/i.test(c.position || '');

export async function fetchReceiverContacts() {
  const { data, error } = await supabase
    .from('act_receiver_contacts')
    .select('id,audience_type,preset_group,receiver_type,sort_order,organization,name,position,employee_id,signature_url,stamp_url,is_active')
    .order('audience_type')
    .order('preset_group')
    .order('sort_order')
    .order('organization')
    .order('name');
  if (error) throw error;
  return (data || []).map((c) => ({
    ...c,
    organization: blank(c.organization),
    position: blank(c.position),
    signature_url: blank(c.signature_url),
    stamp_url: blank(c.stamp_url),
  }));
}

function buildReceivers(contacts, current = []) {
  return contacts
    .slice()
    .sort((a, b) => Number(a.preset_group === HANDOVER_GROUP) - Number(b.preset_group === HANDOVER_GROUP) || a.sort_order - b.sort_order)
    .map((c) => {
      const prev = current.find((r) => r.contact_id === c.id) || current.find((r) => r.organization === c.organization && r.name === c.name);
      // Женнетексийн тамга автоматаар орохгүй — Захирал баталгаажуулахад DB дээр нэмэгдэнэ.
      const stamp = c.preset_group === HANDOVER_GROUP ? prev?.stamp_url || '' : c.preset_group ? c.stamp_url || '' : prev?.stamp_url || c.stamp_url || '';
      return {
        type: c.receiver_type,
        contact_id: c.id,
        audience_type: c.audience_type,
        is_enabled: prev ? prev.is_enabled !== false : true,
        organization: c.organization.trim(),
        employee_id: c.employee_id,
        name: c.name,
        position: c.position,
        signature_url: prev?.signature_url || c.signature_url || '',
        stamp_url: stamp,
        signature_preview_url: prev?.signature_preview_url || c.signature_url || '',
        stamp_preview_url: stamp && /^https?:/i.test(stamp) ? stamp : prev?.stamp_preview_url || '',
        signature_mode: prev?.signature_mode || (c.signature_url ? 'upload' : 'none'),
      };
    });
}

/** «Захиалагч»-ийн сонголтууд: байгууллага өөрийн нэрээр, өрх компанийн нэрээр. */
/**
 * Хүлээлцэх хүний лавлахыг засах (зөвхөн sysadmin — сервер `is_superadmin`-аар шалгана).
 * `is_active`-ийг унтраавал баталгаажаагүй актуудаас тухайн хүн автоматаар хасагдана.
 */
export async function saveReceiverContact(contact) {
  const payload = {
    audience_type: contact.audience_type || 'organization',
    organization: contact.organization || '',
    name: contact.name || '',
    position: contact.position || '',
    employee_id: contact.employee_id || '',
    is_active: contact.is_active !== false,
    preset_group: contact.preset_group || '',
    receiver_type: contact.receiver_type || 'custom',
    sort_order: contact.sort_order || 0,
    signature_url: contact.signature_url || '',
    stamp_url: contact.stamp_url || '',
  };
  const { data, error } = await supabase.rpc('save_act_receiver_contact', { p_contact_id: contact.id || null, p_payload: payload });
  if (error) throw error;
  return String(data);
}

export async function deleteReceiverContact(id) {
  const { error } = await supabase.rpc('delete_act_receiver_contact', { p_contact_id: id });
  if (error) throw error;
}

export function customerOptions(contacts) {
  const options = new Map();
  contacts
    .filter((c) => c.is_active && c.preset_group !== HANDOVER_GROUP && c.organization.trim())
    .sort((a, b) => Number(a.audience_type === 'household') - Number(b.audience_type === 'household') || a.sort_order - b.sort_order)
    .forEach((c) => {
      const organization = c.organization.trim();
      const label = c.audience_type === 'household' ? organization.match(/^.*?\s(?:Х?ХК|LLC)(?=\s|$)/i)?.[0] || organization : organization;
      if (!options.has(label)) options.set(label, { label, organization });
    });
  return [...options.values()];
}

/** Захиалагчийн нэрээс хүлээн авах байгууллагыг тааруулна. */
export function autoReceiverOrganization(contacts, customer) {
  const name = String(customer || '').trim().toLocaleLowerCase('mn');
  if (name) {
    const hit = customerOptions(contacts).find((o) =>
      [o.label, o.organization].some((v) => {
        const t = v.toLocaleLowerCase('mn');
        const head = t.split(/\s+/)[0];
        return t === name || t.startsWith(name) || name.startsWith(t) || (head.length > 2 && name.includes(head));
      })
    );
    if (hit) return hit.organization;
  }
  return '';
}

/**
 * Сонгосон байгууллагын хүмүүс + Женнетексийн Захирал. Тамга дарах эрхгүй
 * (`acts.stamp`) хүнд автоматаар орох тамгыг авахгүй — вэбтэй ижил.
 */
export function receiversFor(contacts, organization, current = [], { canStamp = false } = {}) {
  const org = String(organization || '').trim();
  const keepHandover = current.some((r) =>
    contacts.some((c) => c.id === r.contact_id && c.preset_group === HANDOVER_GROUP && !isDirectorContact(c))
  );
  const selected = contacts.filter(
    (c) =>
      c.is_active &&
      (isDirectorContact(c) || (c.preset_group === HANDOVER_GROUP ? keepHandover : org && c.organization.trim() === org))
  );
  const rows = buildReceivers(selected, current);
  return canStamp ? rows : rows.map((r) => (r.type === 'contractor' ? r : { ...r, stamp_url: '', stamp_preview_url: '' }));
}

export async function fetchDefaultTemplate() {
  const { data, error } = await supabase.from('act_templates').select('*').order('is_default', { ascending: false }).limit(20);
  if (error) throw error;
  return (data || []).find((t) => t.is_default) || (data || [])[0] || null;
}

export function emptyDraft(template) {
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

export function draftFromAct(act) {
  return {
    template_id: act.template_id,
    source_type: act.source_type,
    source_id: act.source_id,
    act_type: act.act_type,
    project_name: act.project_name,
    project_type: act.project_type,
    location: act.location,
    contractor_name: act.contractor_name,
    customer_name: act.customer_name,
    work_description: act.work_description,
    start_date: act.start_date,
    end_date: act.end_date,
    photo_layout: act.photo_layout,
    materials: act.materials,
    checklists: act.checklists,
    receivers: act.receivers,
    photos: act.photos.map(({ preview_url, ...p }) => p),
  };
}

/** Хадгалах (шинэ бол үүсгэнэ). Буцаах: актын id. */
export async function saveAct(id, draft) {
  const payload = { ...draft, photos: (draft.photos || []).map(({ preview_url, ...p }) => p) };
  const { data, error } = await supabase.rpc('save_act', {
    p_act_id: id || null,
    p_payload: payload,
    p_force_approved_edit: false,
  });
  if (error) throw error;
  const savedId = String(data);
  if ((payload.receivers || []).length) {
    const { error: metaError } = await supabase.rpc('set_act_receiver_metadata', {
      p_act_id: savedId,
      p_receivers: payload.receivers,
    });
    if (metaError) throw metaError;
  }
  return savedId;
}

export async function transitionAct(id, action) {
  const { data, error } = await supabase.rpc('transition_act', { p_act_id: id, p_action: action });
  if (error) throw error;
  return data;
}

/** Захирлын хэрэглэгчийн id (мэдэгдэл илгээхэд). */
async function directorUserId() {
  const { data } = await supabase.from('profiles').select('id').ilike('email', DIRECTOR_EMAIL).limit(1);
  return data?.[0]?.id || null;
}

/** Зохиогч: «Илгээх» — Захирал болон sysadmin руу мэдэгдэл. */
export async function submitAct(act, { authorName } = {}) {
  await transitionAct(act.id, 'ready');
  const payload = {
    title: 'Шинэ акт ирлээ',
    body: `${authorName || 'Ажилтан'} · ${act.act_number || ''} ${act.project_name || ''}`.trim().slice(0, 200),
    data: { type: 'act_submitted', actId: String(act.id) },
    priority: 'high',
  };
  const directorId = await directorUserId().catch(() => null);
  await Promise.all([
    // Захирлын id олдохгүй бол (хуучин RLS) админууд руу нөөцөөр.
    directorId ? notifyApi.notifyUsers([directorId], payload) : notifyApi.notifyAdmins(payload),
    notifyApi.notifySuperadmins(payload),
  ]);
}

/**
 * Захирал: баталгаажуулах — зохиогчид мэдэгдэнэ. Актад Захирлын мөр байхгүй
 * бол (хуучин акт) эхлээд нэмнэ — тамгыг DB trigger тэр мөрөнд дардаг.
 */
export async function approveAct(act) {
  try {
    const contacts = await fetchReceiverContacts();
    const missing = receiversFor(contacts, '', act.receivers).filter(
      (r) => !act.receivers.some((x) => x.contact_id === r.contact_id)
    );
    if (missing.length) {
      const draft = draftFromAct(act);
      await saveAct(act.id, { ...draft, receivers: [...draft.receivers, ...missing] });
    }
  } catch (e) {
    // Тамгагүй ч баталгаажуулалт явна.
  }
  await transitionAct(act.id, 'approve');
  if (act.created_by) {
    await notifyApi.notifyUsers([act.created_by], {
      title: 'Акт баталгаажлаа',
      body: `${act.act_number || ''} ${act.project_name || ''}`.trim(),
      data: { type: 'act_approved', actId: String(act.id) },
    });
  }
}

/** Захирал: засуулахаар буцаах. */
export async function returnAct(act) {
  await transitionAct(act.id, 'return');
  if (act.created_by) {
    await notifyApi.notifyUsers([act.created_by], {
      title: 'Акт засуулахаар буцлаа',
      body: `${act.act_number || ''} ${act.project_name || ''}`.trim(),
      data: { type: 'act_returned', actId: String(act.id) },
    });
  }
}

/** Зураг оруулах — `act-files/<actId>/photos/...` */
export async function uploadActPhoto(actId, uri) {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const path = `${actId}/photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from('act-files').upload(path, decode(base64), { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  const { data } = await supabase.storage.from('act-files').createSignedUrl(path, 3600);
  return { storage_path: path, preview_url: data?.signedUrl || '' };
}

export function actError(error) {
  const message = String(error?.message || error || 'Алдаа гарлаа.');
  if (/approved_act_locked/i.test(message)) return 'Баталгаажсан актыг өөрчлөх боломжгүй.';
  if (/director_only/i.test(message)) return 'Актыг зөвхөн Захирал баталгаажуулна.';
  if (/permission_denied/i.test(message)) return 'Энэ үйлдлийг хийх эрх хүрэхгүй байна.';
  if (/invalid_transition/i.test(message)) return 'Энэ төлөвт энэ үйлдэл хийх боломжгүй.';
  if (/checklist_reason_required/i.test(message)) return '«Үгүй» гэж сонгосон шаардлагын шалтгааныг бичнэ үү.';
  if (/act_not_found/i.test(message)) return 'Акт олдсонгүй эсвэл хандах эрхгүй байна.';
  return message;
}

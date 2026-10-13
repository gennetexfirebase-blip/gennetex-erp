import { supabase } from './supabase';

/**
 * Хөдөлмөрийн (ажил гүйцэтгэх) гэрээ — geree.gennetex.com.
 * Сервер: supabase/migrations/20261013100000_employment_contracts.sql,
 *         supabase/functions/contract-notify.
 */

export const DIRECTOR_EMAIL = 'bayasgalan.gennetex@gmail.com';
export const CONTRACT_HOST = 'geree.gennetex.com';

export type ContractStatus = 'draft' | 'sent' | 'signed' | 'approved' | 'returned';

/** Гэрээнд ажилтан бүрээр өөрчлөгддөг утгууд (бусад заалт нь загварт тогтмол). */
export type ContractFields = {
  contract_date: string; // YYYY-MM-DD
  register_no: string;
  address: string;
  phone: string;
  work_unit: string; // 1.1
  duties: string; // 1.2
  office: string; // 1.3
  salary: string; // 1.4
  bonus: string; // 1.5
  term: string; // 1.13
};

export type Contract = {
  id: string;
  contract_number: number;
  slug: string;
  employee_id: string | null;
  employee_email: string;
  family_name: string | null;
  given_name: string;
  fields: ContractFields;
  status: ContractStatus;
  employee_signature_path: string | null;
  employee_signed_at: string | null;
  director_note: string | null;
  approved_at: string | null;
  sent_at: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export const STATUS_LABEL: Record<ContractStatus, string> = {
  draft: 'Ноорог',
  sent: 'Ажилтанд илгээсэн',
  signed: 'Захирал баталгаажуулах',
  approved: 'Баталгаажсан',
  returned: 'Буцаагдсан',
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Шинэ гэрээний анхдагч утгууд — «ХӨДӨЛМӨРИЙН ГЭРЭЭ ЖЕННЕТЕКС ХХК» загвараас. */
export function defaultFields(): ContractFields {
  return {
    contract_date: todayKey(),
    register_no: '',
    address: '',
    phone: '',
    work_unit: 'Улаанбаатар хотын Гэр хорооллын өрх болон байгууллагын хэрэглэгчид',
    duties: 'Өрх болон Байгууллагуудын интернетийн кабелийг татах, төхөөрөмж суурилуулж холбох, гэмтэл засварлах',
    office: 'УБ хот БГД 14-р хороо VIP center 403 тоот',
    salary: '2,000,000 төгрөг (2 дахь сараас хоолны мөнгө нэмэгдэнэ)',
    bonus: 'Ажлын гүйцэтгэлд тулгуурлан 500,000 төгрөгийн урамшуулал олгох боломжтой.',
    term: '1 жил',
  };
}

const LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', ө: 'u', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ү: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'sh', ъ: '', ы: 'i', ь: 'i', э: 'e', ю: 'yu', я: 'ya',
};

/** geree.gennetex.com/<slug> — ажилтны нэр (латинаар) + санамсаргүй 4 тэмдэгт. */
export function makeSlug(name: string) {
  const base = String(name || '')
    .toLowerCase()
    .split('')
    .map((ch) => LATIN[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'ajiltan';
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => (b % 36).toString(36)).join('');
  return `${base}-${rand}`;
}

export function contractUrl(slug: string) {
  return `https://${CONTRACT_HOST}/${slug}`;
}

function contractError(error: { code?: string; message?: string }) {
  const m = error.message || '';
  if (/director_only/.test(m)) return new Error('Зөвхөн Захирал баталгаажуулна.');
  if (/invalid_status/.test(m)) return new Error('Гэрээний төлөв өөрчлөгдсөн байна. Хуудсаа шинэчилнэ үү.');
  if (/permission_denied|row-level security|42501/.test(m) || error.code === '42501') return new Error('Энэ үйлдлийг хийх эрхгүй байна.');
  if (error.code === '23505') return new Error('Холбоос давхардлаа. Дахин хадгална уу.');
  return new Error(m || 'Алдаа гарлаа.');
}

const normalize = (row: Record<string, any>): Contract => ({
  ...(row as Contract),
  fields: { ...defaultFields(), ...(row.fields || {}) },
});

export async function fetchContracts(): Promise<Contract[]> {
  const { data, error } = await supabase.from('employment_contracts').select('*').order('created_at', { ascending: false });
  if (error) throw contractError(error);
  return (data || []).map(normalize);
}

export async function fetchContractBySlug(slug: string): Promise<Contract | null> {
  const { data, error } = await supabase.from('employment_contracts').select('*').eq('slug', slug).maybeSingle();
  if (error) throw contractError(error);
  return data ? normalize(data) : null;
}

/** Нэвтэрсэн хэрэглэгчийн өөрийн гэрээнүүд (RLS шүүнэ). */
export async function fetchMyContracts(email: string): Promise<Contract[]> {
  const { data, error } = await supabase
    .from('employment_contracts')
    .select('*')
    .ilike('employee_email', email)
    .neq('status', 'draft')
    .order('created_at', { ascending: false });
  if (error) throw contractError(error);
  return (data || []).map(normalize);
}

export type ContractInput = {
  employee_id: string | null;
  employee_email: string;
  family_name: string;
  given_name: string;
  fields: ContractFields;
};

export async function saveContract(id: string | null, input: ContractInput, creator: { id?: string | null; name?: string | null }) {
  const row = {
    employee_id: input.employee_id,
    employee_email: input.employee_email.trim().toLowerCase(),
    family_name: input.family_name.trim() || null,
    given_name: input.given_name.trim(),
    fields: input.fields,
  };
  if (id) {
    const { data, error } = await supabase.from('employment_contracts').update(row).eq('id', id).select('*');
    if (error) throw contractError(error);
    if (!data?.length) throw new Error('Илгээсэн гэрээг засах боломжгүй.');
    return normalize(data[0]);
  }
  const { data, error } = await supabase
    .from('employment_contracts')
    .insert({ ...row, slug: makeSlug(input.given_name), created_by: creator.id || null, created_by_name: creator.name || null })
    .select('*')
    .single();
  if (error) throw contractError(error);
  return normalize(data);
}

export async function deleteContract(id: string) {
  const { data, error } = await supabase.from('employment_contracts').delete().eq('id', id).select('id');
  if (error) throw contractError(error);
  if (!data?.length) throw new Error('Баталгаажсан гэрээг устгах боломжгүй.');
}

async function notify(contractId: string, event: 'sent' | 'signed' | 'approved' | 'returned') {
  const { data, error } = await supabase.functions.invoke('contract-notify', { body: { contractId, event } });
  if (error || data?.ok === false) throw new Error(`Имэйл илгээж чадсангүй: ${data?.error || error?.message || ''}`);
}

/** Админ → ажилтанд илгээнэ (имэйлтэй). Имэйл амжилтгүй бол гэрээ илгээгдсэн хэвээр, алдааг буцаана. */
export async function sendContract(id: string) {
  const { error } = await supabase.rpc('send_employment_contract', { p_id: id });
  if (error) throw contractError(error);
  await notify(id, 'sent');
}

/** Ажилтан гарын үсэг зурж илгээнэ → Захиралд имэйл. */
export async function signContract(contract: Contract, signaturePng: Blob) {
  const path = `${contract.id}/employee-${Date.now()}.png`;
  const { error: upErr } = await supabase.storage.from('contract-signatures').upload(path, signaturePng, { contentType: 'image/png' });
  if (upErr) throw contractError(upErr);
  const { error } = await supabase.rpc('sign_employment_contract', { p_id: contract.id, p_signature_path: path });
  if (error) throw contractError(error);
  await notify(contract.id, 'signed').catch(() => { /* гэрээ хадгалагдсан — имэйл нь нэмэлт */ });
}

/** Захирал баталгаажуулах / буцаах. */
export async function decideContract(id: string, approve: boolean, note?: string) {
  const { error } = await supabase.rpc('decide_employment_contract', { p_id: id, p_approve: approve, p_note: note || null });
  if (error) throw contractError(error);
  await notify(id, approve ? 'approved' : 'returned').catch(() => { /* имэйл нь нэмэлт */ });
}

export async function signatureUrl(path: string | null) {
  if (!path) return '';
  const { data } = await supabase.storage.from('contract-signatures').createSignedUrl(path, 3600);
  return data?.signedUrl || '';
}

/** Захирлын тамга (актын лавлахын «Захирал» бичлэгээс). */
export async function directorStampUrl() {
  const { data } = await supabase
    .from('act_receiver_contacts')
    .select('stamp_url, signature_url, position, receiver_type')
    .ilike('position', '%захирал%')
    .not('stamp_url', 'is', null)
    .limit(1)
    .maybeSingle();
  return { stamp: data?.stamp_url || '', signature: data?.signature_url || '' };
}

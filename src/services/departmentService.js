/**
 * Хэлтэс — байгууллага ба өрх.
 *
 * Хэлтэс нь хоёр зүйлийг хамтад нь баглана:
 *   • ХҮН   — `profiles.department_id`
 *   • БАРАА — `inventory.department_id`
 *
 * Ахлах (менежер) зөвхөн ӨӨРИЙН хэлтсийн хүн, бараа, багажийг харна.
 * Энэ шүүлт нь сангийн RLS дээр хийгддэг — доорх query-үүд нэмэлт
 * шүүлтгүйгээр ч зөвхөн зөвшөөрөгдсөн мөрийг буцаана.
 *
 * SQL: supabase/migrations/20260817090000_departments_manager_permissions.sql
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const TABLE = 'departments';

/** Хэлтсийн төрөл — шинэ төрөл нэмэхэд энд нэг мөр нэмнэ. */
export const DEPARTMENT_KINDS = [
  { key: 'org', label: 'Байгууллага', icon: '🏢', desc: 'Компанийн бүтцийн нэгж' },
  { key: 'household', label: 'Өрх', icon: '🏠', desc: 'Өрхийн баг, айл өрх' },
];

export const DEFAULT_KIND = 'org';

export function kindLabel(kind) {
  return DEPARTMENT_KINDS.find((k) => k.key === kind)?.label || 'Байгууллага';
}

export function kindIcon(kind) {
  return DEPARTMENT_KINDS.find((k) => k.key === kind)?.icon || '🏢';
}

function requireCloud() {
  if (!isSupabaseConfigured) {
    throw new Error('Хэлтсийн бүртгэл онлайн горимд ажиллана.');
  }
}

/** Бүх хэлтэс. `kind` өгвөл зөвхөн тэр төрлийнхийг. */
export async function fetchDepartments({ kind, includeInactive = false } = {}) {
  if (!isSupabaseConfigured) return [];
  let q = supabase.from(TABLE).select('*').order('name', { ascending: true });
  if (kind) q = q.eq('kind', kind);
  if (!includeInactive) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createDepartment({ name, kind = DEFAULT_KIND, note }) {
  requireCloud();
  const clean = String(name || '').trim();
  if (!clean) throw new Error('Хэлтсийн нэр шаардлагатай.');
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ name: clean, kind, note: note?.trim() || null })
    .select()
    .single();
  if (error) throw new Error(mapDepartmentError(error.message));
  return data;
}

export async function updateDepartment(id, patch) {
  requireCloud();
  const clean = {};
  if (patch.name !== undefined) {
    const name = String(patch.name).trim();
    if (!name) throw new Error('Хэлтсийн нэр шаардлагатай.');
    clean.name = name;
  }
  if (patch.kind !== undefined) clean.kind = patch.kind;
  if (patch.note !== undefined) clean.note = patch.note?.trim() || null;
  if (patch.active !== undefined) clean.active = !!patch.active;

  const { data, error } = await supabase
    .from(TABLE)
    .update(clean)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(mapDepartmentError(error.message));
  return data;
}

/**
 * Хэлтэс устгах.
 *
 * Гишүүнтэй хэлтсийг устгавал тэр хүмүүс харьяалалгүй үлдэж, ахлахынх
 * нь жагсаалтаас алга болно. Тиймээс эхлээд шалгаад ойлгомжтой
 * анхааруулга өгнө.
 */
export async function deleteDepartment(id) {
  requireCloud();
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('department_id', id);
  if (count) {
    throw new Error(`Энэ хэлтэст ${count} хүн бүртгэлтэй байна. Эхлээд тэднийг өөр хэлтэст шилжүүлнэ үү.`);
  }
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(mapDepartmentError(error.message));
}

/** Хэлтсийн гишүүд. */
export async function fetchDepartmentMembers(departmentId) {
  if (!isSupabaseConfigured || !departmentId) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, last_name, email, position, phone, avatar_url, role, department_id, last_seen')
    .eq('department_id', departmentId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Хэлтсийн бараа / багаж.
 *
 * @param category 'material' | 'tool' | undefined (бүгд)
 * @param includeShared Хэлтэст хуваарилаагүй НИЙТИЙН зүйлийг оруулах эсэх.
 */
export async function fetchDepartmentInventory(departmentId, { category, includeShared = false } = {}) {
  if (!isSupabaseConfigured || !departmentId) return [];
  let q = supabase.from('inventory').select('*');
  q = includeShared
    ? q.or(`department_id.eq.${departmentId},department_id.is.null`)
    : q.eq('department_id', departmentId);
  if (category) q = q.eq('category', category);
  const { data, error } = await q.order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Хэлтэст хуваарилаагүй (НИЙТИЙН) бараа, багаж.
 * Хэлтэс рүү татаж оруулах сонголтод ашиглана.
 */
export async function fetchUnassignedInventory({ category } = {}) {
  if (!isSupabaseConfigured) return [];
  let q = supabase.from('inventory').select('*').is('department_id', null);
  if (category) q = q.eq('category', category);
  const { data, error } = await q.order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Хэлтэс бүрийн хүн, барааны тоо — жагсаалтын дэд гарчигт. */
export async function fetchDepartmentCounts() {
  if (!isSupabaseConfigured) return {};
  const [people, items] = await Promise.all([
    supabase.from('profiles').select('department_id').not('department_id', 'is', null),
    supabase.from('inventory').select('department_id').not('department_id', 'is', null),
  ]);
  const out = {};
  const bump = (id, field) => {
    if (!id) return;
    out[id] = out[id] || { members: 0, items: 0 };
    out[id][field] += 1;
  };
  (people.data || []).forEach((r) => bump(r.department_id, 'members'));
  (items.data || []).forEach((r) => bump(r.department_id, 'items'));
  return out;
}

/**
 * Хэрэглэгчийг хэлтэст оноох (эсвэл `null`-аар хэлтсээс хасах).
 *
 * RPC-ээр явна: `profiles.department_id` нь багана түвшинд хаалттай —
 * хэрэглэгч өөрийгөө өөр хэлтэс рүү зөөх боломжгүй байх ёстой.
 */
export async function setUserDepartment(userId, departmentId) {
  requireCloud();
  const { data, error } = await supabase.rpc('admin_set_user_department', {
    target_id: userId,
    p_department_id: departmentId || null,
  });
  if (error) throw new Error(mapDepartmentError(error.message));
  return data;
}

/** Барааг/багажийг хэлтэст хуваарилах. `null` = нийтийн. */
export async function setItemDepartment(itemId, departmentId) {
  requireCloud();
  const { data, error } = await supabase
    .from('inventory')
    .update({ department_id: departmentId || null })
    .eq('id', itemId)
    .select()
    .single();
  if (error) throw new Error(mapDepartmentError(error.message));
  return data;
}

/** Хэрэглэгчийн нарийвчилсан эрх — зөвхөн хөгжүүлэгч. */
export async function setUserPermissions(userId, permissions) {
  requireCloud();
  const { data, error } = await supabase.rpc('admin_set_user_permissions', {
    target_id: userId,
    p_permissions: permissions || {},
  });
  if (error) throw new Error(mapDepartmentError(error.message));
  return data;
}

export function mapDepartmentError(message = '') {
  const m = String(message || '');
  if (/departments_kind_name_uidx|duplicate key/i.test(m)) return 'Ийм нэртэй хэлтэс аль хэдийн байна.';
  if (/department_forbidden/.test(m)) return 'Зөвхөн өөрийн хэлтэс дээр үйлдэл хийнэ.';
  if (/department_not_found/.test(m)) return 'Хэлтэс олдсонгүй.';
  if (/forbidden_target/.test(m)) return 'Энэ хэрэглэгч дээр үйлдэл хийх эрхгүй.';
  if (/forbidden|row-level security/i.test(m)) return 'Танд энэ үйлдлийг хийх эрх байхгүй.';
  if (/target_not_found/.test(m)) return 'Хэрэглэгч олдсонгүй.';
  if (/not_authenticated|no_profile/.test(m)) return 'Дахин нэвтэрнэ үү.';
  if (/Could not find the (function|table)/i.test(m)) {
    return 'Хэлтсийн migration ажиллуулаагүй байна (20260817090000).';
  }
  return m || 'Алдаа гарлаа.';
}

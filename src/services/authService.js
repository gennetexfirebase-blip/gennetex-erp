import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import {
  ROLES,
  normalizeRole,
  isManagerRole,
  isSuperAdmin,
  filterVisibleProfiles,
  canManageProfile,
  allowedAssignRole,
  mapDeleteError,
} from '../lib/roles';

WebBrowser.maybeCompleteAuthSession();

/**
 * Нэвтэрсэн хүний эрх БА хэлтэс.
 *
 * Зөвхөн эрхийг уншиж байсныг өргөтгөв: хэлтсийн хамрах хүрээг
 * шалгахад `department_id` хэрэгтэй (ахлах зөвхөн өөрийн хэлтсийнхээ
 * хүнийг засна).
 */
async function getViewer() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, role, department_id')
    .eq('id', user.id)
    .maybeSingle();
  return data || null;
}

async function getTargetProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('id, role, department_id')
    .eq('id', userId)
    .maybeSingle();
  return data || null;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  await syncProfileAfterAuth();
  return data;
}

export async function signInWithGoogle() {
  const redirectTo = makeRedirectUri({ scheme: 'gennetex-erp', path: 'auth/callback' });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Google нэвтрэх холбоос үүссэнгүй.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) {
    if (result.type === 'cancel' || result.type === 'dismiss') return null;
    throw new Error('Google нэвтрэлт дууссангүй.');
  }

  const { params, errorCode } = QueryParams.getQueryParams(result.url);
  if (errorCode || params?.error) {
    throw new Error(params?.error_description || params?.error || errorCode);
  }

  let sessionResult;
  if (params?.code) {
    sessionResult = await supabase.auth.exchangeCodeForSession(params.code);
  } else if (params?.access_token && params?.refresh_token) {
    sessionResult = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
  } else {
    throw new Error('Google нэвтрэлтийн session ирсэнгүй.');
  }
  if (sessionResult.error) throw sessionResult.error;
  await syncProfileAfterAuth();
  return sessionResult.data;
}

export async function syncProfileAfterAuth() {
  const { data, error } = await supabase.rpc('claim_authorized_profile');
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// 1 удаагийн нууц үг үүсгэх (уншихад ойлгомжтой тэмдэгтүүд)
export function generateOneTimePassword(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// Ажилтан анхны нэвтрэлтийн дараа өөрийн нууц үгээ солино
export async function changeMyPassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', user.id);
  }
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId, patch) {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchEmployees() {
  const viewer = await getViewer();
  const { data, error } = await supabase.rpc('admin_list_authorized_users');
  if (error) throw error;
  const rows = (data || []).map((item) => ({
    ...item,
    id: item.record_id,
    pending: !item.registered,
    permissions: item.permissions || {},
  }));
  // Сервер аль хэдийн зэрэглэл, хэлтсээр шүүсэн. Энд давхар шүүх нь
  // зөвхөн UI-г цэгцлэх зорилготой (жишээ нь migration ажиллаагүй
  // хуучин серверт).
  return filterVisibleProfiles(rows, viewer);
}

/**
 * Хамт олны лавлах — чат, пост, ажилтны мэдээлэлд ашиглана.
 *
 * `fetchEmployees` нь АДМИНЫ УДИРДЛАГЫН жагсаалт: admin_list_authorized_users
 * RPC дуудаж, энгийн ажилтанд `forbidden` шиднэ. Дэлгэцүүд түүнийг
 * `.catch(() => [])`-ээр залгидаг байсан тул ажилтан чат дээр хамт олноо
 * ОГТ ХАРАХГҮЙ байв.
 *
 * Мөн тэр жагсаалт нь системийн админыг (superadmin) нуудаг — удирдлагын
 * хувьд зөв (энгийн админ түүнийг засаж болохгүй), гэхдээ чат/пост дээр
 * буруу: систем админ бол мөн адил хамт олны нэг.
 *
 * Энэ функц `profiles`-ээс шууд уншина. RLS нь нэвтэрсэн бүх хүнд уншихыг
 * зөвшөөрдөг тул эрхээс үл хамааран бүгд бие биенээ харна.
 */
export async function fetchDirectory() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, last_name, email, position, phone, avatar_url, role, department_id, last_seen')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function adminUpdateEmployee(userId, patch) {
  const viewer = await getViewer();
  // Ахлах ч ажилтнаа засна — гэхдээ зөвхөн ӨӨРИЙН хэлтсийнхээ
  // (шалгалт нь `canManageProfile` дотор, мөн серверийн RLS дээр).
  if (!isManagerRole(viewer?.role)) throw new Error('Зөвхөн удирдлага засна.');

  if (String(userId).startsWith('pending:')) {
    throw new Error('Энэ Gmail-ээр хэрэглэгч хараахан нэвтрээгүй байна.');
  }
  const target = await getTargetProfile(userId);
  if (!canManageProfile(viewer, target)) {
    throw new Error('Энэ хэрэглэгчийг засах эрхгүй.');
  }
  const viewerRole = viewer?.role;

  const clean = {};
  if (patch.name !== undefined) clean.name = String(patch.name).trim() || null;
  if (patch.last_name !== undefined) clean.last_name = String(patch.last_name).trim() || null;
  if (patch.address !== undefined) clean.address = String(patch.address).trim() || null;
  if (patch.position !== undefined) clean.position = String(patch.position).trim() || null;
  if (patch.phone !== undefined) clean.phone = String(patch.phone).trim() || null;
  if (patch.can_take_calls !== undefined) {
    if (!isSuperAdmin(viewerRole)) {
      throw new Error('Дуудлагаар явах эрхийг зөвхөн Хөгжүүлэгч өгнө.');
    }
    clean.can_take_calls = !!patch.can_take_calls;
  }

  // ⚠️ `role` болон `department_id` нь БАГАНА ТҮВШИНД хаалттай
  //    (20260811110100_profiles_column_grants.sql, 20260817090000_...).
  //    Шууд `update` хийвэл "permission denied for column" алдаа өгнө.
  //    Тиймээс security definer RPC-ээр тусад нь солино.
  if (patch.role !== undefined) {
    const nextRole = normalizeRole(patch.role);
    if (!allowedAssignRole(viewerRole, nextRole)) {
      throw new Error('Энэ эрхийг оноох боломжгүй.');
    }
    if (nextRole !== normalizeRole(target?.role)) {
      await adminSetUserRole(userId, nextRole);
    }
  }

  if (patch.department_id !== undefined) {
    const nextDept = patch.department_id || null;
    if ((target?.department_id || null) !== nextDept) {
      await adminSetUserDepartment(userId, nextDept);
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(clean)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Хэрэглэгчийг хэлтэст оноох / хэлтсээс хасах (`null`). */
export async function adminSetUserDepartment(userId, departmentId) {
  const { data, error } = await supabase.rpc('admin_set_user_department', {
    target_id: userId,
    p_department_id: departmentId || null,
  });
  if (error) throw new Error(mapDeleteError(error.message));
  return data;
}

/** Системийн админ хэрэглэгчийн нууц үг солино */
export async function adminResetUserPassword(userId, newPassword, forceChange = true) {
  const viewer = await getViewer();
  if (!isSuperAdmin(viewer?.role)) {
    throw new Error('Зөвхөн системийн админ нууц үг солино.');
  }
  const pw = String(newPassword || '').trim();
  if (pw.length < 6) {
    throw new Error('Нууц үг 6+ тэмдэгт байх ёстой.');
  }
  const { error } = await supabase.rpc('admin_reset_user_password', {
    target_user_id: userId,
    new_password: pw,
    force_change: !!forceChange,
  });
  if (error) throw error;
}

/**
 * Хэрэглэгчийг устгана.
 *
 * Эрхийн шалгалт нь SQL талын `admin_delete_user` функцэд байгаа
 * (supabase/migration_admin_delete_user.sql). Энд шалгахгүй — зөвхөн
 * алдааг нь ойлгомжтой текст болгож дамжуулна. Клиент талын шалгалт
 * хамгаалалт биш тул серверийн шийдвэрийг эцсийн үнэн гэж үзнэ.
 *
 *   superadmin → ажилтан + админыг устгана
 *   admin      → зөвхөн ажилтныг устгана
 *   хэн ч      → өөрийгөө болон сүүлчийн superadmin-ийг устгахгүй
 */
export async function adminDeleteUser(userId) {
  // admin_list_authorized_users нь Google-ээр нэвтрээгүй хүнийг
  // id = 'pending:<email>' гэж буцаадаг. Тэдэнд auth.users мөр байхгүй тул
  // устгахын оронд зөвшөөрлийг нь цуцална.
  const id = String(userId || '');
  if (id.startsWith('pending:')) {
    return adminRevokeAuthorization(id.slice('pending:'.length));
  }
  const { data, error } = await supabase.rpc('admin_delete_user', {
    target_id: id,
  });
  if (error) throw new Error(mapDeleteError(error.message));
  return data;
}

/** Google-ээр хараахан нэвтрээгүй хаягийн зөвшөөрлийг цуцална. */
export async function adminRevokeAuthorization(email) {
  const { data, error } = await supabase.rpc('admin_revoke_authorization', {
    p_email: String(email || '').trim().toLowerCase(),
  });
  if (error) throw new Error(mapDeleteError(error.message));
  return data;
}

/** Хэрэглэгчийн эрхийг солино — шалгалт нь мөн SQL талд. */
export async function adminSetUserRole(userId, newRole) {
  const { data, error } = await supabase.rpc('admin_set_user_role', {
    target_id: userId,
    new_role: newRole,
  });
  if (error) throw new Error(mapDeleteError(error.message));
  return data;
}

/**
 * Gmail хаягийг зөвшөөрнө. Хэрэглэгч Google-ээр анх нэвтрэхэд auth
 * user/profile үүснэ.
 *
 * ХЭЛТЭС: `department_id` өгөөгүй бол сервер тал ҮҮСГЭГЧИЙН хэлтсийг
 * автоматаар оноодог — ахлах "хэлтсээ сонгох"-оо мартаад ажилтнаа
 * харьяалалгүй үлдээх эрсдэлгүй.
 */
export async function adminCreateEmployee({
  email,
  name,
  last_name,
  position,
  phone,
  address,
  role = ROLES.EMPLOYEE,
  department_id = null,
}) {
  const viewer = await getViewer();
  // Ахлах ч ажилтан нэмнэ — өөрийн хэлтэст, зөвхөн "Ажилтан" эрхтэйгээр.
  if (!isManagerRole(viewer?.role)) throw new Error('Зөвхөн удирдлага үүсгэнэ.');
  const safeRole = normalizeRole(role);
  if (!allowedAssignRole(viewer?.role, safeRole)) {
    throw new Error('Энэ эрхтэй хэрэглэгч үүсгэх боломжгүй.');
  }
  const { data, error } = await supabase.rpc('admin_authorize_gmail', {
    p_email: email.trim(),
    p_name: name.trim(),
    p_last_name: last_name?.trim() || null,
    p_position: position?.trim() || null,
    p_phone: phone?.trim() || null,
    p_address: address?.trim() || null,
    p_role: safeRole,
    p_department_id: department_id || null,
  });
  if (error) throw new Error(mapDeleteError(error.message));
  return data;
}

/** Хэрэглэгчийн нарийвчилсан эрхийг хадгална — зөвхөн Хөгжүүлэгч. */
export async function adminSetUserPermissions(userId, permissions) {
  const { data, error } = await supabase.rpc('admin_set_user_permissions', {
    target_id: userId,
    p_permissions: permissions || {},
  });
  if (error) throw new Error(mapDeleteError(error.message));
  return data;
}

import { makeRedirectUri, QueryParams } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import {
  ROLES,
  isAdminRole,
  isSuperAdmin,
  filterVisibleProfiles,
  canManageProfile,
  allowedAssignRole,
} from '../lib/roles';

WebBrowser.maybeCompleteAuthSession();

async function getViewerRole() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  return data?.role || null;
}

async function getProfileRole(userId) {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  return data?.role || null;
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
  const viewerRole = await getViewerRole();
  const { data, error } = await supabase.rpc('admin_list_authorized_users');
  if (error) throw error;
  const rows = (data || []).map((item) => ({
    ...item,
    id: item.record_id,
    pending: !item.registered,
  }));
  return filterVisibleProfiles(rows, viewerRole);
}

export async function adminUpdateEmployee(userId, patch) {
  const viewerRole = await getViewerRole();
  if (!isAdminRole(viewerRole)) throw new Error('Зөвхөн админ засна.');

  if (String(userId).startsWith('pending:')) {
    throw new Error('Энэ Gmail-ээр хэрэглэгч хараахан нэвтрээгүй байна.');
  }
  const targetRole = await getProfileRole(userId);
  if (!canManageProfile(viewerRole, targetRole)) {
    throw new Error('Энэ хэрэглэгчийг засах эрхгүй.');
  }

  const clean = {};
  if (patch.name !== undefined) clean.name = String(patch.name).trim() || null;
  if (patch.last_name !== undefined) clean.last_name = String(patch.last_name).trim() || null;
  if (patch.address !== undefined) clean.address = String(patch.address).trim() || null;
  if (patch.position !== undefined) clean.position = String(patch.position).trim() || null;
  if (patch.phone !== undefined) clean.phone = String(patch.phone).trim() || null;
  if (patch.role !== undefined) {
    const nextRole = patch.role === ROLES.ADMIN ? ROLES.ADMIN : patch.role === ROLES.SUPERADMIN ? ROLES.SUPERADMIN : ROLES.EMPLOYEE;
    if (!allowedAssignRole(viewerRole, nextRole)) {
      throw new Error('Энэ эрхийг оноох боломжгүй.');
    }
    clean.role = nextRole;
  }
  if (patch.can_take_calls !== undefined) {
    if (!isSuperAdmin(viewerRole)) {
      throw new Error('Дуудлагаар явах эрхийг зөвхөн Хөгжүүлэгч өгнө.');
    }
    clean.can_take_calls = !!patch.can_take_calls;
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

/** Системийн админ хэрэглэгчийн нууц үг солино */
export async function adminResetUserPassword(userId, newPassword, forceChange = true) {
  const viewerRole = await getViewerRole();
  if (!isSuperAdmin(viewerRole)) {
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

// Админ Gmail хаягийг зөвшөөрнө. Хэрэглэгч Google-ээр анх нэвтрэхэд auth user/profile үүснэ.
export async function adminCreateEmployee({ email, name, last_name, position, phone, address, role = ROLES.EMPLOYEE }) {
  const viewerRole = await getViewerRole();
  if (!isAdminRole(viewerRole)) throw new Error('Зөвхөн админ үүсгэнэ.');
  const safeRole = role === ROLES.ADMIN ? ROLES.ADMIN : role === ROLES.SUPERADMIN ? ROLES.SUPERADMIN : ROLES.EMPLOYEE;
  if (!allowedAssignRole(viewerRole, safeRole)) {
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
  });
  if (error) throw error;
  return data;
}

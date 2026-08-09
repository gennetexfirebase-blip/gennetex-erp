/** Эрхийн төрлүүд: employee | admin | superadmin */

export const ROLES = {
  EMPLOYEE: 'employee',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin',
};

export function isSuperAdmin(role) {
  return role === ROLES.SUPERADMIN;
}

export function isAdminRole(role) {
  return role === ROLES.ADMIN || role === ROLES.SUPERADMIN;
}

export function isRegularAdmin(role) {
  return role === ROLES.ADMIN;
}

export function roleLabel(role) {
  if (role === ROLES.SUPERADMIN) return 'Хөгжүүлэгч';
  if (role === ROLES.ADMIN) return 'Админ';
  return 'Ажилтан';
}

/** Ердийн админ зөвхөн ажилтныг харна; superadmin бүгдийг харна */
export function filterVisibleProfiles(profiles, viewerRole) {
  const list = profiles || [];
  if (isSuperAdmin(viewerRole)) return list;
  if (isRegularAdmin(viewerRole)) {
    return list.filter((p) => p.role === ROLES.EMPLOYEE);
  }
  return list.filter((p) => p.role !== ROLES.SUPERADMIN);
}

export function canManageProfile(viewerRole, targetRole) {
  if (isSuperAdmin(viewerRole)) return true;
  if (!isRegularAdmin(viewerRole)) return false;
  // Ердийн админ зөвхөн ажилтны профайл засна
  return targetRole === ROLES.EMPLOYEE || !targetRole;
}

export function canAssignRoles(viewerRole) {
  return isSuperAdmin(viewerRole);
}

/**
 * Хэрэглэгч дуудлагаар (service call) явж болох эсэх.
 * Ажилтан, админ, системийн админ бүгд дуудлага авна (нэвтэрсэн байхад л болно).
 */
export function canTakeServiceCalls(profile) {
  return !!profile;
}

export function allowedAssignRole(viewerRole, newRole) {
  if (isSuperAdmin(viewerRole)) {
    return [ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN].includes(newRole);
  }
  if (isRegularAdmin(viewerRole)) {
    return newRole === ROLES.EMPLOYEE;
  }
  return false;
}

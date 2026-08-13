/**
 * Эрхийн систем.
 *
 * Зэрэглэлээр загварчилсан: эрх бүр тоон зэрэгтэй бөгөөд шалгалтууд
 * "энэ зэрэглэлээс дээш үү" гэж асууна. Шинэ эрх нэмэхэд бүх шалгалтыг
 * дахин бичих шаардлагагүй — зэрэглэлд нь оруулаад л болно.
 *
 * ЗЭРЭГЛЭЛ:
 *   employee   Ажилтан    үндсэн эрх
 *   nyrav      Нярав      агуулах — бараа, багаж хариуцна
 *   ahlah      Ахлах      багийн ахлагч — ирц, хүсэлт батална
 *   admin      Админ      ажилтан, бүртгэл удирдана
 *   zahiral    Захирал    бүх үйл ажиллагааг хардаг, батална
 *   superadmin Хөгжүүлэгч системийн тохиргоо, эрх олгох
 */

export const ROLES = {
  EMPLOYEE: 'employee',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin',
};

/**
 * Зэрэглэлийн дараалал. Том тоо = өндөр эрх.
 *
 * ЗӨВХӨН 3 ТҮВШИН:
 *   employee   — ажилтан
 *   admin      — админ
 *   superadmin — хөгжүүлэгч, ХАМГИЙН ДЭЭД эрх
 *
 * `nyrav` (нярав), `ahlah` (ахлах), `zahiral` (захирал) нь ЭРХ биш —
 * АЛБАН ТУШААЛ юм. Тэдгээрийг `profiles.position` талбарт бичнэ.
 * Албан тушаалыг эрхтэй хольсноор "нярав бол ямар эрхтэй вэ" гэсэн
 * асуулт байнга гарч, шинэ албан тушаал нэмэх бүрд эрхийн систем
 * дахин бичигдэх шаардлагатай болдог байв.
 *
 * Хуучин өгөгдөлд эдгээр утга үлдсэн байж болзошгүй тул доор
 * буулгалт хийж, эрхийг нь алдагдуулахгүйгээр шинэ түвшинд
 * шилжүүлнэ (`normalizeRole`).
 */
const RANK = {
  [ROLES.EMPLOYEE]: 0,
  [ROLES.ADMIN]: 1,
  [ROLES.SUPERADMIN]: 2,
};

const LABELS = {
  [ROLES.EMPLOYEE]: 'Ажилтан',
  [ROLES.ADMIN]: 'Админ',
  [ROLES.SUPERADMIN]: 'Хөгжүүлэгч',
};

/**
 * Хуучин эрхийн нэрсийг шинэ түвшин рүү буулгана.
 *
 * Өгөгдлийн санд `nyrav`/`ahlah`/`zahiral` үлдсэн хэрэглэгч байвал
 * тэднийг эрхгүй болгож орхивол ажил зогсоно. Тиймээс:
 *   nyrav, ahlah, zahiral → admin
 * гэж буулгана (гурвуулаа удирдлагын үүрэгтэй байсан).
 */
const LEGACY_ROLE_MAP = {
  nyrav: ROLES.ADMIN,
  ahlah: ROLES.ADMIN,
  zahiral: ROLES.ADMIN,
};

export function normalizeRole(role) {
  const r = String(role || '').trim().toLowerCase();
  if (LEGACY_ROLE_MAP[r]) return LEGACY_ROLE_MAP[r];
  return Object.prototype.hasOwnProperty.call(RANK, r) ? r : ROLES.EMPLOYEE;
}

/** Эрхийн жагсаалт — сонгох UI-д. */
export const ROLE_OPTIONS = [
  { key: ROLES.EMPLOYEE, label: LABELS[ROLES.EMPLOYEE], desc: 'Ирц, бараа авах, чат' },
  { key: ROLES.ADMIN, label: LABELS[ROLES.ADMIN], desc: 'Ажилтан, агуулах, ирц, цалин удирдана' },
  { key: ROLES.SUPERADMIN, label: LABELS[ROLES.SUPERADMIN], desc: 'Систем, эрх олгох — хамгийн дээд' },
];

export function rankOf(role) {
  return RANK[normalizeRole(role)] ?? 0;
}

export function roleLabel(role) {
  return LABELS[normalizeRole(role)] || LABELS[ROLES.EMPLOYEE];
}

export function isValidRole(role) {
  const r = String(role || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(RANK, r)
    || Object.prototype.hasOwnProperty.call(LEGACY_ROLE_MAP, r);
}

// ---------------------------------------------------------------------------
// Үндсэн шалгалтууд
// ---------------------------------------------------------------------------

export function isSuperAdmin(role) {
  return role === ROLES.SUPERADMIN;
}

/** Удирдлагын самбарт хандах эрх. */
export function isAdminRole(role) {
  return rankOf(role) >= RANK[ROLES.ADMIN];
}

export function isRegularAdmin(role) {
  return role === ROLES.ADMIN;
}

// ---------------------------------------------------------------------------
// Чадварын шалгалтууд — дэлгэц бүр эрхийн НЭР биш, ЧАДВАРаар шалгана
// ---------------------------------------------------------------------------

/** Бараа, багаж бүртгэх/олгох — админаас дээш. */
export function canManageInventory(role) {
  return rankOf(role) >= RANK[ROLES.ADMIN];
}

/** Ирц, чөлөө, илүү цагийн хүсэлт батлах — админаас дээш. */
export function canApproveRequests(role) {
  return rankOf(role) >= RANK[ROLES.ADMIN];
}

/** Ажилтан үүсгэх, засах — админаас дээш. */
export function canManageEmployees(role) {
  return rankOf(role) >= RANK[ROLES.ADMIN];
}

/** Цалин тогтоох, харах — админаас дээш (эмзэг мэдээлэл). */
export function canManagePayroll(role) {
  return rankOf(role) >= RANK[ROLES.ADMIN];
}

/** Системийн тохиргоо, эрх олгох — зөвхөн хөгжүүлэгч. */
export function canAssignRoles(role) {
  return isSuperAdmin(role);
}

/**
 * Хэрэглэгч дуудлагаар (service call) явж болох эсэх.
 * Нэвтэрсэн бүх хүн авна.
 */
export function canTakeServiceCalls(profile) {
  return !!profile;
}

// ---------------------------------------------------------------------------
// Хэн хэнийг харах / удирдах
// ---------------------------------------------------------------------------

/**
 * Удирдлагын жагсаалтад хэнийг харуулах вэ.
 * Өөрөөсөө ДООШ зэрэглэлтэй хүмүүсийг л харна — тэгснээр ахлах нь
 * захирлын мэдээллийг хардаггүй.
 */
export function filterVisibleProfiles(profiles, viewerRole) {
  const list = profiles || [];

  // Хөгжүүлэгч БҮГДИЙГ харна — өөр хөгжүүлэгчдийг ч оруулаад.
  if (isSuperAdmin(viewerRole)) return list;

  // Эрхийг тодорхойлж чадаагүй бол (сүлжээний алдаа, профайл ачаалагдаагүй)
  // жагсаалтыг ХООСЛОХГҮЙ. Сервер тал аль хэдийн шүүсэн байгаа тул давхар
  // шүүх нь зөвхөн UI-г цэгцлэх зорилготой. Хоословол хэрэглэгч "ажилтан
  // алга" гэж андуурна.
  if (!isValidRole(viewerRole)) return list;

  const mine = rankOf(viewerRole);
  return list.filter((p) => rankOf(p.role) < mine);
}

/** Профайл засах эрх — зөвхөн өөрөөсөө доош. */
export function canManageProfile(viewerRole, targetRole) {
  if (isSuperAdmin(viewerRole)) return true;
  if (!canManageEmployees(viewerRole)) return false;
  return rankOf(targetRole) < rankOf(viewerRole);
}

/**
 * Хэрэглэгчийг устгаж болох эсэх.
 *
 * ⚠️ Энэ нь ЗӨВХӨН UI-г зөв харуулах зорилготой. Жинхэнэ хамгаалалт нь
 * supabase/migration_admin_delete_user.sql доторх `admin_delete_user`
 * функцэд байгаа — апп-ын anon key ил байдаг тул клиент талын шалгалтыг
 * тойрч болно.
 */
export function canDeleteProfile(viewer, target) {
  if (!viewer?.id || !target?.id) return false;
  if (viewer.id === target.id) return false; // өөрийгөө устгахгүй
  if (isSuperAdmin(viewer.role)) return true;
  if (!canManageEmployees(viewer.role)) return false;
  return rankOf(target.role) < rankOf(viewer.role);
}

/** Устгаж болохгүй шалтгааныг хэрэглэгчид ойлгомжтой хэлнэ. */
export function deleteBlockedReason(viewer, target) {
  if (!viewer?.id || !target?.id) return 'Мэдээлэл дутуу байна.';
  if (viewer.id === target.id) return 'Өөрийгөө устгах боломжгүй.';
  if (isSuperAdmin(viewer.role)) return null;
  if (!canManageEmployees(viewer.role)) return 'Танд устгах эрх байхгүй.';
  if (rankOf(target.role) >= rankOf(viewer.role)) {
    return `${roleLabel(target.role)} эрхтэй хэрэглэгчийг устгах боломжгүй.`;
  }
  return null;
}

/** Ямар эрх олгож болох вэ — өөрөөсөө доош. */
export function allowedAssignRole(viewerRole, newRole) {
  if (!isValidRole(newRole)) return false;
  if (isSuperAdmin(viewerRole)) return true;
  if (!canManageEmployees(viewerRole)) return false;
  return rankOf(newRole) < rankOf(viewerRole);
}

/** Тухайн хүн олгож болох эрхийн жагсаалт. */
export function assignableRoles(viewerRole) {
  if (isSuperAdmin(viewerRole)) return ROLE_OPTIONS;
  if (!canManageEmployees(viewerRole)) return [];
  return ROLE_OPTIONS.filter((r) => rankOf(r.key) < rankOf(viewerRole));
}

/** SQL функцийн алдааг монгол текст болгоно. */
export function mapDeleteError(message = '') {
  const m = String(message || '');
  if (/forbidden_target/.test(m)) return 'Танд энэ хэрэглэгчийг устгах эрх байхгүй.';
  if (/cannot_delete_self/.test(m)) return 'Өөрийгөө устгах боломжгүй.';
  if (/last_superadmin/.test(m)) return 'Сүүлчийн хөгжүүлэгчийг устгах боломжгүй.';
  if (/target_not_found/.test(m)) return 'Хэрэглэгч олдсонгүй.';
  if (/already_linked/.test(m)) return 'Энэ хэрэглэгч аль хэдийн нэвтэрсэн байна.';
  if (/not_authenticated|no_profile/.test(m)) return 'Дахин нэвтэрнэ үү.';
  if (/invalid_role/.test(m)) return 'Ийм эрх байхгүй байна.';
  if (/forbidden/.test(m)) return 'Танд устгах эрх байхгүй.';
  return m || 'Устгах үед алдаа гарлаа.';
}

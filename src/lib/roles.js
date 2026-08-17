/**
 * Эрхийн систем.
 *
 * Зэрэглэлээр загварчилсан: эрх бүр тоон зэрэгтэй бөгөөд шалгалтууд
 * "энэ зэрэглэлээс дээш үү" гэж асууна. Шинэ эрх нэмэхэд бүх шалгалтыг
 * дахин бичих шаардлагагүй — зэрэглэлд нь оруулаад л болно.
 *
 * ЗЭРЭГЛЭЛ:
 *   employee   Ажилтан     үндсэн эрх
 *   ahlah      Ахлах       багийнхаа ажилтныг нэмнэ, хэлтсийн агуулахаа хардаг
 *   menejer    Менежер     ХЭЛТСИЙН УДИРДАГЧ — ахлах, ажилтан, агуулахаа удирдана
 *   admin      Админ       компанийн хэмжээний удирдлага, цалин
 *   superadmin Хөгжүүлэгч  систем, эрх олгох, ХЭЛТЭС үүсгэх
 */

export const ROLES = {
  EMPLOYEE: 'employee',
  AHLAH: 'ahlah',
  MENEJER: 'menejer',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin',
};

/**
 * Зэрэглэлийн дараалал. Том тоо = өндөр эрх.
 *
 * 5 ТҮВШИН:
 *   employee   — ажилтан
 *   ahlah      — ахлах, багийн удирдагч
 *   menejer    — менежер, ХЭЛТСИЙН удирдагч (хэлтсийн админ)
 *   admin      — админ
 *   superadmin — хөгжүүлэгч, ХАМГИЙН ДЭЭД эрх
 *
 * ⚠️ АХЛАХ/МЕНЕЖЕР БА ХЭЛТЭС САЛШГҮЙ:
 *   Тэдний эрх нь ӨӨРИЙН ХЭЛТСЭЭР хязгаарлагдана. Энэ файл дахь
 *   зэрэглэлийн шалгалт нь "юу хийж чадах вэ", хэлтсийн шүүлт нь
 *   "хэн дээр хийж чадах вэ"-г шийднэ. Хоёулаа сангийн талд бас
 *   давхарлагдсан (20260817090000_departments_manager_permissions.sql).
 *
 * `nyrav` (нярав), `zahiral` (захирал) нь ЭРХ биш — АЛБАН ТУШААЛ.
 * Тэдгээрийг `profiles.position` талбарт бичнэ. Хуучин өгөгдөлд
 * үлдсэн байвал доор буулгалт хийнэ (`normalizeRole`).
 */
const RANK = {
  [ROLES.EMPLOYEE]: 0,
  [ROLES.AHLAH]: 1,
  [ROLES.MENEJER]: 2,
  [ROLES.ADMIN]: 3,
  [ROLES.SUPERADMIN]: 4,
};

const LABELS = {
  [ROLES.EMPLOYEE]: 'Ажилтан',
  [ROLES.AHLAH]: 'Ахлах',
  [ROLES.MENEJER]: 'Менежер',
  [ROLES.ADMIN]: 'Админ',
  [ROLES.SUPERADMIN]: 'Хөгжүүлэгч',
};

/**
 * Хуучин эрхийн нэрсийг шинэ түвшин рүү буулгана.
 *
 * Өгөгдлийн санд `nyrav`/`zahiral` үлдсэн хэрэглэгч байвал тэднийг
 * эрхгүй болгож орхивол ажил зогсоно. Тиймээс админ руу буулгана
 * (хоёулаа удирдлагын үүрэгтэй байсан).
 *
 * `ahlah` нь ОДОО ЖИНХЭНЭ ЭРХ тул энд байхгүй.
 */
const LEGACY_ROLE_MAP = {
  nyrav: ROLES.ADMIN,
  zahiral: ROLES.ADMIN,
};

export function normalizeRole(role) {
  const r = String(role || '').trim().toLowerCase();
  if (LEGACY_ROLE_MAP[r]) return LEGACY_ROLE_MAP[r];
  return Object.prototype.hasOwnProperty.call(RANK, r) ? r : ROLES.EMPLOYEE;
}

/** Эрхийн жагсаалт — сонгох UI-д. */
export const ROLE_OPTIONS = [
  { key: ROLES.EMPLOYEE, label: LABELS[ROLES.EMPLOYEE], desc: 'Ирц, миний үлдэгдэл, чат' },
  { key: ROLES.AHLAH, label: LABELS[ROLES.AHLAH], desc: 'Багийнхаа ажилтныг нэмнэ · хэлтсийнхээ бараа, багаж' },
  { key: ROLES.MENEJER, label: LABELS[ROLES.MENEJER], desc: 'Хэлтсийн удирдагч — ахлах, ажилтан, агуулахаа удирдана' },
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

/** Удирдлагын самбарт хандах эрх (админ ба хөгжүүлэгч). */
export function isAdminRole(role) {
  return rankOf(role) >= RANK[ROLES.ADMIN];
}

/**
 * Ахлахаас дээш — хүн ба агуулах удирдах эрхтэй бүлэг.
 *
 * `isAdminRole`-оос ялгаатай: ахлах багтана. Ахлахын харах хүрээ нь
 * ӨӨРИЙН ХЭЛТСЭЭР хязгаарлагдана (`inScope`, серверийн RLS).
 */
export function isManagerRole(role) {
  return rankOf(role) >= RANK[ROLES.AHLAH];
}

export function isAhlah(role) {
  return normalizeRole(role) === ROLES.AHLAH;
}

export function isMenejer(role) {
  return normalizeRole(role) === ROLES.MENEJER;
}

export function isRegularAdmin(role) {
  return role === ROLES.ADMIN;
}

// ---------------------------------------------------------------------------
// Чадварын шалгалтууд — дэлгэц бүр эрхийн НЭР биш, ЧАДВАРаар шалгана
// ---------------------------------------------------------------------------

/** Бараа, багаж бүртгэх/олгох — ахлахаас дээш (ахлах зөвхөн хэлтсийнхээ). */
export function canManageInventory(role) {
  return rankOf(role) >= RANK[ROLES.AHLAH];
}

/** Ирц, чөлөө, илүү цагийн хүсэлт батлах — ахлахаас дээш. */
export function canApproveRequests(role) {
  return rankOf(role) >= RANK[ROLES.AHLAH];
}

/** Ажилтан үүсгэх, засах — ахлахаас дээш (ахлах зөвхөн хэлтсийнхээ). */
export function canManageEmployees(role) {
  return rankOf(role) >= RANK[ROLES.AHLAH];
}

/**
 * Хэлтэс үүсгэх, засах, устгах — ЗӨВХӨН ХӨГЖҮҮЛЭГЧ.
 *
 * Хэлтэс бол эрхийн ХИЛ: хэн хэнийг харах, хэн хэнийг нэмэхийг тодорхойлно.
 * Тиймээс хэлтэс үүсгэх, тэр хэлтсийн МЕНЕЖЕРийг томилохыг нэг л газраас
 * хийнэ. Шаардлагатай бол хөгжүүлэгч тодорхой нэг хүнд `departments`
 * эрхийг тусгайлан нээж өгнө (`src/lib/permissions.js`).
 */
export function canManageDepartments(role) {
  return isSuperAdmin(role);
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
// Хэлтсийн хамрах хүрээ
// ---------------------------------------------------------------------------
//
// Эдгээр функц нь профайл ЭСВЭЛ эрхийн нэрийг хоёуланг нь хүлээж авна.
// Хуучин дуудлагууд (`canManageProfile(role, role)`) хэвээр ажиллана —
// зөвхөн бүтэн профайл дамжуулсан үед хэлтсийн шалгалт нэмэгдэнэ.

const roleOf = (x) => (typeof x === 'string' ? x : x?.role);
/** `undefined` = мэдэгдэхгүй (шалгахгүй), `null` = харьяалалгүй. */
const deptOf = (x) => (typeof x === 'string' || x == null ? undefined : x.department_id ?? null);

/**
 * Тухайн хэлтсийн өгөгдөл харагдах эсэх.
 *
 *   хөгжүүлэгч            → үргэлж тийм
 *   харьяалалгүй хэрэглэгч → тийм (компанийн хэмжээний админ)
 *   харьяалалтай          → зөвхөн өөрийн хэлтэс
 *
 * @param sharedWhenNull Хэлтэсгүй өгөгдлийг НИЙТИЙНХ гэж үзэх эсэх.
 *   Бараа, багажид `true` (хэлтэст хуваарилаагүй бол бүгд харна),
 *   хүнд `false` (харьяалалгүй хүн бол хэлтсийн жагсаалтад орохгүй).
 */
export function inDepartmentScope(viewer, targetDeptId, sharedWhenNull = true) {
  if (isSuperAdmin(roleOf(viewer))) return true;
  const mine = deptOf(viewer);
  if (mine === undefined || mine === null) return true;
  if (targetDeptId == null) return sharedWhenNull;
  return targetDeptId === mine;
}

/** Хоёр хүн нэг хэлтэст байгаа эсэх (харьяалалгүй бол үгүй). */
export function sameDepartment(viewer, target) {
  const theirs = deptOf(target);
  // Зорилтот хүний хэлтэс мэдэгдэхгүй бол (зөвхөн эрхийн нэр дамжсан)
  // шалгалтыг алгасана — эс тэгвээс хуучин дуудлагууд худал `false` авна.
  if (theirs === undefined) return true;
  return inDepartmentScope(viewer, theirs, false);
}

// ---------------------------------------------------------------------------
// Хэн хэнийг харах / удирдах
// ---------------------------------------------------------------------------

/**
 * Удирдлагын жагсаалтад хэнийг харуулах вэ.
 *
 * ХОЁР ШҮҮЛТ:
 *   1. Зэрэглэл — өөрөөсөө ДООШ хүмүүсийг л харна (ахлах админыг харахгүй).
 *   2. Хэлтэс   — харьяалалтай бол зөвхөн ӨӨРИЙН хэлтсийнхнийг харна.
 *
 * @param viewer Бүтэн профайл (хэлтэс шүүх бол) эсвэл эрхийн нэр.
 */
export function filterVisibleProfiles(profiles, viewer) {
  const list = profiles || [];
  const viewerRole = roleOf(viewer);

  // Хөгжүүлэгч БҮГДИЙГ харна — өөр хөгжүүлэгчдийг ч оруулаад.
  if (isSuperAdmin(viewerRole)) return list;

  // Эрхийг тодорхойлж чадаагүй бол (сүлжээний алдаа, профайл ачаалагдаагүй)
  // жагсаалтыг ХООСЛОХГҮЙ. Сервер тал аль хэдийн шүүсэн байгаа тул давхар
  // шүүх нь зөвхөн UI-г цэгцлэх зорилготой. Хоословол хэрэглэгч "ажилтан
  // алга" гэж андуурна.
  if (!isValidRole(viewerRole)) return list;

  const mine = rankOf(viewerRole);
  return list.filter((p) => rankOf(p.role) < mine && sameDepartment(viewer, p));
}

/** Профайл засах эрх — өөрөөсөө доош, өөрийн хэлтэст. */
export function canManageProfile(viewer, target) {
  const viewerRole = roleOf(viewer);
  if (isSuperAdmin(viewerRole)) return true;
  if (!canManageEmployees(viewerRole)) return false;
  if (!sameDepartment(viewer, target)) return false;
  return rankOf(roleOf(target)) < rankOf(viewerRole);
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
  if (!sameDepartment(viewer, target)) return false;
  return rankOf(target.role) < rankOf(viewer.role);
}

/** Устгаж болохгүй шалтгааныг хэрэглэгчид ойлгомжтой хэлнэ. */
export function deleteBlockedReason(viewer, target) {
  if (!viewer?.id || !target?.id) return 'Мэдээлэл дутуу байна.';
  if (viewer.id === target.id) return 'Өөрийгөө устгах боломжгүй.';
  if (isSuperAdmin(viewer.role)) return null;
  if (!canManageEmployees(viewer.role)) return 'Танд устгах эрх байхгүй.';
  if (!sameDepartment(viewer, target)) {
    return 'Өөр хэлтсийн хүнийг устгах боломжгүй.';
  }
  if (rankOf(target.role) >= rankOf(viewer.role)) {
    return `${roleLabel(target.role)} эрхтэй хэрэглэгчийг устгах боломжгүй.`;
  }
  return null;
}

/**
 * Ямар эрх олгож болох вэ.
 *
 * ДҮРЭМ: админ ч, ахлах ч ЗӨВХӨН "Ажилтан" эрхтэй хүн нэмнэ. Ахлах,
 * админ, хөгжүүлэгч эрхийг ЗӨВХӨН хөгжүүлэгч олгоно. Ингэснээр админ
 * өөртэйгөө адил (эсвэл дээш) эрхтэй хүн үржүүлэх зам хаагдана.
 * Сервер тал мөн адил шалгана (`role_forbidden`).
 */
export function allowedAssignRole(viewerRole, newRole) {
  if (!isValidRole(newRole)) return false;
  if (isSuperAdmin(viewerRole)) return true;
  if (!canManageEmployees(viewerRole)) return false;
  return normalizeRole(newRole) === ROLES.EMPLOYEE;
}

/** Тухайн хүн олгож болох эрхийн жагсаалт. */
export function assignableRoles(viewerRole) {
  if (isSuperAdmin(viewerRole)) return ROLE_OPTIONS;
  if (!canManageEmployees(viewerRole)) return [];
  return ROLE_OPTIONS.filter((r) => r.key === ROLES.EMPLOYEE);
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
  if (/department_forbidden/.test(m)) return 'Зөвхөн өөрийн хэлтэс дээр үйлдэл хийнэ.';
  if (/department_not_found/.test(m)) return 'Хэлтэс олдсонгүй.';
  if (/forbidden/.test(m)) return 'Танд устгах эрх байхгүй.';
  return m || 'Устгах үед алдаа гарлаа.';
}

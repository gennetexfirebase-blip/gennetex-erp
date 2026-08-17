/**
 * Нарийвчилсан эрх — хүн тус бүрээр.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ:
 *   `roles.js` нь ЗЭРЭГЛЭЛээр шийддэг: "админ бол цалин харна". Гэвч
 *   бодит амьдрал дээр "энэ ахлахад цалин нээж өгье", "тэр админд
 *   агуулах хэрэггүй" гэсэн тохиолдол гарна. Зэрэглэл болгонд шинэ
 *   эрх зохиовол систем 10 түвшин болж хөөрөгдөнө.
 *
 * ШИЙДЭЛ — ХОЁР ДАВХАР:
 *   1. Эрхийн түвшний АНХНЫ УТГА (`roles.js`-ээс гарна)
 *   2. Хөгжүүлэгчийн ТУСГАЙ ЗӨВШӨӨРӨЛ (`profiles.permissions` jsonb)
 *
 *   Тусгай зөвшөөрөл байвал тэр нь ялна. Байхгүй бол түвшний утга.
 *
 * ⚠️ Хөгжүүлэгчийн эрхийг ХЭЗЭЭ Ч хаахгүй — эс тэгвээс өөрийгөө
 *    системээс түгжих (lockout) эрсдэлтэй.
 *
 * ⚠️ Энэ файл нь UI-г зөв харуулах зорилготой. Жинхэнэ хамгаалалт нь
 *    өгөгдлийн сангийн RLS болон RPC-д байгаа
 *    (20260817090000_departments_manager_permissions.sql).
 */
import {
  ROLES,
  normalizeRole,
  canManageEmployees,
  canManageDepartments,
  canManageInventory,
  canApproveRequests,
  canManagePayroll,
} from './roles';

/**
 * Тохируулж болох эрхүүд.
 *
 * `key` нь HomeScreen дэх модулийн `need` талбартай ЯГ таарна — шинэ
 * түлхүүр нэмэхэд модулийн шүүлт өөрөө ажиллана.
 */
export const PERMISSIONS = [
  {
    key: 'employees',
    label: 'Ажилтан удирдах',
    desc: 'Ажилтан нэмэх, засах, хасах',
  },
  {
    key: 'departments',
    label: 'Хэлтэс удирдах',
    desc: 'Хэлтэс үүсгэх, засах, устгах',
  },
  {
    key: 'inventory',
    label: 'Бараа, багаж',
    desc: 'Агуулах бүртгэх, ажилтанд олгох',
  },
  {
    key: 'approve',
    label: 'Ирц, хүсэлт батлах',
    desc: 'Ирц, чөлөө, ажлын байр, дуудлага',
  },
  {
    key: 'payroll',
    label: 'Цалин',
    desc: 'Цалин тооцох, харах — эмзэг мэдээлэл',
  },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

/**
 * Эрхийн түвшний анхны утга.
 *
 * `roles.js`-ийн чадварын функцээс ШУУД гаргаж авна. Хоёр газар
 * жагсаалт хөтөлбөл нэг нь хоцорч "яагаад ахлах агуулах харахгүй
 * байна вэ" гэсэн алдаа гарна.
 */
export function roleDefaultPermission(role, key) {
  switch (key) {
    case 'employees':
      return canManageEmployees(role);
    case 'departments':
      return canManageDepartments(role);
    case 'inventory':
      return canManageInventory(role);
    case 'approve':
      return canApproveRequests(role);
    case 'payroll':
      return canManagePayroll(role);
    default:
      return false;
  }
}

/**
 * Хэрэглэгч тухайн эрхтэй эсэх.
 *
 * @param profile Бүтэн профайл (`permissions` талбартай нь).
 */
export function hasPermission(profile, key) {
  const role = normalizeRole(profile?.role);
  // Хөгжүүлэгчийг хэзээ ч хаахгүй.
  if (role === ROLES.SUPERADMIN) return true;

  const override = profile?.permissions?.[key];
  if (typeof override === 'boolean') return override;
  return roleDefaultPermission(role, key);
}

/** Бүх эрхийн эцсийн утга — HomeScreen-ийн модуль шүүлтэд. */
export function effectivePermissions(profile) {
  const out = {};
  for (const key of PERMISSION_KEYS) out[key] = hasPermission(profile, key);
  return out;
}

/**
 * Утга хаанаас гарсныг хэлнэ — тохиргооны дэлгэц дээр
 * "Түвшнээс" эсвэл "Тусгайлан нээсэн" гэж ялгаж харуулна.
 */
export function permissionSource(profile, key) {
  if (normalizeRole(profile?.role) === ROLES.SUPERADMIN) return 'superadmin';
  return typeof profile?.permissions?.[key] === 'boolean' ? 'override' : 'role';
}

/**
 * Тохиргоо солих — шинэ `permissions` объект буцаана.
 *
 * Түвшний утгатай ижил болгож тохируулбал override-ыг УСТГАНА.
 * Ингэснээр хожим эрхийн түвшин нь өөрчлөгдөхөд хүн автоматаар
 * дагаж шинэчлэгдэнэ (хуучин хатуу утга дээр гацахгүй).
 */
export function togglePermission(profile, key, nextValue) {
  const current = { ...(profile?.permissions || {}) };
  if (roleDefaultPermission(normalizeRole(profile?.role), key) === nextValue) {
    delete current[key];
  } else {
    current[key] = nextValue;
  }
  return current;
}

/** Бүх тусгай тохиргоог цэвэрлэж, эрхийн түвшинд буцаана. */
export function resetPermissions() {
  return {};
}

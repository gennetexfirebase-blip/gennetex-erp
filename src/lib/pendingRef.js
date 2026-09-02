/**
 * Бүртгэгдээгүй ажилтны лавлагааг задлах.
 *
 * ⚠️ `admin_list_authorized_users` нь бүртгэгдсэн БОЛОН бүртгэгдээгүй
 *    ажилтныг хоёуланг буцаадаг. Бүртгэгдсэн хүний `id` нь
 *    `profiles.id` (uuid); бүртгэгдээгүй хүнийх нь
 *    `pending:<email>` гэсэн ТЕКСТ — түүнд `auth.users` мөр байхгүй.
 *
 *    Тэр текстийг uuid багана руу шууд бичвэл өгөгдлийн сан
 *    "invalid input syntax for type uuid" гэж унана. Энэ нь бараа,
 *    машин олгох урсгалд яг ингэж тохиолдож, шинэ ажилтанд юу ч
 *    олгох боломжгүй байв.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return UUID_RE.test(String(value || ''));
}

/**
 * Ажилтны бичлэгээс өгөгдлийн санд бичихэд аюулгүй лавлагаа гаргана.
 *
 * @returns {{ id: string|null, email: string|null }}
 *   `id`    — зөвхөн жинхэнэ uuid байвал, эс бөгөөс `null`
 *   `email` — бүртгэгдээгүй үед хүнийг заах цорын ганц зам
 */
export function employeeRef(employee) {
  if (!employee) return { id: null, email: null };

  const raw = String(employee.user_id || employee.id || '');
  const email =
    employee.email ||
    (raw.startsWith('pending:') ? raw.slice('pending:'.length) : null);

  return {
    id: isUuid(employee.user_id) ? employee.user_id : isUuid(raw) ? raw : null,
    email: email ? String(email).trim().toLowerCase() : null,
  };
}

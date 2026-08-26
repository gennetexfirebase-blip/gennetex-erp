/** Хайлт/шүүлтүүрээр олдсонгүй үед харуулах нэгдсэн мессеж */
export const ERP_NOT_FOUND = 'ERP-аас олдсонгүй';

export function searchEmptyText(query, defaultText = ERP_NOT_FOUND) {
  return String(query || '').trim() ? ERP_NOT_FOUND : defaultText;
}

/**
 * Техникийн алдааг ХЭРЭГЛЭГЧИЙН ХЭЛЭЭР харуулах.
 *
 * ЯАГААД:
 *   Supabase/PostgREST-ийн алдаа нь англи, техникийн үг агуулдаг:
 *     "new row violates row-level security policy for table messages"
 *     "JWT expired" · "Failed to fetch" · "duplicate key value ..."
 *   Ийм текст ажилтанд утгагүй бөгөөд App Store / Play-ийн шүүгч үүнийг
 *   "дуусаагүй апп" гэж үздэг. Мөн хүснэгтийн нэр, багана зэрэг дотоод
 *   бүтцээ ил гаргах нь мэдээлэл алдагдуулах эрсдэлтэй.
 *
 *   Тодорхойгүй алдааг ерөнхий мессеж болгож хувиргана; дэлгэрэнгүйг
 *   зөвхөн хөгжүүлэгчийн лог руу үлдээнэ.
 */
export function friendlyError(error, fallback = 'Алдаа гарлаа. Дахин оролдоно уу.') {
  const raw = String(error?.message || error || '').trim();
  if (!raw) return fallback;
  const m = raw.toLowerCase();

  // Сүлжээ
  if (/network request failed|failed to fetch|networkerror|timeout|aborted/.test(m)) {
    return 'Интернэт холболт тасарсан байна. Холболтоо шалгаад дахин оролдоно уу.';
  }
  // Нэвтрэлт
  if (/jwt expired|token is expired|invalid refresh token|session.*(expired|missing)/.test(m)) {
    return 'Нэвтэрсэн хугацаа дууссан байна. Дахин нэвтэрнэ үү.';
  }
  if (/invalid login credentials|invalid email or password/.test(m)) {
    return 'И-мэйл эсвэл нууц үг буруу байна.';
  }
  if (/email not confirmed/.test(m)) {
    return 'И-мэйл хаягаа баталгаажуулаагүй байна.';
  }
  if (/rate limit|too many requests|429/.test(m)) {
    return 'Хэт олон оролдлого хийлээ. Хэсэг хүлээгээд дахин оролдоно уу.';
  }
  // Эрх
  if (/row-level security|permission denied|not authorized|forbidden|42501|401|403/.test(m)) {
    return 'Танд энэ үйлдлийг хийх эрх алга. Админд хандана уу.';
  }
  // Өгөгдөл
  if (/duplicate key|already exists|unique constraint/.test(m)) {
    return 'Энэ мэдээлэл аль хэдийн бүртгэгдсэн байна.';
  }
  if (/violates foreign key|does not exist|not found|pgrst116/.test(m)) {
    return ERP_NOT_FOUND;
  }
  if (/payload too large|file size|413/.test(m)) {
    return 'Файлын хэмжээ хэт том байна.';
  }

  // Кирилл үсэгтэй бол манай өөрсдийн бичсэн мессеж — шууд харуулна.
  if (/[Ѐ-ӿ]/.test(raw)) return raw;

  // Танигдаагүй техникийн текстийг хэрэглэгчид ХАРУУЛАХГҮЙ.
  if (__DEV__) console.warn('[error]', raw);
  return fallback;
}

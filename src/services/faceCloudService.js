/**
 * Үүлэн царай таних — ИДЭВХГҮЙ.
 *
 * ⚠️ 2026-08-31: Luxand.cloud рүү зураг илгээдэг бүх код УСТГАВ.
 *
 *    Шалтгаан: биометрик өгөгдөл гуравдагч талын үүл рүү явах нь App
 *    Store болон Google Play хоёуланд хамгийн эмзэг ангилал. Token нь
 *    аль хэдийн хоосон байсан тул код хэзээ ч ажилладаггүй байсан ч
 *    сүлжээний дуудлага эх кодод үлдсэн нь дэлгүүрийн шалгалтад
 *    "зарлаагүй гуравдагч тал" гэж тооцогдох эрсдэлтэй байв
 *    (Apple 5.1.1(i), Play · Data Safety).
 *
 *    Царай таних нь одоо ХОЁР зам үлдсэн, хоёул өөрсдийн дэд бүтцэд:
 *      • төхөөрөмж дээрх ONNX загвар (`faceService`)
 *      • Supabase Edge Function (`face-verify`)
 *
 *    API-г хэвээр үлдээв: `AttendanceScreen` эдгээрийг дууддаг бөгөөд
 *    `isCloudFaceConfigured === false` тул мөчир нь хэзээ ч
 *    ажиллахгүй. Дуудагдвал чимээгүй өнгөрөхийн оронд тодорхой алдаа
 *    шидэж, буруу замаар явахаас сэргийлнэ.
 */

/** Үргэлж `false` — үүлэн горим бүрмөсөн хаагдсан. */
export const isCloudFaceConfigured = false;

/** Хуучин дуудлагын нийцлийн үүднээс үлдээв. */
export const CLOUD_ENROLL_TARGET = 3;

function disabled(what) {
  return new Error(
    `Үүлэн царай таних идэвхгүй (${what}). ` +
      'Төхөөрөмж дээрх таних, эсвэл face-verify функцийг ашиглана уу.'
  );
}

export async function getFaceUuid() {
  throw disabled('getFaceUuid');
}

export async function enrollPhoto() {
  throw disabled('enrollPhoto');
}

/**
 * Бүртгэгдсэн өнцгийн тоо.
 *
 * Энэ нь дэлгэц ачаалахад дуудагддаг тул алдаа шидвэл UI унана —
 * 0 буцаана (өөрөөр хэлбэл "бүртгэгдээгүй").
 */
export async function countEnrollments() {
  return 0;
}

export async function verifyFace() {
  throw disabled('verifyFace');
}

export async function setFaceEnrolled() {
  throw disabled('setFaceEnrolled');
}

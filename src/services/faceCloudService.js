import { supabase } from '../lib/supabase';

/**
 * Үүлэн царай таних (Luxand Cloud) — Expo Go дээр ажиллана.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ:
 *   Үндсэн `faceService.js` нь Google ML Kit (царай илрүүлэх) + OpenCV SFace
 *   ONNX (embedding) ашигладаг. Хоёулаа NATIVE модуль тул Expo Go дээр
 *   ачаалагдахгүй — Expo Go нь тогтмол багц модультой ирдэг.
 *
 *   Энэ файл нь зөвхөн HTTPS хүсэлт явуулдаг тул Expo Go дээр ажиллана.
 *
 * ХЭЗЭЭ АЛЬ НЬ АЖИЛЛАХ ВЭ (faceService.js доторх router шийднэ):
 *   Development build / APK  →  ML Kit + SFace (утсан дээр, оффлайн, үнэгүй)
 *   Expo Go                  →  энэ файл (үүлэн, интернэт шаардана)
 *
 * ХЯЗГААР:
 *   • Интернэт заавал шаардана
 *   • Зураг Luxand серверт илгээгдэнэ — хувийн мэдээллийн бодлогод тусгах ёстой
 *   • Luxand-ын үнэгүй хязгаараас хэтэрвэл төлбөртэй
 */

// EXPO_PUBLIC_* нь bundle дотор ил үлддэг тул түлхүүрийг эндээс уншихгүй.
// Мөн энэ зам нь ажилтны ЦАРАЙГ гуравдагч тал руу илгээдэг — үндсэн зам
// болох өөрсдийн face-verify Edge Function байгаа тул анхдагчаар унтраалттай.
const TOKEN = '';
const BASE = 'https://api.luxand.cloud';

/** Таарцын босго (0..1). Ирц бүртгэлд алдаатай таних нь эрсдэлтэй тул өндөр. */
const MATCH_THRESHOLD = 0.9;

export const isCloudFaceConfigured = !!TOKEN;

/** Үүлэн горимд 3 өнцөг хангалттай — утсан дээрхтэй ижил. */
export const CLOUD_ENROLL_TARGET = 3;

function normalizeResults(j) {
  if (Array.isArray(j)) return j;
  if (Array.isArray(j?.faces)) return j.faces;
  if (Array.isArray(j?.result)) return j.result;
  return [];
}

async function luxand(path, form, method = 'POST') {
  if (!TOKEN) throw new Error('Expo Go cloud face token тохируулаагүй байна.');
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { token: TOKEN },
    ...(form ? { body: form } : {}),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error('Царай таних үйлчилгээнээс буруу хариу ирлээ.');
  }
  if (res.status === 401 || res.status === 403) {
    // Токен өөрөө татгалзагдсан — кодын алдаа биш, бүртгэлийн асуудал.
    // Ойлгомжтой хэлж өгвөл админ хаанаас засахаа мэднэ.
    throw new Error(
      'Царай таних үйлчилгээний түлхүүр хүчингүй байна (401).\n\n' +
        'dashboard.luxand.cloud → Token хэсгээс шинэ түлхүүр авч, ' +
        '.env доторх EXPO_PUBLIC_LUXAND_TOKEN-г шинэчилнэ үү. ' +
        'Үнэгүй хязгаар дууссан бол мөн ийм алдаа гарна.'
    );
  }
  if (res.status === 429) {
    throw new Error('Царай таних хүсэлт хэт олон боллоо. Хэсэг хүлээгээд дахин оролдоно уу.');
  }
  if (!res.ok || json.error) {
    throw new Error(json.error || `Царай таних алдаа (${res.status})`);
  }
  return json;
}

/** Шинэ хүн үүсгэнэ, uuid буцаана. */
async function createPerson(name, photoUri) {
  const form = new FormData();
  form.append('name', name || 'Employee');
  form.append('store', '1');
  form.append('photos', { uri: photoUri, name: 'face.jpg', type: 'image/jpeg' });
  const j = await luxand('/v2/person', form);
  const uuid = j.uuid || j.id;
  if (!uuid) throw new Error('Царайны cloud бүртгэлийн ID ирсэнгүй. Дахин оролдоно уу.');
  return uuid;
}

/** Байгаа хүнд нэмэлт өнцгийн зураг нэмнэ. */
async function addPhoto(uuid, photoUri) {
  const form = new FormData();
  form.append('photos', { uri: photoUri, name: 'face.jpg', type: 'image/jpeg' });
  form.append('store', '1');
  return luxand(`/v2/person/${uuid}`, form);
}

/** Selfie-г бүртгэлтэй хүмүүстэй тулгана. */
async function searchPhoto(uri) {
  const form = new FormData();
  form.append('photo', { uri, name: 'selfie.jpg', type: 'image/jpeg' });
  const j = await luxand('/photo/search/v2', form);
  return normalizeResults(j);
}

// ---------------------------------------------------------------------------
// Нийтийн API — faceService.js-ийн гарын үсэгтэй нийцүүлсэн
// ---------------------------------------------------------------------------

/** Хэрэглэгчийн Luxand дахь ID. */
export async function getFaceUuid(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('face_uuid')
    .eq('id', userId)
    .maybeSingle();
  return data?.face_uuid || null;
}

/**
 * Нэг өнцгийн зургийг бүртгэнэ.
 * Эхний зураг хүнийг үүсгэж, дараагийнх нь өнцөг нэмнэ.
 */
export async function enrollPhoto({ userId, userName, uri, pose }) {
  if (!isCloudFaceConfigured) {
    throw new Error('Царай таних үйлчилгээ тохируулаагүй байна. Админд хандана уу.');
  }
  let uuid = await getFaceUuid(userId);
  if (!uuid) {
    uuid = await createPerson(userName, uri);
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ face_uuid: uuid })
      .eq('id', userId);
    if (profileError) throw profileError;
  } else {
    await addPhoto(uuid, uri);
  }

  const { error } = await supabase.from('face_enrollments').insert({
    user_id: userId,
    user_name: userName,
    photo_url: pose || null,
  });
  if (error) throw error;
  return uuid;
}

/** Бүртгэсэн өнцгийн тоо. */
export async function countEnrollments(userId) {
  const { count, error } = await supabase
    .from('face_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return count || 0;
}

/**
 * Selfie нь тухайн ажилтны царай мөн эсэхийг шалгана.
 * @returns {{match: boolean, confidence: number}}
 */
export async function verifyFace(uri, userId) {
  if (!isCloudFaceConfigured) {
    throw new Error('Царай таних үйлчилгээ тохируулаагүй байна.');
  }
  const uuid = await getFaceUuid(userId);
  if (!uuid) return { match: false, confidence: 0, reason: 'not-enrolled' };

  const results = await searchPhoto(uri);
  let best = 0;
  for (const r of results) {
    const id = r.uuid || r.id;
    const p = Number(r.probability ?? r.confidence ?? 0);
    if (id === uuid && p > best) best = p;
  }
  return { match: best >= MATCH_THRESHOLD, confidence: best };
}

export async function setFaceEnrolled(userId) {
  const { error } = await supabase.from('profiles').update({ face_enrolled: true }).eq('id', userId);
  if (error) throw error;
}

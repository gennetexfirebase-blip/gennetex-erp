import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';
import { callEdge } from '../lib/edgeFunction';

/**
 * Царай таних — Supabase Edge Function-ээр.
 *
 * ЯАГААД ЭНЭ НЬ ХАМГИЙН ЗӨВ ҮНЭГҮЙ СОНГОЛТ ВЭ:
 *   • Гуравдагч тал байхгүй — зураг тань зөвхөн танай Supabase дээр очно
 *   • Үүрд үнэгүй — Supabase-ийн үнэгүй багцад багтана (сард 500K дуудлага)
 *   • Expo Go дээр ажиллана — зөвхөн HTTPS
 *   • Утсан дээрхтэй ИЖИЛ SFace загвар тул embedding нь нийцнэ:
 *     APK дээр бүртгүүлээд Expo Go дээр танилт хийж болно, эсрэгээр ч
 *
 * ХЯЗГААР:
 *   • Интернэт шаардана
 *   • Эхний дуудалт (хүйтэн эхлэлт) 3-6 секунд — загвар ачаална
 *
 * Серверийн код: supabase/functions/face-verify/
 */

const FUNCTION = 'face-verify';

async function toBase64(uri) {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

async function call(body) {
  const { data } = await callEdge(FUNCTION, body);
  return data;
}

/** Энэ зам ашиглах боломжтой эсэх — Supabase холбогдсон л бол тийм. */
export const isEdgeFaceAvailable = !!supabase;

/**
 * Оношилгоо — алдаа хаана гарч байгааг тодорхойлно.
 *
 * Загвар ачаалагдаж байгаа эсэх, хэр удаж байгаа, ONNX-ийн оролт/гаралтын
 * нэрс зэргийг буцаана. "non-2xx" гэсэн ерөнхий алдаа гарвал эхлээд үүнийг
 * дуудаж, жинхэнэ шалтгааныг олно.
 */
export async function healthCheck() {
  try {
    const data = await call({ mode: 'health' });
    return { ok: true, ...data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Нэг өнцгийн зургийг бүртгэнэ.
 * @returns {{enrolled: number, quality: number}}
 */
export async function enrollPhoto({ uri, pose }) {
  const imageBase64 = await toBase64(uri);
  const res = await call({ mode: 'enroll', imageBase64, pose });
  if (res?.ok === false) {
    throw new Error(res.message || 'Царай бүртгэж чадсангүй.');
  }
  return { enrolled: res.enrolled || 0, quality: res.quality || 0 };
}

/**
 * Selfie нь бүртгэлтэй царайтай таарч байгаа эсэх.
 * @returns {{match: boolean, confidence: number, reason?: string}}
 */
export async function verifyFace(uri) {
  const imageBase64 = await toBase64(uri);
  const res = await call({ mode: 'verify', imageBase64 });
  if (res?.ok === false) {
    return { match: false, confidence: 0, reason: res.reason, message: res.message };
  }
  return {
    match: !!res.match,
    confidence: Number(res.confidence) || 0,
    topAverage: Number(res.topAverage) || 0,
  };
}

/** Бүртгэсэн өнцгийн тоо. */
export async function countEnrollments(userId) {
  const { count, error } = await supabase
    .from('face_templates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return count || 0;
}

export async function setFaceEnrolled(userId) {
  const { error } = await supabase
    .from('profiles')
    .update({ face_enrolled: true })
    .eq('id', userId);
  if (error) throw error;
}

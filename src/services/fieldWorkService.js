/**
 * Талбайн ажлын тэмдэглэл — «Боксны таг», «Шилжүүлэг»
 * (20261011152000_field_work_records.sql).
 *
 * Өмнөх, дараах зураг заавал; зураг авах бүрд GPS автоматаар.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { sendPushToUser } from './notificationService';

const BUCKET = 'field-work-photos';

export const FIELD_WORK_KINDS = {
  box_tag: {
    label: 'Боксны таг',
    title: 'Шинээр боксны таг сольсон',
    codeLabel: 'Боксны дугаар / код',
    codePlaceholder: 'Ж: BOX-0421',
    icon: 'archive',
  },
  transfer: {
    label: 'Шилжүүлэг',
    title: 'Шилжүүлэг хийсэн',
    codeLabel: 'Хэрэглэгч / гэрээний дугаар',
    codePlaceholder: 'Ж: 88112233 эсвэл гэрээний №',
    icon: 'repeat',
  },
  // Нэг зураг; GPS шууд хадгалагдана. Ойртсон ажилтанд зурагтай push очно.
  box_full: {
    label: 'Дүүрсэн бокс',
    title: 'Бокс дүүрэн байна',
    codeLabel: 'Боксны дугаар / код',
    codePlaceholder: 'Ж: BOX-0421',
    icon: 'package',
    single: true,
  },
};

/** Ойролцоох дүүрсэн боксыг шалгах радиус (м). */
export const BOX_FULL_RADIUS_M = 150;

async function uploadPhoto(userId, uri, tag, prefix = '') {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const path = `${prefix}${userId}/${Date.now()}-${tag}-${Math.random().toString(36).slice(2, 7)}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, decode(base64), { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

/** RLS: ажилтанд өөрийнх, ахлах+-д бүгд. */
export async function fetchRecords({ kind, limit = 200 } = {}) {
  let query = supabase.from('field_work_records').select('*').order('created_at', { ascending: false }).limit(limit);
  if (kind && kind !== 'all') query = query.eq('kind', kind);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function photoUrls(records) {
  const paths = [...new Set((records || []).flatMap((r) => [r.before_path, r.after_path]).filter(Boolean))];
  if (!paths.length) return {};
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  return Object.fromEntries((data || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));
}

export async function createRecord({ kind, user, before, after, gps, code, note }) {
  const def = FIELD_WORK_KINDS[kind];
  if (!def) throw new Error('Төрөл буруу.');
  if (!before?.uri || (!def.single && !after?.uri)) throw new Error(def.single ? 'Зургаа авна уу.' : 'Өмнөх, дараах зургийг заавал авна уу.');
  if (!user?.id) throw new Error('Нэвтрэлт дууссан байна. Дахин нэвтэрнэ үү.');
  // Дүүрсэн боксны зургийг бүх ажилтан (push) харна — тусдаа хавтас.
  const prefix = kind === 'box_full' ? 'box_full/' : '';
  const [beforePath, afterPath] = await Promise.all([
    uploadPhoto(user.id, before.uri, 'before', prefix),
    def.single ? Promise.resolve(null) : uploadPhoto(user.id, after.uri, 'after', prefix),
  ]);
  const { data, error } = await supabase
    .from('field_work_records')
    .insert({
      kind,
      created_by: user.id,
      created_by_name: user.name || null,
      box_code: kind !== 'transfer' ? String(code || '').trim() || null : null,
      customer: kind === 'transfer' ? String(code || '').trim() || null : null,
      note: String(note || '').trim() || null,
      before_path: beforePath,
      after_path: afterPath,
      before_taken_at: before.takenAt || null,
      after_taken_at: after?.takenAt || null,
      latitude: gps?.latitude ?? null,
      longitude: gps?.longitude ?? null,
      accuracy: gps?.accuracy ?? null,
    })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([beforePath, afterPath].filter(Boolean)).catch(() => null);
    throw error;
  }
  return data;
}

/** Дүүрсэн боксыг хоосолсон / шийдсэн. */
export async function resolveFullBox(id) {
  const { error } = await supabase.rpc('resolve_full_box', { p_id: id });
  if (error) throw error;
}

/**
 * Ажилтан дүүрсэн боксны ойролцоо (≈150 м) ирэхэд зурагтай push. Байршлын
 * task (ажлын үеэр) дуудна. Сервер нэг хүнд нэг боксыг 12 цагт нэг л удаа
 * буцаадаг тул давтан мэдэгдэл явахгүй.
 */
export async function notifyNearbyFullBoxes(userId, coords) {
  if (!userId || coords?.latitude == null) return 0;
  const { data, error } = await supabase.rpc('full_boxes_near', {
    p_lat: coords.latitude,
    p_lng: coords.longitude,
    p_radius_m: BOX_FULL_RADIUS_M,
  });
  if (error || !data?.length) return 0;
  for (const box of data) {
    let imageUrl;
    if (box.before_path) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(box.before_path, 7 * 24 * 3600);
      imageUrl = signed?.signedUrl;
    }
    await sendPushToUser(userId, {
      title: 'Энэ бокс дүүрэн байна',
      body: `${box.box_code ? `${box.box_code} · ` : ''}${Math.round(box.distance_m)} м-т${box.note ? ` · ${box.note}` : ''}`.slice(0, 200),
      type: 'box_full',
      screen: 'FieldWork',
      entityId: String(box.id),
      data: { kind: 'box_full', recordId: String(box.id) },
      imageUrl,
    }).catch(() => null);
  }
  return data.length;
}

export async function deleteRecord(record) {
  const { error } = await supabase.from('field_work_records').delete().eq('id', record.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([record.before_path, record.after_path].filter(Boolean)).catch(() => null);
}

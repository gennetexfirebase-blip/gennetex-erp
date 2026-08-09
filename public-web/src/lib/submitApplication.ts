import { supabase } from './supabase';
import type { JobApplicationFormData } from '../types/jobApplication';

const FORM_MARKER = '[[GENNETEX_FORM]]';

/** Илгээх JSON — base64 зураг хэт том болохоос сэргийлнэ */
export function sanitizeFormData(data: JobApplicationFormData) {
  const hasPhoto = Boolean(data.general.photoDataUrl?.startsWith('data:'));
  return {
    ...data,
    general: {
      ...data.general,
      photoDataUrl: '',
      photoAttached: hasPhoto,
    },
  };
}

function buildMessage(data: JobApplicationFormData, sanitized: ReturnType<typeof sanitizeFormData>) {
  const g = data.general;
  const summary = [
    g.fatherName && `Эцэг/эх: ${g.fatherName}`,
    g.clanName && `Ургийн овог: ${g.clanName}`,
    data.personal.strengths && `Давуу: ${data.personal.strengths.slice(0, 120)}`,
    data.jobInterest.position && `Сонирхол: ${data.jobInterest.position}`,
  ]
    .filter(Boolean)
    .join(' · ');

  try {
    const json = JSON.stringify(sanitized);
    if (json.length < 45000) {
      return (summary ? `${summary}\n` : '') + `${FORM_MARKER}${json}`;
    }
  } catch {
    /* ignore */
  }
  return summary || null;
}

function friendlyError(error: { message?: string; code?: string }) {
  const msg = error.message || 'Илгээхэд алдаа гарлаа.';
  if (/form_data|signature_svg|signed_at|photo_url|schema cache/i.test(msg)) {
    return 'Серверийн тохиргоо дутуу байна. Үндсэн мэдээлэл хадгалагдах болно — дахин оролдоно уу.';
  }
  if (/row-level security|permission|policy/i.test(msg)) {
    return 'Зөвшөөрөлгүй хүсэлт. Дахин оролдоно уу.';
  }
  if (/job_applications/i.test(msg) && /does not exist|байхгүй/i.test(msg)) {
    return 'Анкетын хүснэгт байхгүй байна. Админ migration_job_applications.sql ажиллуулна уу.';
  }
  return msg;
}

function missingExtendedColumns(error: { message?: string }) {
  return /form_data|signature_svg|signed_at|photo_url|schema cache/i.test(error.message || '');
}

function dataUrlToUpload(dataUrl: string) {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const mime = m[1];
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  return { bytes, mime, ext };
}

async function uploadApplicationPhoto(dataUrl: string) {
  const parsed = dataUrlToUpload(dataUrl);
  if (!parsed) return null;
  const path = `web/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${parsed.ext}`;
  const { error } = await supabase.storage
    .from('job-applications')
    .upload(path, parsed.bytes, { contentType: parsed.mime, upsert: false });
  if (error) return null;
  return supabase.storage.from('job-applications').getPublicUrl(path).data.publicUrl;
}

export async function submitJobApplication(data: JobApplicationFormData) {
  const g = data.general;
  const name = g.firstName.trim();
  if (!name) throw new Error('Өөрийн нэрээ оруулна уу.');

  const sanitized = sanitizeFormData(data);
  const signedAt = data.signedAt || new Date().toISOString();
  let photoUrl: string | null = null;
  if (g.photoDataUrl?.startsWith('data:')) {
    photoUrl = await uploadApplicationPhoto(g.photoDataUrl);
  } else if (g.photoDataUrl?.startsWith('http')) {
    photoUrl = g.photoDataUrl;
  }

  const baseRow = {
    name,
    last_name: g.clanName.trim() || null,
    phone: g.phoneMobile.trim() || null,
    email: g.email.trim() || null,
    position: data.jobInterest.position.trim() || null,
    message: buildMessage(data, sanitized),
    source: 'web',
    status: 'new',
  };

  const fullRow = {
    ...baseRow,
    form_data: sanitized,
    signature_svg: data.signatureSvg?.trim() || null,
    signed_at: signedAt,
    photo_url: photoUrl,
  };

  // .select() ашиглахгүй — anon SELECT эрхгүй тул RETURNING алдаа гардаг
  let { error } = await supabase.from('job_applications').insert(fullRow);
  if (error && missingExtendedColumns(error)) {
    ({ error } = await supabase.from('job_applications').insert(baseRow));
  }

  if (error) throw new Error(friendlyError(error));
}

/** Админ / харах талд — form_data эсвэл message доторх JSON */
export function parseStoredForm(row: {
  form_data?: JobApplicationFormData | null;
  message?: string | null;
}): JobApplicationFormData | null {
  const fd = row.form_data;
  if (fd && typeof fd === 'object' && fd.general) return fd as JobApplicationFormData;

  const msg = row.message || '';
  const idx = msg.indexOf(FORM_MARKER);
  if (idx < 0) return null;
  try {
    const parsed = JSON.parse(msg.slice(idx + FORM_MARKER.length)) as JobApplicationFormData;
    if (parsed?.general) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

import { supabase } from './supabase';
import type {
  ColumnResult,
  ComparisonConfig,
  ComparisonResults,
  Dataset,
} from '../types';

/**
 * Тооллогын ТҮҮХ — Supabase дээр хадгалах / буцааж унших давхарга.
 *
 * Хоёр хэсэгтэй:
 *  1. `count_sessions` мөр — хэн, хэзээ, ямар файл, ямар тохиргоо, ямар
 *     дүн гарсныг агуулсан ХӨНГӨН мета өгөгдөл. Жагсаалт үүнээс зурагдана.
 *  2. Storage дахь `<user_id>/<session_id>.json.gz` — ХҮНД өгөгдөл буюу
 *     эх ба цаанаас ирсэн хуудсууд бүхэлдээ. Түүхээс нэг тооллого нээхэд
 *     үүнийг татаж, харьцуулалтыг ДАХИН тооцно.
 *
 * Яагаад үр дүнг биш, эх өгөгдлийг хадгалж байна вэ: `ColumnResult` дотор
 * хэдэн зэрэгцээ typed array байдаг тул JSON болгоход хэд дахин том болно.
 * Эх өгөгдлөөс дахин тооцох нь (worker дээр) хормын зуур бөгөөд яг ижил
 * үр дүн гарна.
 */

export const HISTORY_BUCKET = 'count-sessions';

/** Хэт том тооллогыг бүрэн хадгалахгүй (шахсаны дараах хязгаар). */
const MAX_UPLOAD_BYTES = 45 * 1024 * 1024;

export interface SessionSummary {
  found: number;
  missing: number;
  empty: number;
  duplicateValues: number;
}

export interface SessionRow {
  id: string;
  user_id: string;
  user_email: string | null;
  created_at: string;
  title: string;
  note: string | null;
  source_file: string;
  source_sheet: string;
  source_rows: number;
  ref_file: string;
  ref_sheet: string;
  ref_rows: number;
  duration_ms: number;
  config: ComparisonConfig;
  summary: Record<string, SessionSummary | null>;
  detail_path: string | null;
  detail_bytes: number | null;
}

/** Storage-д тавигдах бүрэн агуулга. */
export interface SessionPayload {
  version: 1;
  hasHeaderRow: boolean;
  config: ComparisonConfig;
  source: Dataset;
  reference: Dataset | null;
}

function summarize(r: ColumnResult | null): SessionSummary | null {
  if (!r) return null;
  return {
    found: r.found,
    missing: r.missing,
    empty: r.empty,
    duplicateValues: r.sourceDuplicateValues,
  };
}

export function buildSummary(results: ComparisonResults): Record<string, SessionSummary | null> {
  return {
    serial: summarize(results.serial),
    devc: summarize(results.devc),
    serialRef: summarize(results.serialRef),
    devcRef: summarize(results.devcRef),
  };
}

// ---------------------------------------------------------------------------
// gzip — CompressionStream орчин үеийн бүх браузерт байдаг. Байхгүй бол
// шахалтгүйгээр илгээнэ (зөвхөн жижиг файлд л боломжтой).
// ---------------------------------------------------------------------------
async function gzip(text: string): Promise<Blob> {
  const raw = new Blob([text]);
  if (typeof CompressionStream === 'undefined') return raw;
  const stream = raw.stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

async function gunzip(blob: Blob): Promise<string> {
  if (typeof DecompressionStream === 'undefined') return blob.text();
  try {
    const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  } catch {
    // Шахаагүй хуучин бичлэг байж болно.
    return blob.text();
  }
}

// ---------------------------------------------------------------------------

export interface SaveInput {
  title: string;
  note?: string;
  hasHeaderRow: boolean;
  config: ComparisonConfig;
  source: Dataset;
  reference: Dataset | null;
  results: ComparisonResults;
  onProgress?: (pct: number, label: string) => void;
}

/** Тооллогыг хадгална. Буцаах утга нь шинэ мөрийн id. */
export async function saveSession(input: SaveInput): Promise<string> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error('Нэвтрээгүй байна.');
  const user = userData.user;

  input.onProgress?.(0.05, 'Мета өгөгдөл бичиж байна…');

  const { data: row, error: insErr } = await supabase
    .from('count_sessions')
    .insert({
      user_id: user.id,
      user_email: user.email ?? null,
      title: input.title,
      note: input.note ?? null,
      source_file: input.source.fileName,
      source_sheet: input.source.sheetName,
      source_rows: input.source.rowCount,
      ref_file: input.reference?.fileName ?? '',
      ref_sheet: input.reference?.sheetName ?? '',
      ref_rows: input.reference?.rowCount ?? 0,
      duration_ms: Math.round(input.results.durationMs),
      config: input.config,
      summary: buildSummary(input.results),
    })
    .select('id')
    .single();

  if (insErr || !row) throw new Error(insErr?.message || 'Хадгалж чадсангүй.');

  input.onProgress?.(0.2, 'Өгөгдлийг шахаж байна…');

  const payload: SessionPayload = {
    version: 1,
    hasHeaderRow: input.hasHeaderRow,
    config: input.config,
    source: input.source,
    reference: input.reference,
  };

  let blob: Blob;
  try {
    blob = await gzip(JSON.stringify(payload));
  } catch {
    throw new Error('Өгөгдөл хэт том тул шахаж чадсангүй.');
  }

  if (blob.size > MAX_UPLOAD_BYTES) {
    // Мета өгөгдөл нь хадгалагдсан хэвээр — дүн харагдана, зөвхөн бүрэн
    // хүснэгтийг дахин нээх боломжгүй.
    await supabase
      .from('count_sessions')
      .update({ note: `${input.note ?? ''}\n[Хэт том тул бүрэн өгөгдөл хадгалагдаагүй]`.trim() })
      .eq('id', row.id);
    return row.id;
  }

  input.onProgress?.(0.45, 'Сервер рүү илгээж байна…');

  const path = `${user.id}/${row.id}.json.gz`;
  const { error: upErr } = await supabase.storage
    .from(HISTORY_BUCKET)
    .upload(path, blob, { contentType: 'application/gzip', upsert: true });

  if (upErr) {
    await supabase.from('count_sessions').delete().eq('id', row.id);
    throw new Error(`Файл илгээхэд алдаа: ${upErr.message}`);
  }

  await supabase
    .from('count_sessions')
    .update({ detail_path: path, detail_bytes: blob.size })
    .eq('id', row.id);

  input.onProgress?.(1, 'Дууслаа');
  return row.id;
}

/** Түүхийн жагсаалт — шинэхэн нь эхэнд. */
export async function listSessions(limit = 100): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from('count_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as SessionRow[];
}

/** Нэг тооллогын бүрэн өгөгдлийг татна. */
export async function fetchSessionPayload(session: SessionRow): Promise<SessionPayload> {
  if (!session.detail_path) {
    throw new Error('Энэ тооллогын бүрэн өгөгдөл хадгалагдаагүй байна.');
  }
  const { data, error } = await supabase.storage
    .from(HISTORY_BUCKET)
    .download(session.detail_path);
  if (error || !data) throw new Error(error?.message || 'Өгөгдөл татаж чадсангүй.');
  const text = await gunzip(data);
  return JSON.parse(text) as SessionPayload;
}

export async function deleteSession(session: SessionRow): Promise<void> {
  if (session.detail_path) {
    await supabase.storage.from(HISTORY_BUCKET).remove([session.detail_path]);
  }
  const { error } = await supabase.from('count_sessions').delete().eq('id', session.id);
  if (error) throw new Error(error.message);
}

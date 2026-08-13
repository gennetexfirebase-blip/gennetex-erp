import { supabase } from './supabase';

/**
 * Edge Function-ий ЖИНХЭНЭ алдааг гаргаж авна.
 *
 * АСУУДАЛ:
 *   `supabase.functions.invoke()` нь 2xx биш хариу ирвэл зөвхөн
 *
 *     "Edge Function returned a non-2xx status code"
 *
 *   гэсэн ерөнхий мессеж өгч, функцийн буцаасан биеийг ХАЯДАГ. Тэр
 *   мессежээр функц deploy хийгдээгүй юу, санах ой дүүрсэн үү, эсвэл
 *   код дотор алдаа гарсан уу гэдгийг ялгах боломжгүй.
 *
 * ШИЙДЭЛ:
 *   Алдааны `context` нь анхны Response объект. Түүнийг уншиж функцийн
 *   буцаасан JSON доторх `error`-ыг гаргана.
 */
export async function readEdgeError(error) {
  const generic = String(error?.message || error || 'Тодорхойгүй алдаа');
  const res = error?.context;
  if (!res || typeof res.text !== 'function') return generic;

  let raw = '';
  try {
    raw = await res.text();
  } catch (e) {
    return generic;
  }

  let detail = raw;
  try {
    const parsed = JSON.parse(raw);
    detail = parsed?.error || parsed?.message || raw;
  } catch (e) {
    // JSON биш бол түүхий текстийг нь хэвээр
  }

  const status = res.status;
  switch (status) {
    case 404:
      return 'Энэ Edge Function deploy хийгдээгүй байна.';
    case 401:
    case 403:
      return 'Нэвтрэлт хүчингүй эсвэл эрх дутуу байна.';
    case 546:
      return 'Функц санах ойн хязгаараас хэтэрлээ.';
    default:
      return detail ? `${detail} (HTTP ${status})` : `${generic} (HTTP ${status})`;
  }
}

/**
 * Edge Function дуудах — алдааг ойлгомжтой болгож шиднэ.
 *
 * @param {string} name  функцийн нэр
 * @param {object} body  илгээх өгөгдөл
 * @param {object} [opts] { headers, silent }  silent=true бол алдаа шидэхгүй,
 *                        { error } буцаана — туслах мэдэгдэлд тохиромжтой.
 */
export async function callEdge(name, body, opts = {}) {
  const { headers, silent = false } = opts;
  const { data, error } = await supabase.functions.invoke(name, {
    body,
    ...(headers ? { headers } : {}),
  });

  if (error) {
    const message = await readEdgeError(error);
    if (silent) return { data: null, error: `${name}: ${message}` };
    throw new Error(message);
  }
  if (data?.error) {
    if (silent) return { data: null, error: `${name}: ${data.error}` };
    throw new Error(data.error);
  }
  return { data, error: null };
}

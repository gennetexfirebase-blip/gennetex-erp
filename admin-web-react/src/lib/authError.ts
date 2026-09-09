/**
 * OAuth-ийн буцаж ирсэн алдааг URL-аас уншина.
 *
 * Supabase нэвтрэлт бүтэлгүйтэхэд алдааг hash (`#error=…`) эсвэл query
 * (`?error=…`) хэлбэрээр буцаадаг. Үүнийг уншиж харуулахгүй бол
 * хэрэглэгч зүгээр л нэвтрэх дэлгэц рүү буцаж, ямар ч тайлбаргүй
 * үлддэг — яг тэр байдалд орох нь оношлоход хамгийн хэцүү.
 */
export function readOAuthError(): string | null {
  if (typeof location === 'undefined') return null;

  const from = (raw: string) => new URLSearchParams(raw.replace(/^[#?]/, ''));
  for (const params of [from(location.hash), from(location.search)]) {
    const code = params.get('error') || params.get('error_code');
    if (!code) continue;
    const desc = params.get('error_description') || '';
    const text = decodeURIComponent(desc.replace(/\+/g, ' ')) || code;

    // Хамгийн түгээмэл шалтгааныг шууд заая.
    if (/redirect|not allowed|invalid request/i.test(text) || code === 'invalid_request') {
      return `${text} — Supabase → Authentication → URL Configuration → Redirect URLs дотор ${location.origin}/** нэмэгдээгүй байна.`;
    }
    return text;
  }
  return null;
}

/** Алдааг уншсаны дараа URL-ыг цэвэрлэнэ (дахин ачаалахад давтагдахгүй). */
export function clearAuthErrorFromUrl(): void {
  if (typeof history === 'undefined') return;
  if (location.hash || location.search) {
    history.replaceState(null, '', location.pathname);
  }
}

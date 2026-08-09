const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|heic|heif)(\?.*)?$/i;
const BLOCKED = /u-service|uservice|play\.google\.com|apps\.apple\.com|itunes\.apple\.com/i;

/** Профайл зураг — зөвхөн зургийн URL, вэб хуудас/applink биш */
export function sanitizeAvatarUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim();
  if (!u) return null;
  if (BLOCKED.test(u)) return null;
  if (/^data:image\//i.test(u)) return u;
  if (/^(file|content):\/\//i.test(u)) return u;
  if (/supabase\.co\/storage\//i.test(u)) return u;
  if (IMAGE_EXT.test(u)) return u;
  if (/^https?:\/\//i.test(u)) return null;
  return null;
}

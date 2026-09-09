/**
 * Нэвтрэлтийн буцах гүүр.
 *
 * Supabase нь Redirect URLs жагсаалтад БАЙХГҮЙ хаяг руу буцахаас
 * татгалзаад, оронд нь Site URL (gennetex.com) руу токентой нь хаядаг.
 * Ингэхэд токен зөв үүссэн ч буруу домэйн дээр очиж, хэрэглэгч
 * нэвтэрч чадахгүй үлддэг.
 *
 * Шийдэл: нэвтрэхийн ӨМНӨ буцах хаягаа `.gennetex.com` домэйны cookie-д
 * бичнэ. Cookie нь дэд домэйн хооронд хуваалцагддаг тул gennetex.com
 * дээр буусан жижиг скрипт үүнийг уншиж, токеныг зөв апп руу дамжуулна.
 *
 * ⚠️ Энэ нь Supabase-ийн Redirect URLs-ыг зөв тохируулахыг ОРЛОХГҮЙ —
 *    зөв тохируулбал Supabase шууд буцаах тул гүүр дундуур ажиллахаа
 *    больж, өөрөө хоосон зогсоно.
 */
const COOKIE = 'gx_auth_return';

/** Cookie нь дэд домэйн хооронд хуваалцагдахын тулд эх домэйн дээр тавина. */
function parentDomain(): string | null {
  const host = location.hostname;
  if (host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  const parts = host.split('.');
  return parts.length > 2 ? `.${parts.slice(-2).join('.')}` : `.${host}`;
}

/** Нэвтрэхийн өмнө дуудна — хаана буцаж ирэхийг тэмдэглэнэ. */
export function rememberAuthReturn(url: string): void {
  const domain = parentDomain();
  if (!domain) return;
  const parts = [
    `${COOKIE}=${encodeURIComponent(url)}`,
    `domain=${domain}`,
    'path=/',
    'max-age=900',
    'SameSite=Lax',
  ];
  if (location.protocol === 'https:') parts.push('Secure');
  document.cookie = parts.join('; ');
}

/**
 * Production домэйн — Microsoft Teams Developer Portal-д өгөх URL-үүд.
 *
 * ⚠️ Домэйнийг кодод ХАТУУ БИЧИХГҮЙ. Vercel дээр орчны хувьсагчаар өгнө:
 *
 *     VITE_SITE_URL=https://erp.gennetex.mn
 *
 * (Энэ төсөл нь Next.js биш VITE дээр ажилладаг тул `NEXT_PUBLIC_*`
 *  угтвар уншигдахгүй — Vite зөвхөн `VITE_*`-ийг клиент рүү гаргадаг.
 *  Хэрэв хуучин `NEXT_PUBLIC_SITE_URL` тохируулсан бол Vercel дээр
 *  `VITE_SITE_URL` нэрээр давхар нэмнэ.)
 *
 * Тохируулаагүй бол хөтчийн одоогийн домэйныг ашиглана — ингэснээр
 * preview deploy болон localhost дээр ч зөв ажиллана.
 */
const ENV_URL = import.meta.env?.VITE_SITE_URL;

function stripTrailingSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

export function getSiteUrl() {
  if (ENV_URL) return stripTrailingSlash(ENV_URL);
  if (typeof window !== 'undefined' && window.location?.origin) {
    return stripTrailingSlash(window.location.origin);
  }
  return '';
}

/** Дотоод замыг бүтэн URL болгоно. Ж: absoluteUrl('/privacy') */
export function absoluteUrl(path = '/') {
  const base = getSiteUrl();
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base}${clean}`;
}

/** Teams Developer Portal-д бөглөх талбарууд. */
export const APP_INFO = {
  name: 'Gennetex ERP',
  developer: 'Gennetex',
  shortDescription:
    'Gennetex ERP – ажилтан, ирц, даалгавар, бараа материал болон Microsoft Teams харилцааг нэг дор удирдах байгууллагын систем.',
  longDescription:
    'Gennetex ERP нь байгууллагын ажилтан, ирц, бараа материал, багаж хэрэгсэл, даалгавар болон дотоод харилцааг нэг системээс удирдах зориулалттай ERP платформ юм. Microsoft Teams integration ашиглан зөвшөөрөгдсөн Teams chat, group chat болон байгууллагын харилцааны мэдээлэлтэй холбогдох боломжтой.',
  contactEmail: 'info@adiya.site',
};

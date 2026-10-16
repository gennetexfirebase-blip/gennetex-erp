/**
 * Нэг кодоос олон subdomain — hostname-аар аль «сайт» болохыг тодорхойлно.
 *
 * Цэсний мөр бүр (nav.ts → `site`) нэг сайтад харьяалагдана. Тухайн сайт дээр
 * зөвхөн өөрийн мөрүүд харагдана; admin.gennetex.com-оос шилжсэн хэсгүүд
 * тэнд харагдахгүй. Домэйн бүрийг Vercel-д нэмж, DNS-д CNAME холбох шаардлагатай.
 *
 * Домэйн холбогдохоос өмнө (localhost, *.vercel.app) `?site=hr` гэж туршина.
 */

export type SiteKey =
  | 'admin'
  | 'akt'
  | 'habea'
  | 'irts'
  | 'hr'
  | 'surgalt'
  | 'bairshil'
  | 'aguulah'
  | 'meet'
  | 'arhiv'
  | 'notif'
  | 'sanhuu';

export type Site = { key: SiteKey; host: string; title: string; landing: string };

export const SITES: Record<SiteKey, Site> = {
  admin: { key: 'admin', host: 'admin.gennetex.com', title: 'ERP удирдлага', landing: '/home' },
  akt: { key: 'akt', host: 'akt.gennetex.com', title: 'Актын удирдлага', landing: '/admin/documents/acts' },
  habea: { key: 'habea', host: 'habea.gennetex.com', title: 'Өндөрт ажиллах ХАБЭА', landing: '/internal/safety' },
  irts: { key: 'irts', host: 'irts.gennetex.com', title: 'Ирц бүртгэл', landing: '/attendance' },
  hr: { key: 'hr', host: 'hr.gennetex.com', title: 'Хүний нөөц', landing: '/employee' },
  surgalt: { key: 'surgalt', host: 'surgalt.gennetex.com', title: 'Сургалт', landing: '/training' },
  bairshil: { key: 'bairshil', host: 'bairshil.gennetex.com', title: 'Байршил', landing: '/location/staff' },
  aguulah: { key: 'aguulah', host: 'aguulah.gennetex.com', title: 'Агуулах', landing: '/legacy/inventory' },
  meet: { key: 'meet', host: 'meet.gennetex.com', title: 'Хурал', landing: '/legacy/meetings' },
  arhiv: { key: 'arhiv', host: 'arhiv.gennetex.com', title: 'Архив', landing: '/archive/logs' },
  notif: { key: 'notif', host: 'noft.gennetex.com', title: 'Мэдэгдэл', landing: '/internal/notify' },
  sanhuu: { key: 'sanhuu', host: 'sanhuu.gennetex.com', title: 'Санхүү', landing: '/finance/payroll' },
};

const BY_HOST = new Map(Object.values(SITES).map((s) => [s.host, s.key]));
const OVERRIDE_KEY = 'gx_site';

/** Туршилтын хост (домэйн холбогдохоос өмнө) — `?site=` зөвшөөрнө. */
export const DATA_HOST = 'data.gennetex.com';

export function isTestHost(host = window.location.hostname) {
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app');
}

export function currentSiteKey(): SiteKey {
  const host = window.location.hostname;
  const known = BY_HOST.get(host);
  if (known) return known;
  if (isTestHost(host)) {
    try {
      const q = new URLSearchParams(window.location.search).get('site');
      if (q !== null) {
        if (q && q in SITES) sessionStorage.setItem(OVERRIDE_KEY, q);
        else sessionStorage.removeItem(OVERRIDE_KEY);
      }
      const saved = sessionStorage.getItem(OVERRIDE_KEY);
      if (saved && saved in SITES) return saved as SiteKey;
    } catch {
      /* sessionStorage хаалттай — admin */
    }
  }
  return 'admin';
}

export const currentSite = () => SITES[currentSiteKey()];

/** Өөр сайтын хуудасны бүтэн хаяг. */
export function siteUrl(key: SiteKey, path = SITES[key].landing) {
  return `https://${SITES[key].host}${path}`;
}

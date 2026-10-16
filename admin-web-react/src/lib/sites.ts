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
  | 'sanhuu'
  | 'share';

export type Site = { key: SiteKey; host: string; title: string; landing: string };

export const SITES: Record<SiteKey, Site> = {
  admin: { key: 'admin', host: 'admin.gennetex.com', title: 'ERP удирдлага', landing: '/home' },
  akt: { key: 'akt', host: 'akt.gennetex.com', title: 'Актын удирдлага', landing: '/admin/documents/acts' },
  habea: { key: 'habea', host: 'habea.gennetex.com', title: 'Өндөрт ажиллах ХАБЭА', landing: '/internal/safety' },
  irts: { key: 'irts', host: 'irts.gennetex.com', title: 'Ирц бүртгэл', landing: '/attendance' },
  hr: { key: 'hr', host: 'hr.gennetex.com', title: 'Хүний нөөц', landing: '/employee' },
  surgalt: { key: 'surgalt', host: 'surgalt.gennetex.com', title: 'Сургалт', landing: '/training' },
  bairshil: { key: 'bairshil', host: 'bairshil.gennetex.com', title: 'Байршил', landing: '/location/staff' },
  aguulah: { key: 'aguulah', host: 'aguulah.gennetex.com', title: 'Агуулах', landing: '/stock' },
  meet: { key: 'meet', host: 'meet.gennetex.com', title: 'Хурал', landing: '/meetings' },
  arhiv: { key: 'arhiv', host: 'arhiv.gennetex.com', title: 'Архив', landing: '/archive/logs' },
  notif: { key: 'notif', host: 'noft.gennetex.com', title: 'Мэдэгдэл', landing: '/internal/notify' },
  sanhuu: { key: 'sanhuu', host: 'sanhuu.gennetex.com', title: 'Санхүү', landing: '/finance/payroll' },
  share: { key: 'share', host: 'share.gennetex.com', title: 'Хуваалцах', landing: '/' },
};

const BY_HOST = new Map(Object.values(SITES).map((s) => [s.host, s.key]));
const OVERRIDE_KEY = 'gx_site';

/** Туршилтын хост (домэйн холбогдохоос өмнө) — `?site=` зөвшөөрнө. */
export const DATA_HOST = 'data.gennetex.com';
/** Data сайтын хаягууд — bayasgalan нь зөвхөн харах эрхтэй хүнд. */
export const DATA_HOSTS = new Set([DATA_HOST, 'bayasgalan.gennetex.com']);

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

/** Нэвтрэх хуудасны зүүн талын бичвэр — сайт бүрт тусдаа. */
export const SITE_COPY: Record<SiteKey, { headline: string; blurb: string; flow: string[] }> = {
  admin: { headline: 'Байгууллагын бүх үйл ажиллагааг нэг дор удирдана.', blurb: 'Хянах самбар, анхааруулга, гэрээ, тохиргоо — Gennetex ERP-ийн удирдлагын төв.', flow: ['Хянах', 'Шийдвэрлэх', 'Тайлагнах'] },
  akt: { headline: 'Талбай дээр эхэлсэн ажлыг албан баримтаар дуусгана.', blurb: 'Төсөл, материал, шалгах хуудас, ажлын зураг, хүлээлцэх хүмүүсийг нэг урсгалд холбосон Gennetex-ийн баримт бичгийн орчин.', flow: ['Төсөл', 'Боловсруулах', 'Баталгаажуулах', 'Архив'] },
  habea: { headline: 'Өндөрт ажиллах ажилтан бүрийн аюулгүй байдлыг баталгаажуулна.', blurb: 'ХАБЭА-н зааварчилгаа, шалгалт, зөвшөөрлийг нэг дор бүртгэнэ.', flow: ['Зааварчилгаа', 'Шалгалт', 'Зөвшөөрөл'] },
  irts: { headline: 'Ажилтны ирц, цагийн хүсэлтийг бодит цагаар хянана.', blurb: 'Апп-аас ирсэн ирэлт, явалт, зайнаас бүртгэл, чөлөөний хүсэлтийг шийдвэрлэнэ.', flow: ['Ирлээ', 'Явлаа', 'Хүсэлт', 'Тайлан'] },
  hr: { headline: 'Ажилтан, алба хэлтэс, анкетыг нэг дор удирдана.', blurb: 'Хүний нөөцийн бүртгэл, ажлын байрны анкет, хэлтсийн бүтэц.', flow: ['Анкет', 'Ажилд авах', 'Хэлтэс'] },
  surgalt: { headline: 'Ажилтан бүрийн авсан сургалт, гэрчилгээг бүртгэнэ.', blurb: 'Заавал авах сургалт, хугацаа, гэрчилгээний сануулга.', flow: ['Оноох', 'Суралцах', 'Гэрчилгээ'] },
  bairshil: { headline: 'Ажилчдын байршлыг хэлтэс хэлтсээр нь харна.', blurb: 'Апп-аас ирсэн сүүлийн байршил, ирц бүртгэх цэгүүд.', flow: ['Хэлтэс', 'Ажилтан', 'Газрын зураг'] },
  aguulah: { headline: 'Агуулахын бараа, багажийн орлого, зарлагыг хянана.', blurb: 'Үлдэгдэл, бар код, ажилтны авсан бараа ба зургийн баталгаа.', flow: ['Орлого', 'Олголт', 'Хэрэглээ', 'Үлдэгдэл'] },
  meet: { headline: 'Бүх ажилтантайгаа нэг дор хурал хийнэ.', blurb: 'Вэбээс хурал эхлүүлж, дэлгэцээ хуваалцана — ажилтан апп-аасаа орно.', flow: ['Эхлүүлэх', 'Урих', 'Хуваалцах'] },
  arhiv: { headline: 'Системийн бүх лог, Excel файлыг хадгална.', blurb: 'Апп-аас ирсэн үйлдэл бүрийн бүртгэл ба татсан бүх Excel.', flow: ['Лог', 'Excel', 'Архив'] },
  notif: { headline: 'Ажилтнууддаа мэдэгдэл илгээнэ.', blurb: 'Бүх ажилтан, хэлтэс эсвэл хүн бүрт апп-аар push мэдэгдэл.', flow: ['Бичих', 'Сонгох', 'Илгээх'] },
  share: { headline: 'Текст, файлаа хамт олонтойгоо хуваалцана.', blurb: 'Бүх ажилтанд эсвэл сонгосон хүмүүст текст бичиж, файл байршуулж илгээнэ. Хүлээн авагчид апп-аар мэдэгдэл очно.', flow: ['Бичих', 'Хавсаргах', 'Хуваалцах'] },
  sanhuu: { headline: 'Цалин, хоолны мөнгө, бензиний зардлыг ирцээс тооцно.', blurb: 'Ирцийн цэг дээр «Ирлээ» дармагц цалин тоологдож эхэлнэ.', flow: ['Ирц', 'Цалин', 'Хоол', 'Бензин'] },
};

/** Хөтчийн табын гарчиг. */
export const siteTabTitle = (key: SiteKey = currentSiteKey()) => `${SITES[key].title} — Gennetex`;

/** Өөр сайтын хуудасны бүтэн хаяг. */
export function siteUrl(key: SiteKey, path = SITES[key].landing) {
  return `https://${SITES[key].host}${path}`;
}

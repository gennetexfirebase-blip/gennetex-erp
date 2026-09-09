/**
 * Сайтын зам бүрийн мета мэдээлэл.
 *
 * Build үед `scripts/prerender.mjs` энэ жагсаалтаар явж зам тус бүрд
 * ӨӨРИЙН HTML файл (title, description, og:*) үүсгэнэ. Ингэснээр
 * Google, Facebook, Messenger зэрэг нь JS ажиллуулалгүйгээр зөв гарчиг,
 * тайлбарыг уншина.
 *
 * `ssr: false` — тухайн хуудсыг сервер дээр зурахгүй (зөвхөн мета).
 * Careers нь `lazy` импорттой бөгөөд зөвхөн браузерт ажилладаг маягт
 * агуулдаг тул үүнээс хасав.
 */
export const SITE_ROUTES = [
  {
    path: '/',
    file: 'index.html',
    title: 'Gennetex — Технологийн шийдэл',
    description:
      'Gennetex — сүлжээ, шилэн кабель, аюулгүй байдал, IT дэд бүтцийн иж бүрэн шийдэл.',
    ssr: true,
  },
  {
    path: '/about',
    file: 'about/index.html',
    title: 'Бидний тухай — Gennetex',
    description:
      'ЖЕННЕТЕКС ХХК — сүлжээ, шилэн кабель, аюулгүй байдлын системийн туршлагатай баг.',
    ssr: true,
  },
  {
    path: '/services',
    file: 'services/index.html',
    title: 'Үйлчилгээ — Gennetex',
    description:
      'Шилэн кабелийн угсралт, сүлжээний дэд бүтэц, хяналтын камер, IT засвар үйлчилгээ.',
    ssr: true,
  },
  {
    path: '/projects',
    file: 'projects/index.html',
    title: 'Төслүүд — Gennetex',
    description: 'Gennetex-ийн хэрэгжүүлсэн сүлжээ, дэд бүтцийн төслүүд.',
    ssr: true,
  },
  {
    path: '/contact',
    file: 'contact/index.html',
    title: 'Холбоо барих — Gennetex',
    description: 'Утас, и-мэйл, хаяг — Gennetex-тэй холбогдох мэдээлэл.',
    ssr: true,
  },
  {
    path: '/careers',
    file: 'careers/index.html',
    title: 'Ажлын байр — Gennetex',
    description: 'Gennetex-д нээлттэй ажлын байр. Онлайнаар анкет илгээх.',
    ssr: false,
  },
  {
    path: '/privacy',
    file: 'privacy/index.html',
    title: 'Нууцлалын бодлого — Gennetex',
    description: 'Gennetex аппликейшны хувийн мэдээлэл цуглуулах, ашиглах бодлого.',
    ssr: true,
  },
  {
    path: '/terms',
    file: 'terms/index.html',
    title: 'Үйлчилгээний нөхцөл — Gennetex',
    description: 'Gennetex аппликейшн ашиглах үйлчилгээний нөхцөл.',
    ssr: true,
  },
  {
    path: '/delete-account',
    file: 'delete-account/index.html',
    title: 'Бүртгэл устгах — Gennetex',
    description: 'Gennetex аппликейшны бүртгэл болон өгөгдлөө устгуулах заавар.',
    ssr: true,
  },
  {
    path: '/support',
    file: 'support/index.html',
    title: 'Тусламж — Gennetex',
    description: 'Gennetex аппликейшны хэрэглэгчийн тусламж, холбоо барих суваг.',
    ssr: true,
  },
];

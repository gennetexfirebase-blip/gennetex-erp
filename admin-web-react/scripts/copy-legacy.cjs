const fs = require('node:fs');
const path = require('node:path');

/**
 * Хуучин панелуудыг ЭНЭ project-ийн гаралт дотор хуулна.
 *
 * ЯАГААД:
 *   admin.gennetex.com бол `admin-web-react`-ийг үндэс болгосон ТУСДАА
 *   Vercel project. Түүний SPA fallback нь ямар ч замд React-ийн
 *   index.html-ийг буцаадаг. Тиймээс шинэ панелаас `/gennetex/admin-legacy/`
 *   рүү iframe-ээр хандахад хуучин панел биш, React апп өөрөө дахин
 *   ачаалагдаж, төгсгөлгүй үүрлэдэг байв.
 *
 *   Хуучин панелуудыг гаралт дотор оруулснаар `handle: filesystem` нь
 *   тэднийг олж, fallback хүртэл хүрэхгүй.
 */
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const repo = path.resolve(root, '..');

const COPIES = [
  { from: path.join(repo, 'admin-web'), to: path.join(dist, 'gennetex', 'admin-legacy') },
  { from: path.join(repo, 'admin-web-v1'), to: path.join(dist, 'gennetex', 'admin-v1') },
];

if (!fs.existsSync(dist)) {
  throw new Error('dist алга — эхлээд vite build ажиллах ёстой.');
}

for (const { from, to } of COPIES) {
  if (!fs.existsSync(from)) {
    console.warn(`Алгасав (олдсонгүй): ${from}`);
    continue;
  }
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
  console.log(`Copied ${path.basename(from)} -> ${path.relative(dist, to)}`);
}

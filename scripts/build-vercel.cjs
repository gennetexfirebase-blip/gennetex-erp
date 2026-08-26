const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const publicDist = path.join(root, 'public-web', 'dist');
const adminReactDist = path.join(root, 'admin-web-react', 'dist');
const adminLegacy = path.join(root, 'admin-web');
const output = path.join(root, 'dist-web');
const adminOutput = path.join(output, 'gennetex', 'admin');

if (!fs.existsSync(publicDist)) {
  throw new Error('public-web/dist is missing. Run the public-web build first.');
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
fs.cpSync(publicDist, output, { recursive: true });

fs.mkdirSync(path.dirname(adminOutput), { recursive: true });

/**
 * Админ панел — ШИНЭ React хувилбарыг эрхэмлэнэ.
 *
 * `admin-web-react/dist` байвал түүнийг `/gennetex/admin` дор тавина.
 * Байхгүй (build амжилтгүй / хараахан суулгаагүй) бол ХУУЧИН vanilla
 * `admin-web/`-ийг тавина — ингэснээр шинэ build унасан ч ажиллаж
 * байсан админ панел бүрмөсөн алга болохгүй.
 */
if (fs.existsSync(adminReactDist)) {
  fs.cpSync(adminReactDist, adminOutput, { recursive: true });
  console.log('Admin panel: admin-web-react/dist (React)');
} else if (fs.existsSync(adminLegacy)) {
  fs.cpSync(adminLegacy, adminOutput, { recursive: true });
  console.log('Admin panel: admin-web (legacy vanilla) — React build олдсонгүй');
} else {
  throw new Error('admin-web-react/dist ч, admin-web ч алга.');
}

// Хуучин админ панелийг зэрэг үлдээнэ — шинэ дээр асуудал гарвал
// `/gennetex/admin-legacy` руу орж ажлаа үргэлжлүүлэх боломжтой.
if (fs.existsSync(adminReactDist) && fs.existsSync(adminLegacy)) {
  const legacyOutput = path.join(output, 'gennetex', 'admin-legacy');
  fs.cpSync(adminLegacy, legacyOutput, { recursive: true });
  console.log('Legacy admin kept at /gennetex/admin-legacy');
}

console.log(`Vercel output prepared at ${output}`);

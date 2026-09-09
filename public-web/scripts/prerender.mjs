/**
 * Build дараах prerender.
 *
 * `dist/index.html` (Vite-ийн үүсгэсэн, hash-тай asset холбоос агуулсан)
 * -ыг загвар болгон авч, зам бүрд:
 *   1. Серверийн bundle-ээр React-ийг HTML болгож зурна
 *   2. Тухайн замын title / description / og:* -ийг оруулна
 *   3. Build үед Supabase-аас татсан агуулгыг `window.__SITE_CONTENT__`
 *      болгон шингээнэ (браузер hydrate хийхэд ижил агуулга хэрэгтэй)
 * гээд `dist/<зам>/index.html` болгож бичнэ.
 *
 * Үр дүн: /about, /services … бүр өөрийн БОДИТ HTML файлтай болно —
 * SPA rewrite шаардлагагүй, хайлтын систем ба share preview зөв уншина.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const ssrDist = path.join(root, 'dist-ssr');

const { render, mergeSiteContent, DEFAULT_SITE_CONTENT } = await import(
  pathToFileURL(path.join(ssrDist, 'entry-server.js')).href
);
const { SITE_ROUTES } = await import(pathToFileURL(path.join(root, 'src', 'routes.js')).href);

const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://gennetex.com';

/** Агуулгыг build үед нэг удаа татна. Амжилтгүй бол анхдагчаар явна. */
async function loadContent() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn('[prerender] Supabase тохиргоо алга — анхдагч агуулгаар зурна.');
    return DEFAULT_SITE_CONTENT;
  }
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from('public_site_content')
      .select('content')
      .eq('id', 'main')
      .maybeSingle();
    if (error) throw error;
    return mergeSiteContent(data?.content || {});
  } catch (e) {
    console.warn('[prerender] Агуулга татаж чадсангүй:', e.message);
    return DEFAULT_SITE_CONTENT;
  }
}

const content = await loadContent();
const contentJson = JSON.stringify(content).replace(/</g, '\u003c');

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

for (const route of SITE_ROUTES) {
  let html = template;

  const canonical = `${SITE_URL}${route.path === '/' ? '' : route.path}`;
  const head = [
    `<title>${esc(route.title)}</title>`,
    `<meta name="description" content="${esc(route.description)}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:title" content="${esc(route.title)}" />`,
    `<meta property="og:description" content="${esc(route.description)}" />`,
    `<meta property="og:image" content="${SITE_URL}/logo.png" />`,
    `<meta property="og:site_name" content="Gennetex" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join('\n    ');

  // Загварын анхдагч title / description-ийг замынхаар солино.
  html = html
    .replace(/<title>[\s\S]*?<\/title>\s*/, '')
    .replace(/<meta name="description"[^>]*\/>\s*/, '')
    .replace('</head>', `  ${head}\n  </head>`);

  const body = route.ssr ? render(route.path, content) : '';
  html = html.replace(
    '<div id="root"></div>',
    `<div id="root">${body}</div>\n    <script>window.__SITE_CONTENT__=${contentJson}</script>`,
  );

  const out = path.join(dist, route.file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`[prerender] ${route.path} -> dist/${route.file}${route.ssr ? '' : ' (мета)'}`);
}

fs.rmSync(ssrDist, { recursive: true, force: true });
console.log(`[prerender] ${SITE_ROUTES.length} хуудас бэлэн.`);

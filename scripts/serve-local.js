#!/usr/bin/env node
/**
 * `/app/uplaod` ба `/app/time` хуудсуудыг ТУСДАА localhost дээр
 * ажиллуулна — тус бүр өөрийн порттой, ЗАМГҮЙ (root дээр).
 *
 *   node scripts/serve-local.js
 *     → http://localhost:5001   Upload countdown  (/app/uplaod)
 *     → http://localhost:5002   Цаг тохируулах    (/app/time)
 *
 * ЯАГААД ЗҮГЭЭР ФАЙЛ СЕРВЕР БИШ ВЭ:
 *   Хоёр хуудас нь `../_gate.js` гэж ЭЦЭГ ХАВТСААС хамаардаг бөгөөд
 *   `/app/uplaod` гэсэн ҮНЭМЛЭХҮЙ холбоос агуулдаг. Хавтсыг нь шууд
 *   root дээр тавибал хаалт ачаалагдахгүй (404) — хуудас бүхэлдээ
 *   нуугдсан хэвээр үлдэж, хоосон харагдана.
 *
 *   Тиймээс энэ сервер нь HTML-ийг УЧИРЛАН дамжуулж, замуудыг root-д
 *   тохируулж бичнэ.
 *
 * ⚠️ ЭХ ФАЙЛЫГ ХУУЛАХГҮЙ. Хүсэлт бүрд `public-web/public/app/...`-аас
 *    шууд уншина — эх файлаа заасны дараа хуудсаа сэргээхэд өөрчлөлт
 *    шууд харагдана. Хуулбар үүсгэвэл хоёр хувилбар салж, аль нь
 *    үнэн болох нь мэдэгдэхгүй болно.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'public-web', 'public', 'app');

const SITES = [
  { name: 'Upload countdown', dir: 'uplaod', port: 5001 },
  { name: 'Цаг тохируулах', dir: 'time', port: 5002 },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * HTML доторх замуудыг root-д тохируулна.
 *
 * ⚠️ `../_gate.js` нь Vercel дээр `/app/_gate.js` руу хөрвөдөг. Root
 *    дээр тэр нь `/_gate.js`-ээс ДЭЭШ заах тул хөтөч татгалзана.
 */
function rewriteHtml(html) {
  return html
    .replace(/(["'])\.\.\/_gate\.js\1/g, '$1/_gate.js$1')
    .replace(/(["'])\/app\/(uplaod|time)\/?\1/g, '$1/$1')
    .replace(/(["'])\.\//g, '$1/');
}

function serve(site) {
  const dir = path.join(ROOT, site.dir);

  const server = http.createServer((req, res) => {
    // Асуулгын мөрийг хаяна — `?t=123` мэтийн кэш тайлагч.
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';

    // ── Хаалтын скрипт нь ЭЦЭГ хавтсанд ─────────────────────────
    let file =
      urlPath === '/_gate.js'
        ? path.join(ROOT, '_gate.js')
        : path.join(dir, urlPath);

    // ⚠️ Хавтаснаас гарахыг хаана (`..%2f` мэт). Локал хэрэгсэл ч
    //    гэсэн бүх файлаа сүлжээнд нээж өгөх ёсгүй.
    const allowed = [dir, path.join(ROOT, '_gate.js')];
    const resolved = path.resolve(file);
    if (!allowed.some((a) => resolved === path.resolve(a) || resolved.startsWith(path.resolve(a) + path.sep))) {
      res.writeHead(403).end('Хориотой');
      return;
    }

    fs.readFile(resolved, (err, buf) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Олдсонгүй: ${urlPath}`);
        return;
      }
      const ext = path.extname(resolved).toLowerCase();
      const body = ext === '.html' ? Buffer.from(rewriteHtml(buf.toString('utf8')), 'utf8') : buf;
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        // Эх файлаа засаад сэргээхэд ШУУД харагдах ёстой.
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Length': body.length,
      });
      res.end(body);
    });
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`  ✕ ${site.port} порт завгүй байна — ${site.name} эхлэхгүй.`);
    } else {
      console.error(`  ✕ ${site.name}: ${e.message}`);
    }
  });

  server.listen(site.port, () => {
    console.log(`  ✓ ${site.name.padEnd(20)} http://localhost:${site.port}`);
  });
}

if (!fs.existsSync(ROOT)) {
  console.error(`Хавтас олдсонгүй: ${ROOT}`);
  process.exit(1);
}

console.log('\n  Локал сервер:\n');
SITES.forEach(serve);
console.log('\n  Зогсоох: Ctrl+C\n');

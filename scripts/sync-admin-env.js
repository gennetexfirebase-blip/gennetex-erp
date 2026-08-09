#!/usr/bin/env node
/**
 * Supabase тохиргоо → admin-web/index.html синк
 * Эх сурвалж: process.env (Vercel) эсвэл .env
 * Ажиллуулах: npm run admin:sync-env
 *   node scripts/sync-admin-env.js [target/index.html]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env');
const DEFAULT_ADMIN_HTML = path.join(ROOT, 'admin-web/index.html');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) return;
      out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    });
  return out;
}

function resolveSupabaseCreds() {
  const fileEnv = readEnvFile(ENV_FILE);
  const url =
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    fileEnv.EXPO_PUBLIC_SUPABASE_URL ||
    fileEnv.SUPABASE_URL;
  const key =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    fileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    fileEnv.SUPABASE_ANON_KEY;
  return { url, key };
}

function syncAdminEnv(targetHtml = DEFAULT_ADMIN_HTML) {
  const { url, key } = resolveSupabaseCreds();
  if (!url || !key) {
    console.warn(
      '[sync-admin-env] Supabase URL/key олдсонгүй — index.html дээрх одоогийн утгыг хэвээр үлдээнэ.',
    );
    return false;
  }
  if (!fs.existsSync(targetHtml)) {
    console.error('[sync-admin-env] Файл олдсонгүй:', targetHtml);
    return false;
  }
  let html = fs.readFileSync(targetHtml, 'utf8');
  html = html.replace(/const SUPABASE_URL = '[^']*';/, `const SUPABASE_URL = '${url}';`);
  html = html.replace(
    /const SUPABASE_ANON_KEY = '[^']*';/,
    `const SUPABASE_ANON_KEY = '${key}';`,
  );
  fs.writeFileSync(targetHtml, html);
  console.log('[sync-admin-env] Supabase синк:', url, '→', path.relative(ROOT, targetHtml));
  return true;
}

if (require.main === module) {
  const target = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_ADMIN_HTML;
  const ok = syncAdminEnv(target);
  if (!ok && !resolveSupabaseCreds().url) process.exit(1);
}

module.exports = { syncAdminEnv, resolveSupabaseCreds };

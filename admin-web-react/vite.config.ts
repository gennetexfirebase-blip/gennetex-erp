import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Supabase-ийн нийтийн (anon) тохиргоог олох.
 *
 * Төслийн бусад хэсэг `EXPO_PUBLIC_*` нэршил ашигладаг (mobile app),
 * Vite бол зөвхөн `VITE_*`-ийг ил гаргадаг. Тиймээс энд гүүр тавьж,
 * ижил нэг эх сурвалжаас (Vercel-ийн env эсвэл репо дэх .env) уншина —
 * ингэснээр нэг нууцлалыг хоёр газар давхардуулж тавих шаардлагагүй.
 *
 * ⚠️ Зөвхөн ANON key. Service-role key энд ОГТ орохгүй.
 */
function readEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const fileEnv = readEnvFile(path.resolve(__dirname, '..', '.env'));
const pick = (...keys: string[]) =>
  keys.map((k) => process.env[k] || fileEnv[k]).find(Boolean) || '';

const SUPABASE_URL = pick('VITE_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_URL');
const SUPABASE_ANON_KEY = pick(
  'VITE_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_ANON_KEY'
);

// Админ панел нь `https://<domain>/gennetex/admin` дор байрлана
// (`scripts/build-vercel.cjs` → dist-web/gennetex/admin).
export default defineConfig({
  plugins: [react()],
  base: '/gennetex/admin/',
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(SUPABASE_ANON_KEY),
  },
  // Төслийн үндсэн `src/` болон `admin-web/` доторх ХУВААЛЦСАН модулиудыг
  // (ирцийн тайлан угсрагч, xlsx бичигч) шууд импортлохыг зөвшөөрнө —
  // ингэснээр код давхардахгүй, апп ба вэбээс татсан Excel ижил гарна.
  server: { fs: { allow: ['..'] } },
  build: { outDir: 'dist', sourcemap: false },
});

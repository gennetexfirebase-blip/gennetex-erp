import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * cv.gennetex.com — зөвхөн "ажилд орох" хэсэг.
 *
 * Компонент, загвар, агуулгыг `public-web/`-ээс ШУУД импортолно (хуулбарлахгүй)
 * тул үндсэн сайт дээр хийсэн засвар энд автоматаар тусна.
 *
 * ⚠️ `public-web/src` доторх файл `lucide-react` гэх мэт багцыг дуудахад Node
 * нь ТУХАЙН ФАЙЛЫН хавтаснаас дээш өгсөж хайдаг тул `public-web/node_modules`
 * заавал байх ёстой (`vercel.json` дахь installCommand үүнийг суулгана).
 * Хоёр хавтсанд React зэрэг багц ДАВХАР суух тул `dedupe`-ээр нэг хувь
 * ашиглахыг албадана — эс тэгвэл React hook-ууд хоёр инстанс дээр унана.
 */
const SHARED_DEPS = [
  'react',
  'react-dom',
  'react-router-dom',
  'react-router',
  'lucide-react',
  'motion',
  '@supabase/supabase-js',
  'jspdf',
  'html2canvas',
];

export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: SHARED_DEPS },
  server: { fs: { allow: ['..'] } },
  build: { outDir: 'dist', emptyOutDir: true },
});

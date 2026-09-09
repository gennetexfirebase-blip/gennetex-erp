import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * cv.gennetex.com — зөвхөн "ажилд орох" хэсэг.
 *
 * Компонент, загвар, агуулгыг `public-web/`-ээс ШУУД импортолно (хуулбарлахгүй)
 * тул үндсэн сайт дээр хийсэн засвар энд автоматаар тусна.
 */
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: ['..'] } },
  build: { outDir: 'dist', emptyOutDir: true },
});

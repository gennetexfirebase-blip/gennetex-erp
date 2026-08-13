const expoConfig = require('eslint-config-expo/flat');

/**
 * ESLint тохиргоо.
 *
 * ЗОРИЛГО нь код гоёчлох биш — АЖИЛЛАХГҮЙ КОДЫГ олох.
 *
 * Яагаад нэмсэн бэ: `ConversationScreen`-д устсан функц рүү заасан мөр
 * үлдсэн байсныг зөвхөн хэрэглэгч апп нээж, дэлгэц унаснаар л олж мэдэв
 * (`ReferenceError: Property 'cleanupOutgoing' doesn't exist`). Babel нь
 * ийм алдааг барьдаггүй — syntax зөв тул. `no-undef` дүрэм үүнийг
 * бүх файл дээр зэрэг олно.
 *
 * Тиймээс дүрмүүдийг ХОЁР ангилсан:
 *   error → апп ажиллах үед унах шалтгаан болох зүйл
 *   off   → зөвхөн загварын асуудал (одоо байгаа кодыг дэмий үймүүлэхгүй)
 */
module.exports = [
  ...expoConfig,
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      'admin-web/**',
      'public-web/**',
      'fix-frontend/**',
      'fix-public-site/**',
      'sitecontent-fallback/**',
      'supabase/functions/**',
      'scripts/**',
      '.expo/**',
    ],
  },
  {
    rules: {
      // ── Ажиллах үед унагаах алдаанууд ──────────────────────────────
      'no-undef': 'error',                 // байхгүй хувьсагч/функц дуудах
      'no-unreachable': 'error',           // хэзээ ч гүйцэтгэгдэхгүй код
      'no-dupe-keys': 'error',             // объектод давхардсан түлхүүр
      'no-dupe-args': 'error',
      'no-const-assign': 'error',
      'no-obj-calls': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-cond-assign': 'error',
      'no-func-assign': 'error',
      'no-import-assign': 'error',
      'no-self-assign': 'error',
      'no-unsafe-negation': 'error',
      'no-sparse-arrays': 'error',

      // Байхгүй функцийг namespace-ээс дуудах — жинхэнэ crash.
      // Жишээ нь `chatApi.fetchConversation()` гэж дуудсан ч тэр export
      // байхгүй бол `undefined is not a function` гэж дэлгэц унана.
      'import/namespace': 'error',

      // ── React Compiler-ийн ЗӨВЛӨМЖ — унагаадаггүй ─────────────────
      // Эдгээр нь гүйцэтгэлийн оновчлолын тухай бөгөөд апп ажиллахад
      // саад болохгүй. `error` болгож үлдээвэл жинхэнэ crash-ууд 119
      // сануулгын дунд алдагдана. Тиймээс warning болгов — харагдана,
      // гэхдээ signal-ыг дарахгүй.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/static-components': 'warn',

      // ── Зөвхөн загвар — одоогийн кодыг үймүүлэхгүй ────────────────
      'no-unused-vars': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react/no-unescaped-entities': 'off',
      'import/no-unresolved': 'off',
    },
  },
];

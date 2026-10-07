// GENNETEX дизайн систем — лого дээр суурилсан нэгдсэн токенууд.
//
// Брэндийн эх өнгө (assets/logo.png-аас пиксель түвшинд авсан):
//   brand cyan  #0099DB
//   brand ink   #201E1F
//
// Энэ файл mobile / admin-web / public-web гурвуулангийн өнгөний эх сурвалж.
// Ижил утгуудыг вэб талд гараар тусгасан байдаг:
//   admin-web/index.html — :root / .dark доторх CSS хувьсагчид
//   public-web/tailwind.config.js — graphite / brand / accent
//
// Дүрэм:
//   • Бүх текст/дэвсгэрийн хослол WCAG AA (энгийн текст 4.5:1, том текст 3:1) хангана.
//   • Дүүргэлт (fill) дээрх текстийг `on*` токеноор авна — гараар өнгө бичихгүй.
//   • Неон glow ашиглахгүй; сүүдэр нь зөөлөн, гүнийг л илэрхийлнэ.

// ---------------------------------------------------------------------------
// Брэндийн шатлал
// ---------------------------------------------------------------------------

export const brand = {
  50: '#ecf8fe',
  100: '#d2eefc',
  200: '#a5dcf7',
  300: '#6ec6f0',
  400: '#2fabe4',
  500: '#0099db', // ← лого
  600: '#0075ad',
  700: '#00628f',
  800: '#075275',
  900: '#0c4461',
  950: '#082c40',
};

export const ink = {
  50: '#f7f7f8',
  100: '#efeff1',
  200: '#dfe6ef',
  300: '#bdccdc',
  400: '#9c9ca4',
  500: '#77777f',
  600: '#5f7086',
  700: '#48474d',
  800: '#333237',
  900: '#201e1f', // ← лого
  950: '#141314',
};

// ---------------------------------------------------------------------------
// Dark горим
// ---------------------------------------------------------------------------

export const darkColors = {
  // --- Semantic ---
  background: '#0b1220',
  onBackground: '#f8fafc',
  surface: '#111c2e',
  surfaceDim: '#0b1220',
  surfaceBright: '#26364c',
  surfaceContainerLowest: '#080e19',
  surfaceContainerLow: '#0f1929',
  surfaceContainer: '#111c2e',
  surfaceContainerHigh: '#18263a',
  surfaceContainerHighest: '#223249',
  onSurface: '#f8fafc',
  onSurfaceVariant: '#a8b5c7',
  outline: '#7f8ea3',
  outlineVariant: '#2b3a50',

  // Дүүргэлт болох брэнд өнгө + түүн дээрх текст.
  // #201e1f маягийн бараан текст #0099db дээр 5.1:1 — логоны өөрийнх нь хослол.
  primaryContainer: '#0099db',
  onPrimaryContainer: '#06222e',
  primaryFixedDim: '#53bce9',

  secondary: '#8fd3f2',
  secondaryContainer: '#00628f',
  onSecondaryContainer: '#cfeaf9',
  tertiary: '#edf3fb',
  errorColor: '#ff6b60',

  // --- Legacy alias (хуучин screen-үүд эдгээрийг ашигладаг) ---
  bg: '#0b1220',
  bgAlt: '#0f1929',
  surfaceAlt: '#18263a',
  surfaceHi: '#223249',
  // Логоны цэнхэрийн шатлалаас (brand[400]) — гадаргуу дээр 6.6:1, дэвсгэр
  // дээр 7.2:1. Өмнө нь Tailwind-ийн sky (#38bdf8) байсан тул брэндээс зөрдөг байв.
  primary: brand[400],
  primaryDark: brand[500],
  primarySoft: 'rgba(47,171,228,0.15)',
  accent: brand[300],
  success: '#3fcf8e',
  successDark: '#1f9d63',
  successSoft: 'rgba(63,207,142,0.13)',
  warning: '#f5b544',
  danger: '#ff6b60',
  text: '#f8fafc',
  textMuted: '#a8b5c7',
  textFaint: '#94a3b8',
  border: 'rgba(255,255,255,0.09)',
  borderHi: '#2a3a50',
  onPrimary: '#06222e',

  // glass helpers
  glassBg: 'rgba(22,34,52,0.94)',
  glassBorder: 'rgba(255,255,255,0.10)',
  overlay: 'rgba(10,10,12,0.78)',
  glowShadow: '#0099db',
};

// ---------------------------------------------------------------------------
// Light горим
// ---------------------------------------------------------------------------

export const lightColors = {
  // --- Semantic ---
  // Цэнхэр өнгөтэй үл ялиг зохицсон саарал (цэвэр саарал биш).
  background: '#f4f7fb',
  onBackground: '#0f172a',
  surface: '#ffffff',
  surfaceDim: '#eaf0f6',
  surfaceBright: '#ffffff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f8fafc',
  surfaceContainer: '#ffffff',
  surfaceContainerHigh: '#f1f5f9',
  surfaceContainerHighest: '#e2e8f0',
  onSurface: '#0f172a',
  onSurfaceVariant: '#475569',
  outline: '#94a3b8',
  outlineVariant: '#e2e8f0',

  // Цагаан текст уншигдахын тулд брэндээс нэг шат бараан (4.67:1).
  // Цэвэр #0099db-г дүрс/хүрээ/онцлолд ашиглана — доорх `brandPure`.
  primaryContainer: brand[600],
  onPrimaryContainer: '#ffffff',
  primaryFixedDim: brand[700],

  secondary: '#334155',
  secondaryContainer: '#e2e8f0',
  onSecondaryContainer: '#1e293b',
  tertiary: '#0f172a',
  errorColor: '#b91c1c',

  // --- Legacy alias ---
  bg: '#f4f7fb',
  bgAlt: '#eaf0f6',
  surfaceAlt: '#f8fafc',
  surfaceHi: '#f1f5f9',
  // brand[600] — цагаан дээр 5.1:1, дэвсгэр дээр 4.7:1 (WCAG AA).
  primary: brand[600],
  primaryDark: brand[700],
  primarySoft: 'rgba(0,117,173,0.10)',
  accent: brand[600],
  success: '#047857',
  successDark: '#065f46',
  successSoft: 'rgba(4,120,87,0.10)',
  warning: '#92400e',
  danger: '#b91c1c',
  text: '#0f172a',
  textMuted: '#475569',
  textFaint: '#64748b',
  border: '#e2e8f0',
  borderHi: '#cbd5e1',
  onPrimary: '#ffffff',

  // glass helpers
  glassBg: 'rgba(255,255,255,0.96)',
  glassBorder: 'rgba(15,23,42,0.08)',
  overlay: 'rgba(15,23,42,0.48)',
  glowShadow: '#0099db',
};

// Хоёр горимд ижил хэвээр үлдэх логоны цэвэр өнгө — лого, брэнд тэмдэг,
// идэвхтэй индикатор зэрэгт таних тэмдэг болгож ашиглана.
darkColors.brandPure = brand[500];
lightColors.brandPure = brand[500];

export function makeGradients(c) {
  return {
    header: [c.surfaceDim, c.surface],
    // Үндсэн товч — логоны цэнхэрээс гүн цэнхэр рүү (хоёр горимд ижил,
    // дээр нь цагаан текст: brand[600] дээр 4.9:1).
    primary: [brand[500], brand[700]],
    brand: ['#0f172a', '#0c4a6e'],
    // Hero хэсгүүдэд (нэвтрэх, нүүр, ирц) — логоны цэнхэрээс гүн цэнхэр
    // рүү. Дээр нь цагаан текст: brand[700] дээр 6.6:1, brand[500] дээр
    // 3.2:1 тул том/тод текстэд л тавина.
    hero: [brand[500], brand[700], brand[900]],
    success: [c.success, c.successDark],
    danger: [c.danger, c.danger],
    warning: [c.warning, c.warning],
    dark: [c.background, c.surfaceContainerLow],
  };
}

export function makeShadow(c, isDark) {
  const col = isDark ? '#000000' : '#0f172a';
  return {
    sm: {
      shadowColor: col,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.18 : 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: col,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.22 : 0.055,
      shadowRadius: 8,
      elevation: 2,
    },
    lg: {
      shadowColor: col,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.34 : 0.1,
      shadowRadius: 22,
      elevation: 8,
    },
    // Хуучин "glow" — неон биш, брэнд өнгөт зөөлөн өргөлт болгов.
    glow: {
      shadowColor: isDark ? '#000000' : brand[700],
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.3 : 0.18,
      shadowRadius: 8,
      elevation: 3,
    },
  };
}

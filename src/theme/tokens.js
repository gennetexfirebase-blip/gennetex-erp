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
  600: '#007cb4',
  700: '#00628f',
  800: '#075275',
  900: '#0c4461',
  950: '#082c40',
};

export const ink = {
  50: '#f7f7f8',
  100: '#efeff1',
  200: '#e2e2e5',
  300: '#c8c8cd',
  400: '#9c9ca4',
  500: '#77777f',
  600: '#5c5c64',
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
  background: '#131315',
  onBackground: '#f2f2f4',
  surface: '#1c1c1f',
  surfaceDim: '#131315',
  surfaceBright: '#35353b',
  surfaceContainerLowest: '#0e0e10',
  surfaceContainerLow: '#17171a',
  surfaceContainer: '#1c1c1f',
  surfaceContainerHigh: '#232327',
  surfaceContainerHighest: '#2b2b30',
  onSurface: '#f2f2f4',
  onSurfaceVariant: '#b0b0b8',
  outline: '#6f6f78',
  outlineVariant: '#3a3a40',

  // Дүүргэлт болох брэнд өнгө + түүн дээрх текст.
  // #201e1f маягийн бараан текст #0099db дээр 5.1:1 — логоны өөрийнх нь хослол.
  primaryContainer: '#0099db',
  onPrimaryContainer: '#06222e',
  primaryFixedDim: '#33b0e4',

  secondary: '#8fd3f2',
  secondaryContainer: '#00628f',
  onSecondaryContainer: '#cfeaf9',
  tertiary: '#f2f2f4',
  errorColor: '#ff6b60',

  // --- Legacy alias (хуучин screen-үүд эдгээрийг ашигладаг) ---
  bg: '#131315',
  bgAlt: '#17171a',
  surfaceAlt: '#232327',
  surfaceHi: '#2b2b30',
  // Гадаргуу дээрх текст/дүрс болж ордог тул тод хувилбарыг нь авна (7.5:1).
  primary: '#33b0e4',
  primaryDark: '#0099db',
  primarySoft: 'rgba(0,153,219,0.14)',
  accent: '#8fd3f2',
  success: '#3fcf8e',
  successDark: '#1f9d63',
  successSoft: 'rgba(63,207,142,0.13)',
  warning: '#f5b544',
  danger: '#ff6b60',
  text: '#f2f2f4',
  textMuted: '#b0b0b8',
  textFaint: '#86868f',
  border: 'rgba(255,255,255,0.09)',
  borderHi: '#3a3a40',
  onPrimary: '#06222e',

  // glass helpers
  glassBg: 'rgba(28,28,31,0.62)',
  glassBorder: 'rgba(255,255,255,0.10)',
  overlay: 'rgba(10,10,12,0.78)',
  glowShadow: '#0099db',
};

// ---------------------------------------------------------------------------
// Light горим
// ---------------------------------------------------------------------------

export const lightColors = {
  // --- Semantic ---
  background: '#f6f7f9',
  onBackground: '#201e1f',
  surface: '#ffffff',
  surfaceDim: '#eef0f3',
  surfaceBright: '#ffffff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f1f3f5',
  surfaceContainer: '#ffffff',
  surfaceContainerHigh: '#e9ecef',
  surfaceContainerHighest: '#dee2e6',
  onSurface: '#201e1f',
  onSurfaceVariant: '#5c5c64',
  outline: '#9c9ca4',
  outlineVariant: '#e2e2e5',

  // Цагаан текст уншигдахын тулд брэндээс нэг шат бараан (4.67:1).
  // Цэвэр #0099db-г дүрс/хүрээ/онцлолд ашиглана — доорх `brandPure`.
  primaryContainer: '#007cb4',
  onPrimaryContainer: '#ffffff',
  primaryFixedDim: '#00628f',

  secondary: '#00628f',
  secondaryContainer: '#d2eefc',
  onSecondaryContainer: '#00486b',
  tertiary: '#201e1f',
  errorColor: '#d92d20',

  // --- Legacy alias ---
  bg: '#f6f7f9',
  bgAlt: '#eef0f3',
  surfaceAlt: '#f1f3f5',
  surfaceHi: '#e9ecef',
  primary: '#007cb4',
  primaryDark: '#00628f',
  primarySoft: 'rgba(0,153,219,0.10)',
  accent: '#00628f',
  success: '#0b7a44',
  successDark: '#0b6b3d',
  successSoft: 'rgba(11,122,68,0.10)',
  warning: '#b45309',
  danger: '#d92d20',
  text: '#201e1f',
  textMuted: '#5c5c64',
  textFaint: '#6e6e76',
  border: '#e2e2e5',
  borderHi: '#c8c8cd',
  onPrimary: '#ffffff',

  // glass helpers
  glassBg: 'rgba(255,255,255,0.72)',
  glassBorder: 'rgba(32,30,31,0.08)',
  overlay: 'rgba(32,30,31,0.48)',
  glowShadow: '#0099db',
};

// Хоёр горимд ижил хэвээр үлдэх логоны цэвэр өнгө — лого, брэнд тэмдэг,
// идэвхтэй индикатор зэрэгт таних тэмдэг болгож ашиглана.
darkColors.brandPure = brand[500];
lightColors.brandPure = brand[500];

export function makeGradients(c) {
  return {
    header: [c.surfaceDim, c.surface],
    primary: [c.primaryContainer, c.primaryFixedDim],
    brand: [brand[500], brand[700]],
    success: [c.success, c.successDark],
    danger: [c.danger, c.danger],
    warning: [c.warning, c.warning],
    dark: [c.background, c.surfaceContainerLow],
  };
}

export function makeShadow(c, isDark) {
  const col = isDark ? '#000000' : '#201e1f';
  return {
    sm: {
      shadowColor: col,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.22 : 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
    md: {
      shadowColor: col,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.28 : 0.07,
      shadowRadius: 10,
      elevation: 3,
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

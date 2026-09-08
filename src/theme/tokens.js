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
  background: '#0e1724',
  onBackground: '#edf3fb',
  surface: '#162234',
  surfaceDim: '#0e1724',
  surfaceBright: '#344860',
  surfaceContainerLowest: '#0a111c',
  surfaceContainerLow: '#111d2d',
  surfaceContainer: '#162234',
  surfaceContainerHigh: '#1c2c41',
  surfaceContainerHighest: '#25374e',
  onSurface: '#edf3fb',
  onSurfaceVariant: '#a0b0c5',
  outline: '#768aa4',
  outlineVariant: '#2a3a50',

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
  bg: '#0e1724',
  bgAlt: '#111d2d',
  surfaceAlt: '#1c2c41',
  surfaceHi: '#25374e',
  // Гадаргуу дээрх текст/дүрс болж ордог тул тод хувилбарыг нь авна (7.5:1).
  primary: '#53bce9',
  primaryDark: '#0099db',
  primarySoft: 'rgba(0,153,219,0.14)',
  accent: '#8fd3f2',
  success: '#3fcf8e',
  successDark: '#1f9d63',
  successSoft: 'rgba(63,207,142,0.13)',
  warning: '#f5b544',
  danger: '#ff6b60',
  text: '#edf3fb',
  textMuted: '#a0b0c5',
  textFaint: '#92a4bc',
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
  background: '#f3f6fa',
  onBackground: '#18283d',
  surface: '#ffffff',
  surfaceDim: '#eaf0f7',
  surfaceBright: '#ffffff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#edf3f9',
  surfaceContainer: '#ffffff',
  surfaceContainerHigh: '#e5edf6',
  surfaceContainerHighest: '#d9e3ee',
  onSurface: '#18283d',
  onSurfaceVariant: '#5f7086',
  outline: '#9c9ca4',
  outlineVariant: '#dfe6ef',

  // Цагаан текст уншигдахын тулд брэндээс нэг шат бараан (4.67:1).
  // Цэвэр #0099db-г дүрс/хүрээ/онцлолд ашиглана — доорх `brandPure`.
  primaryContainer: '#0075ad',
  onPrimaryContainer: '#ffffff',
  primaryFixedDim: '#00628f',

  secondary: '#00628f',
  secondaryContainer: '#d2eefc',
  onSecondaryContainer: '#00486b',
  tertiary: '#18283d',
  errorColor: '#d92d20',

  // --- Legacy alias ---
  bg: '#f3f6fa',
  bgAlt: '#eaf0f7',
  surfaceAlt: '#edf3f9',
  surfaceHi: '#e5edf6',
  primary: '#0075ad',
  primaryDark: '#00628f',
  primarySoft: 'rgba(0,153,219,0.10)',
  accent: '#00628f',
  success: '#0b7a44',
  successDark: '#0b6b3d',
  successSoft: 'rgba(11,122,68,0.10)',
  warning: '#b45309',
  danger: '#d92d20',
  text: '#18283d',
  textMuted: '#5f7086',
  textFaint: '#61738a',
  border: '#dfe6ef',
  borderHi: '#bdccdc',
  onPrimary: '#ffffff',

  // glass helpers
  glassBg: 'rgba(255,255,255,0.96)',
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
    brand: ['#112b44', '#075275'],
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

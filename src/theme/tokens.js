// GENNETEX дизайн систем — нэгдсэн токенууд (2026-10 шинэ дизайн).
//
// Эх сурвалж: design/theme.ts + design/gennetex-prototype.html (:root CSS).
//
// Дүрэм:
//   • Цагаан/саарал суурь (`ground`) дээр цагаан карт (`card`).
//   • Брэнд өнгө НЭГ: Gennetex ногоон #0B6E4F (dark: #2FA676).
//   • Градиент, гэрэлтэлт, шилэн эффект хэрэглэхгүй.
//   • Семантик өнгө (ok/warn/bad/ai) брэндээс тусдаа.
//
// Шинэ дэлгэцүүд шинэ нэрсийг (`ground`, `card`, `ink`, `muted`, `line`,
// `field`, `brand`, `brandSoft`, `ok`, `warn`, `bad`, `ai`…) ашиглана.
// Хуучин нэрс (`background`, `surface`, `text`, `primary`…) нь доорх
// alias-аар ижил утга руу заадаг тул бүх дэлгэц нэг дор шинэчлэгдэнэ.

// ---------------------------------------------------------------------------
// Брэндийн шатлал (ногоон)
// ---------------------------------------------------------------------------

export const brand = {
  50: '#EEF7F2',
  100: '#DCEEE4',
  200: '#BFE3D0',
  300: '#8ED2B2',
  400: '#4CC08E',
  500: '#2FA676', // dark горимын брэнд
  600: '#0B6E4F', // ← Gennetex ногоон (light горимын брэнд)
  700: '#085A40',
  800: '#07493A',
  900: '#063A2C',
  950: '#04140D',
};

export const ink = {
  50: '#F3F5F8',
  100: '#F1F3F6',
  200: '#E4E8ED',
  300: '#C9D0D9',
  400: '#98A2B1',
  500: '#7A8494',
  600: '#677284',
  700: '#3A4452',
  800: '#252D38',
  900: '#0F1722',
  950: '#0B0F14',
};

// Модулийн icon хавтангийн өнгө (design/theme.ts → iconTones).
export const iconTones = {
  green: '#0B8A55',
  blue: '#1F6FE0',
  amber: '#F08700',
  red: '#E2403A',
  purple: '#6A47E0',
  teal: '#0C978E',
  pink: '#DD3F7C',
  indigo: '#4652DE',
  slate: '#58677B',
};

// ---------------------------------------------------------------------------
// Үндсэн токенууд
// ---------------------------------------------------------------------------

const LIGHT = {
  ground: '#F3F5F8',
  bg: '#FFFFFF',
  card: '#FFFFFF',
  ink: '#0F1722',
  muted: '#677284',
  faint: '#98A2B1',
  line: '#E4E8ED',
  field: '#F1F3F6',

  brand: '#0B6E4F',
  brand2: '#085A40',
  brandSoft: '#DCEEE4',
  brandInk: '#FFFFFF',

  ok: '#15924A', okSoft: '#E3F4EA',
  warn: '#B86E00', warnSoft: '#FFF2D6',
  bad: '#D23A2F', badSoft: '#FCE7E5',
  ai: '#6F4FD8', aiSoft: '#EEE9FC',

  // Жагсаалтын мөрийн icon (prototype --t-*)
  tBlue: '#1474D4', tBlueBg: '#E4EFFB',
  tGreen: '#15924A', tGreenBg: '#E3F4EA',
  tAmber: '#B86E00', tAmberBg: '#FFF0D1',
  tRed: '#D23A2F', tRedBg: '#FCE7E5',
  tPurple: '#6F4FD8', tPurpleBg: '#EEE9FC',
  tTeal: '#0E8A86', tTealBg: '#DFF4F2',
  tSlate: '#4B5768', tSlateBg: '#EDF0F4',

  mapBg: '#E9EEF3', mapRoad: '#FFFFFF', mapWater: '#C9DDF2', mapPark: '#D3EBD9', mapBlock: '#E1E7EE',
};

const DARK = {
  ground: '#0B0F14',
  bg: '#11161D',
  card: '#161C24',
  ink: '#EEF2F6',
  muted: '#97A2B0',
  faint: '#6B7584',
  line: '#252D38',
  field: '#1C232C',

  brand: '#2FA676',
  brand2: '#23875F',
  brandSoft: '#12291F',
  brandInk: '#04140D',

  ok: '#3FCB7C', okSoft: '#12291C',
  warn: '#F2B13E', warnSoft: '#2E2412',
  bad: '#FF7366', badSoft: '#331916',
  ai: '#A68BFF', aiSoft: '#221C38',

  tBlue: '#6AB0F5', tBlueBg: '#16273B',
  tGreen: '#4CD18A', tGreenBg: '#13291D',
  tAmber: '#F2B13E', tAmberBg: '#2D2412',
  tRed: '#FF7F73', tRedBg: '#331A17',
  tPurple: '#B09AFF', tPurpleBg: '#231D39',
  tTeal: '#4FD3CC', tTealBg: '#112B2A',
  tSlate: '#A9B4C2', tSlateBg: '#1F2630',

  mapBg: '#141B23', mapRoad: '#25303C', mapWater: '#173149', mapPark: '#15301F', mapBlock: '#18212B',
};

/** Шинэ токенуудаас хуучин нэрсийг гаргана — бүх хуучин дэлгэц шинэ өнгө авна. */
function withLegacy(t, isDark) {
  return {
    ...t,
    // --- Material-маягийн semantic ---
    background: t.ground,
    onBackground: t.ink,
    surface: t.card,
    surfaceDim: t.ground,
    surfaceBright: t.card,
    surfaceContainerLowest: t.card,
    surfaceContainerLow: t.field,
    surfaceContainer: t.card,
    surfaceContainerHigh: t.field,
    surfaceContainerHighest: t.line,
    onSurface: t.ink,
    onSurfaceVariant: t.muted,
    outline: t.faint,
    outlineVariant: t.line,

    primaryContainer: t.brand,
    onPrimaryContainer: t.brandInk,
    primaryFixedDim: t.brand2,

    secondary: t.muted,
    secondaryContainer: t.field,
    onSecondaryContainer: t.ink,
    tertiary: t.ink,
    errorColor: t.bad,

    // --- Legacy alias ---
    bg: t.ground,
    bgAlt: t.field,
    surfaceAlt: t.field,
    surfaceHi: t.field,
    primary: t.brand,
    primaryDark: t.brand2,
    primarySoft: t.brandSoft,
    accent: t.brand,
    success: t.ok,
    successDark: t.ok,
    successSoft: t.okSoft,
    warning: t.warn,
    danger: t.bad,
    text: t.ink,
    textMuted: t.muted,
    // `textFaint` хуучин дэлгэцүүдэд туслах ТЕКСТЭД ашиглагддаг тул
    // уншигдах `muted`-тай ойр байлгана; placeholder-д `faint`.
    textFaint: isDark ? '#7F8999' : '#7A8494',
    border: t.line,
    borderHi: isDark ? '#323B48' : '#D3D9E1',
    onPrimary: t.brandInk,

    glassBg: t.card,
    glassBorder: t.line,
    overlay: 'rgba(10,14,20,0.45)',
    glowShadow: t.brand,
    brandPure: t.brand,
  };
}

export const lightColors = withLegacy(LIGHT, false);
export const darkColors = withLegacy(DARK, true);

/**
 * Градиент ашиглахгүй (дизайны дүрэм). `LinearGradient`-тэй хуучин код
 * эвдрэхгүйн тулд ижил өнгө хоёр удаа өгнө — нэг өнгөт дэвсгэр болно.
 */
export function makeGradients(c) {
  const flat = (x) => [x, x];
  return {
    header: flat(c.ground),
    primary: flat(c.brand),
    brand: flat(c.brand),
    hero: flat(c.brand),
    success: flat(c.ok),
    danger: flat(c.bad),
    warning: flat(c.warn),
    dark: flat(c.ground),
  };
}

/** Маш бага сүүдэр (design shadow.card). */
export function makeShadow(c, isDark) {
  const col = isDark ? '#000000' : '#0F1722';
  return {
    sm: {
      shadowColor: col,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.25 : 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: col,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.08,
      shadowRadius: 10,
      elevation: 2,
    },
    lg: {
      shadowColor: col,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.4 : 0.12,
      shadowRadius: 22,
      elevation: 8,
    },
    // Хуучин "glow" — одоо энгийн бага сүүдэр.
    glow: {
      shadowColor: col,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.08,
      shadowRadius: 6,
      elevation: 2,
    },
  };
}

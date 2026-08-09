import { darkColors, lightColors, makeGradients, makeShadow } from './tokens';

export { darkColors, lightColors, makeGradients, makeShadow };

// Static default (dark = үндсэн горим). Migration хийгдээгүй screen-үүд үүнийг ашиглана.
// Runtime dark/light солих бол useTheme() ашиглана уу.
export const colors = darkColors;

export const gradients = makeGradients(darkColors);

export const shadow = makeShadow(darkColors, true);

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
  full: 999,
};

export const typography = {
  h1: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '800', color: colors.text },
  h3: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
};

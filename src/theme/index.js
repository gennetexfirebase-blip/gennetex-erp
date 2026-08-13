import { brand, ink, darkColors, lightColors, makeGradients, makeShadow } from './tokens';

export { brand, ink, darkColors, lightColors, makeGradients, makeShadow };

// Static default (dark = үндсэн горим).
// АНХААР: энэ нь горимоос хамаарахгүй тул зөвхөн горимд хамаарахгүй утгад
// ашиглана. Дэлгэц дээрх өнгө авахдаа заавал useTheme() ашиглана уу —
// эс бөгөөс light горимд цагаан дэвсгэр дээр цагаан текст гарна.
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

/** Хүрэх талбайн доод хэмжээ — iOS HIG 44pt / Android 48dp. */
export const touch = {
  min: 44,
  icon: 44,
  compact: 36,
};

/**
 * Үсгийн шатлал — өнгөгүй.
 * Өнгийг дуудах талдаа useTheme()-ээс авч нэмнэ:
 *   <Text style={[type.h1, { color: colors.text }]}>
 */
export const type = {
  display: { fontSize: 32, fontWeight: '800', letterSpacing: -0.6, lineHeight: 38 },
  h1: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4, lineHeight: 32 },
  h2: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2, lineHeight: 26 },
  h3: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
};

/** @deprecated `type`-г ашиглаад өнгийг useTheme()-ээс авна уу. */
export const typography = type;

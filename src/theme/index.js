import { Platform } from 'react-native';
import { brand, ink, iconTones, darkColors, lightColors, makeGradients, makeShadow } from './tokens';

export { brand, ink, iconTones, darkColors, lightColors, makeGradients, makeShadow };

/**
 * Фонт. iOS дээр системийн SF Pro (fontFamily өгөхгүй), бусад дээр мөн
 * системийн фонт. Лого бичиг "Gennetex" нь Fredoka (app.json → expo-font).
 */
export const fonts = {
  wordmark: Platform.select({ ios: 'Fredoka-Medium', android: 'Fredoka_500Medium', default: 'Fredoka' }),
};

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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  // design/theme.ts
  tile: 16,
  input: 14,
  button: 16,
  card: 20,
  sheet: 26,
  pill: 999,
  full: 999,
};

/** Хүрэх талбайн доод хэмжээ — iOS HIG 44pt / Android 48dp. */
export const touch = {
  min: 48,
  icon: 48,
  compact: 44,
};

/**
 * Үсгийн шатлал — өнгөгүй.
 * Өнгийг дуудах талдаа useTheme()-ээс авч нэмнэ:
 *   <Text style={[type.h1, { color: colors.text }]}>
 */
export const type = {
  display: { fontSize: 34, fontWeight: '700', letterSpacing: -0.6, lineHeight: 38 },
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4, lineHeight: 32 },
  h2: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2, lineHeight: 26 },
  h3: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
};

/** @deprecated `type`-г ашиглаад өнгийг useTheme()-ээс авна уу. */
export const typography = type;

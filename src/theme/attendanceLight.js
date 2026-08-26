// Employee "Ирц" модулийн ФИКСЛЭГДСЭН light palette.
//
// Reference doc-д тоочсон яг тэр hex утгуудыг (§20) хадгална — цорын ганц
// зорилго нь: reference screenshot-ийн улбар шар/шар accent-ийг БҮГДИЙГ
// #0099DB болгох тул одоо байгаа `lightColors`-ыг ашиглавал (primary нь
// contrast-ийн шалтгаанаар #007cb4 болж гажна) тэр зорилгод хүрэхгүй.
// Тиймээс энд БРЭНДИЙН ЦЭВЭР ӨНГИЙГ (`brand[500]`) шууд `primary` болгоно.
//
// `AttendanceScreen`-ийн employee салбар болон түүний дэд дэлгэцүүд эндээс
// шууд импортолж ашиглана, `useTheme()`-ээр ДАМЖУУЛАХГҮЙ (админы тохиргооноос
// үл хамааран үргэлж цайвар байх ёстой тул).
import { brand, makeShadow } from './tokens';

export const colors = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F3F5',
  text: '#171717',
  textMuted: '#737373',
  textFaint: '#9CA3AF',
  border: '#E5E7EB',
  disabled: '#D1D5DB',

  primary: brand[500], // #0099DB
  primaryDark: brand[600],
  primarySoft: 'rgba(0,153,219,0.08)',
  primaryMedium: 'rgba(0,153,219,0.15)',
  primaryBorder: 'rgba(0,153,219,0.35)',
  onPrimary: '#FFFFFF',

  success: '#22C55E',
  danger: '#EF4444',
  warning: '#F59E0B',

  overlay: 'rgba(23,23,23,0.48)',
  brandPure: brand[500],
};

export const shadow = makeShadow(colors, false);
export const isDark = false;

export default { colors, shadow, isDark };

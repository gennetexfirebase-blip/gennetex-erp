// Quantix AI / Synthetic Horizon дизайн систем — dark (үндсэн) + light токенууд
// Дизайн эх сурвалж: stitch_modern_tech_interface/synthetic_horizon/DESIGN.md

export const darkColors = {
  // --- Semantic (Synthetic Horizon) ---
  background: '#051424',
  onBackground: '#d4e4fa',
  surface: '#122131',
  surfaceDim: '#051424',
  surfaceBright: '#2c3a4c',
  surfaceContainerLowest: '#010f1f',
  surfaceContainerLow: '#0d1c2d',
  surfaceContainer: '#122131',
  surfaceContainerHigh: '#1c2b3c',
  surfaceContainerHighest: '#273647',
  onSurface: '#d4e4fa',
  onSurfaceVariant: '#b9cacb',
  outline: '#849495',
  outlineVariant: '#3b494b',
  primaryContainer: '#00f0ff',
  onPrimaryContainer: '#006970',
  primaryFixedDim: '#00dbe9',
  secondary: '#dcb8ff',
  secondaryContainer: '#7701d0',
  onSecondaryContainer: '#dcb7ff',
  tertiary: '#f5f5ff',
  errorColor: '#ffb4ab',

  // --- Legacy alias (хуучин screen-үүд ашигладаг) ---
  bg: '#051424',
  bgAlt: '#0d1c2d',
  surfaceAlt: '#1c2b3c',
  surfaceHi: '#273647',
  primary: '#00f0ff',
  primaryDark: '#00dbe9',
  primarySoft: 'rgba(0,240,255,0.1)',
  accent: '#dcb8ff',
  success: '#34e5c4',
  successDark: '#00dbe9',
  successSoft: 'rgba(52,229,196,0.12)',
  warning: '#f5c563',
  danger: '#ffb4ab',
  text: '#d4e4fa',
  textMuted: '#b9cacb',
  textFaint: '#849495',
  border: 'rgba(255,255,255,0.08)',
  borderHi: '#3b494b',
  onPrimary: '#00363a',

  // glass helpers
  glassBg: 'rgba(18,33,49,0.55)',
  glassBorder: 'rgba(255,255,255,0.10)',
  overlay: 'rgba(1,15,31,0.75)',
  glowShadow: '#00f0ff',
};

export const lightColors = {
  // --- Semantic ---
  background: '#f8fafc',
  onBackground: '#0f172a',
  surface: '#ffffff',
  surfaceDim: '#eef2f7',
  surfaceBright: '#ffffff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f4f6f9',
  surfaceContainer: '#ffffff',
  surfaceContainerHigh: '#eef2f7',
  surfaceContainerHighest: '#e2e8f0',
  onSurface: '#0f172a',
  onSurfaceVariant: '#475569',
  outline: '#94a3b8',
  outlineVariant: '#e2e8f0',
  primaryContainer: '#0066ff',
  onPrimaryContainer: '#ffffff',
  primaryFixedDim: '#3b82f6',
  secondary: '#7c3aed',
  secondaryContainer: '#ede9fe',
  onSecondaryContainer: '#6d28d9',
  tertiary: '#0f172a',
  errorColor: '#dc2626',

  // --- Legacy alias ---
  bg: '#f8fafc',
  bgAlt: '#eef2f7',
  surfaceAlt: '#f4f6f9',
  surfaceHi: '#eef2f7',
  primary: '#0066ff',
  primaryDark: '#0052cc',
  primarySoft: 'rgba(0,102,255,0.08)',
  accent: '#7c3aed',
  success: '#10b981',
  successDark: '#059669',
  successSoft: 'rgba(16,185,129,0.1)',
  warning: '#f59e0b',
  danger: '#dc2626',
  text: '#0f172a',
  textMuted: '#475569',
  textFaint: '#94a3b8',
  border: '#e2e8f0',
  borderHi: '#cbd5e1',
  onPrimary: '#ffffff',

  // glass helpers
  glassBg: 'rgba(255,255,255,0.65)',
  glassBorder: 'rgba(15,23,42,0.08)',
  overlay: 'rgba(15,23,42,0.45)',
  glowShadow: '#0066ff',
};

export function makeGradients(c) {
  return {
    header: [c.surfaceDim, c.surface],
    primary: [c.primaryContainer, c.primaryFixedDim],
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
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.25 : 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    md: {
      shadowColor: col,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.3 : 0.08,
      shadowRadius: 16,
      elevation: 4,
    },
    lg: {
      shadowColor: col,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: isDark ? 0.4 : 0.12,
      shadowRadius: 28,
      elevation: 8,
    },
    glow: {
      shadowColor: c.glowShadow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: isDark ? 0.5 : 0.25,
      shadowRadius: 16,
      elevation: 6,
    },
  };
}

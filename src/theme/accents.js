// Модулийн онцлох өнгө — design/theme.ts `iconTones`.
//
// Light горимд: хавтангийн дэвсгэр = өнгө 11%, icon = өнгө.
// Dark горимд: хавтангийн дэвсгэр = `field`, icon = `ink`, duotone = brand 32%
// (`ModuleTile` компонент үүнийг хариуцна). Энд горим бүрт уншигдах icon
// өнгийг өгнө — жагсаалтын мөр, chip зэрэгт ашиглагдана.
//
// Хуучин түлхүүрүүд (brand, violet, rose) шинэ өнгө рүү заана.

const ACCENTS = {
  green: { light: '#0B8A55', dark: '#4CD18A' },
  blue: { light: '#1F6FE0', dark: '#6AB0F5' },
  amber: { light: '#C26D00', dark: '#F2B13E' },
  red: { light: '#E2403A', dark: '#FF7F73' },
  purple: { light: '#6A47E0', dark: '#B09AFF' },
  teal: { light: '#0C978E', dark: '#4FD3CC' },
  pink: { light: '#DD3F7C', dark: '#FF8DBA' },
  indigo: { light: '#4652DE', dark: '#8C9BFF' },
  slate: { light: '#58677B', dark: '#A9B4C2' },
  // --- хуучин нэрс ---
  brand: { light: '#0B6E4F', dark: '#2FA676' },
  violet: { light: '#6A47E0', dark: '#B09AFF' },
  rose: { light: '#E2403A', dark: '#FF7F73' },
};

export const ACCENT_KEYS = Object.keys(ACCENTS);

/**
 * Онцлох өнгийг горимд тааруулж буцаана.
 * @param {string} key ACCENT_KEYS-ийн нэг
 * @param {boolean} isDark useTheme()-ээс ирнэ
 */
export function accent(key, isDark) {
  const entry = ACCENTS[key] || ACCENTS.brand;
  return isDark ? entry.dark : entry.light;
}

/** Бүх онцлох өнгийг нэг горимд бэлдэж өгнө — render дотор дахин тооцохгүй. */
export function accentMap(isDark) {
  const out = {};
  for (const k of ACCENT_KEYS) out[k] = ACCENTS[k][isDark ? 'dark' : 'light'];
  return out;
}

/** Хавтангийн өнгө (light горимын iconTones) — 11% дэвсгэр тооцоход. */
export function toneOf(key) {
  return (ACCENTS[key] || ACCENTS.brand).light;
}

export default ACCENTS;

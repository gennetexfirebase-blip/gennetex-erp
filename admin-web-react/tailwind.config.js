/** @type {import('tailwindcss').Config} */
// Өнгөний утгууд нь `timely_clone_prompt.md` §1.1-ийн токенуудтай ЯГ таарна.
// CSS хувьсагчаар дамжуулснаар index.css дотор нэг эх сурвалж үлдэнэ.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--brand)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
          soft: 'var(--brand-soft)',
          ring: 'var(--brand-ring)',
        },
        app: 'var(--bg-app)',
        sidebar: 'var(--bg-sidebar)',
        topbar: 'var(--bg-topbar)',
        card: 'var(--bg-card)',
        card2: 'var(--bg-card-2)',
        hover: 'var(--bg-hover)',
        line: 'var(--border)',
        ink: 'var(--text)',
        muted: 'var(--text-muted)',
        subtle: 'var(--text-subtle)',
        success: { DEFAULT: 'var(--success)', soft: 'var(--success-soft)' },
        warning: { DEFAULT: 'var(--warning)', soft: 'var(--warning-soft)' },
        danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)' },
        info: 'var(--info)',
        purple: 'var(--purple)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: { panel: 'var(--shadow)' },
    },
  },
  plugins: [],
};

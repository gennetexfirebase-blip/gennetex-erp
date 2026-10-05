/** @type {import('tailwindcss').Config} */
// Өнгөний утгууд нь `timely_clone_prompt.md` §1.1-ийн токенуудтай ЯГ таарна.
// CSS хувьсагчаар дамжуулснаар index.css дотор нэг эх сурвалж үлдэнэ.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Дулаан саарал (stone) — Tailwind-ийн хүйтэн slate-ийг орлоно.
        slate: {
          50: '#faf8f4', 100: '#f2efe8', 200: '#e2ddd2', 300: '#cfc8ba', 400: '#a39d90',
          500: '#7e786c', 600: '#5e5a52', 700: '#45423c', 800: '#2f2d29', 900: '#232624', 950: '#181a19',
        },
        // Намуухан гүн ногоон-хөх — нүдэнд ээлтэй, ганц акцент.
        sky: {
          50: '#eef5f2', 100: '#dcebe5', 200: '#bad7cc', 300: '#92c0b0', 400: '#68a291',
          500: '#468474', 600: '#2e6b5e', 700: '#265a4f', 800: '#1e4840', 900: '#173832',
        },
        blue: {
          50: '#eef5f2', 100: '#dcebe5', 200: '#bad7cc', 300: '#92c0b0', 400: '#68a291',
          500: '#468474', 600: '#2e6b5e', 700: '#265a4f', 800: '#1e4840', 900: '#173832',
        },
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
      fontFamily: {
        display: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};

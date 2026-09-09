/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Roboto', '"Segoe UI"', 'Arial', 'sans-serif'],
        mono: ['"Roboto Mono"', 'Consolas', 'monospace'],
      },
      fontSize: {
        xxs: ['11px', '14px'],
      },
    },
  },
  plugins: [],
};

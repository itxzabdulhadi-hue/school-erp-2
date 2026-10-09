/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--brand-primary)',
          primaryDark: 'var(--brand-primary-dark)',
          primaryLight: 'var(--brand-primary-light)',
          secondary: 'var(--brand-secondary)',
          accent: 'var(--brand-accent)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.1)',
        pop: '0 12px 32px rgba(16,24,40,.18)',
      },
    },
  },
  plugins: [],
};

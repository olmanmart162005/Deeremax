/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        deeremax: {
          900: '#1B5E20',
          700: '#2E7D32',
          500: '#F9A825',
        },
      },
      boxShadow: {
        executive: '0 20px 40px rgba(16, 74, 33, 0.16)',
      },
    },
  },
  plugins: [],
}

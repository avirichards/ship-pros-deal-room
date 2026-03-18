/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
          950: '#132238',
        },
        teal: {
          400: '#2DD4BF',
          500: '#00BFA6',
          600: '#00A892',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

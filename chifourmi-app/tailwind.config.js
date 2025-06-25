/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        bordeaux: {
          50: '#fdf2f4',
          500: '#991b1b',
          600: '#7f1d1d',
          700: '#7c2d12',
        },
        vienne: {
          50: '#f0f9ff',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        }
      },
      animation: {
        'bounce-slow': 'bounce 1s infinite',
        'pulse-fast': 'pulse 1s infinite',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
} 
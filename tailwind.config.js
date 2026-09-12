/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        dragon: {
          950: '#0B1F16',
          900: '#0E1311',
          800: '#12241B',
          700: '#16a34a',
          500: '#2BD96A',
          300: '#86efac',
        },
        gold: '#D9A441',
        alliance: { red: '#ef4444', blue: '#3b82f6' },
      },
      fontFamily: {
        display: ['Rajdhani', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Modal phosphor-terminal tokens (DESIGN.md) — lime rationed to one accent per viewport
        void: '#000000',
        ground: '#181818',
        carbon: '#212525',
        circuit: '#485346',
        phosphorline: '#1f2a33',
        rust: '#231c1c',
        lime: '#7fee64',
        phosphor: '#ddffdc',
        mint: '#def0dd',
        sage: { 60: '#8cab87', 40: '#677d64' },
        moss: { 70: '#9cbf93', 80: '#aed2a4' },
        fern: '#859984',
        deepfern: '#697368',
        pine: '#3e4a3c',
        // legacy aliases (mapped onto phosphor palette so old classes keep working)
        dragon: {
          950: '#000000',
          900: '#000000',
          800: '#181818',
          700: '#3e4a3c',
          500: '#7fee64',
          300: '#aed2a4',
        },
        gold: '#D9A441',
        alliance: { red: '#ef4444', blue: '#3b82f6' },
      },
      fontFamily: {
        display: ['Inter Tight', 'Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: { card: '8px', btn: '12px' },
      maxWidth: { page: '1280px' },
    },
  },
  plugins: [],
};

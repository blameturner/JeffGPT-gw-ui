/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#1a1a1a',
        panel: '#242424',
        panelHi: '#2d2d2d',
        border: '#333333',
        accent: '#f59e0b',
        accentDim: '#b26f06',
        text: '#e7e5e4',
        muted: '#9ca3af',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 180ms ease-out',
      },
    },
  },
  plugins: [],
};

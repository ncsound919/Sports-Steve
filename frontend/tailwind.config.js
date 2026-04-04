/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        win: {
          DEFAULT: '#00E676',
          light: '#69F0AE',
          dark: '#00C853',
          glow: 'rgba(0, 230, 118, 0.15)',
        },
        loss: {
          DEFAULT: '#FF1744',
          light: '#FF616F',
          dark: '#D50000',
          glow: 'rgba(255, 23, 68, 0.15)',
        },
        surface: {
          DEFAULT: 'rgba(15, 15, 15, 0.75)',
          hover: 'rgba(25, 25, 25, 0.8)',
          active: 'rgba(35, 35, 35, 0.85)',
          solid: '#111111',
        },
        border: {
          glass: 'rgba(255, 255, 255, 0.06)',
          'glass-hover': 'rgba(255, 255, 255, 0.12)',
          'glass-active': 'rgba(255, 255, 255, 0.18)',
        },
        text: {
          primary: '#FFFFFF',
          secondary: 'rgba(255, 255, 255, 0.6)',
          muted: 'rgba(255, 255, 255, 0.35)',
        },
      },
      backdropBlur: {
        glass: '20px',
        'glass-heavy': '40px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.4s ease-out',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

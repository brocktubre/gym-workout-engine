import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0a0a0a',
        'bg-card': '#1c1c1e',
        'bg-elevated': '#2c2c2e',
        'accent': '#FF375F',
        'accent-hover': '#E02D50',
        'success': '#30D158',
        'blue': '#0A84FF',
        'orange': '#FF9F0A',
        'purple': '#BF5AF2',
        'text-secondary': '#8E8E93',
        'border-default': '#38383A',
        'yellow': '#FFD60A',
        'cyan': '#5AC8FA',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-accent': 'linear-gradient(135deg, #FF375F 0%, #FF6B8A 100%)',
      },
    },
  },
  plugins: [],
};

export default config;

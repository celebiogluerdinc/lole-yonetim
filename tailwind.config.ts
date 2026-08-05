import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // iOS system palette (Apple Reminders look)
        ios: {
          blue: '#0A84FF',
          red: '#FF453A',
          orange: '#FF9F0A',
          green: '#30D158',
          indigo: '#5E5CE6',
          purple: '#BF5AF2',
          gray: '#8E8E93',
          bg: '#000000',
          fill: '#2C2C2E'
        },
        // Lole brand (logo & accents)
        brand: {
          50: '#fff8f1',
          100: '#feecdc',
          200: '#fcd9bd',
          300: '#fdba8c',
          400: '#ff8a4c',
          500: '#ff5a1f',
          600: '#d03801',
          700: '#b43403',
          800: '#8a2c0d',
          900: '#73230d'
        }
      },
      borderRadius: { '2xl': '1rem' }
    }
  },
  plugins: []
};
export default config;

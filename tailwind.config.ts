import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // iOS system palette (Apple Reminders look)
        ios: {
          blue: '#007AFF',
          red: '#FF3B30',
          orange: '#FF9500',
          green: '#34C759',
          indigo: '#5856D6',
          purple: '#AF52DE',
          gray: '#8E8E93',
          bg: '#F2F2F7',
          fill: '#E9E9EB'
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

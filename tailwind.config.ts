import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // iOS system palette (Apple Reminders look)
        // açık tema paleti (eski "ios-*" adları korunuyor ki
        // mevcut bileşenler olduğu gibi çalışsın)
        ios: {
          blue: '#0A6CFF',
          red: '#E5484D',
          orange: '#E8930C',
          green: '#12A150',
          indigo: '#5B54D6',
          purple: '#7C5CFC',
          gray: '#667085',
          bg: '#F4F6FA',
          fill: '#EEF1F6'
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

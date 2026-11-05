import type { Config } from 'tailwindcss';
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F7F8FA', surface: '#FFFFFF', ink: '#17212F', muted: '#526174', line: '#D9DFE7', brand: '#244B78',
        brandDark: '#1B3A5E', brandSoft: '#E8EEF6',
        ok: '#1F6B3F', okSoft: '#E4F3EA', warn: '#8A5A00', warnSoft: '#FFF3D6', bad: '#A12B2B', badSoft: '#FBE6E6',
      },
      fontFamily: { sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'] },
      borderRadius: { DEFAULT: '8px', lg: '12px' },
      spacing: { 18: '4.5rem' },
    },
  },
  plugins: [],
} satisfies Config;

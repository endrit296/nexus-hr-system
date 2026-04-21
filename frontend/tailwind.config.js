/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
        },
        dark: {
          700: '#1a2540',
          800: '#0f172a',
          900: '#0a1628',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs:   ['0.6875rem', { lineHeight: '1rem' }],
        sm:   ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem',  { lineHeight: '1.375rem' }],
        md:   ['0.9375rem', { lineHeight: '1.375rem' }],
        lg:   ['1.0625rem', { lineHeight: '1.5rem' }],
        xl:   ['1.25rem',   { lineHeight: '1.75rem' }],
        '2xl':['1.5rem',    { lineHeight: '2rem' }],
      },
      borderRadius: {
        sm:      '6px',
        DEFAULT: '8px',
        lg:      '12px',
        xl:      '14px',
        auth:    '18px',
      },
      boxShadow: {
        sm:    '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)',
        md:    '0 4px 12px rgba(0,0,0,0.10)',
        lg:    '0 8px 24px rgba(0,0,0,0.12)',
        xl:    '0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.08)',
        brand: '0 2px 6px rgba(37,99,235,0.35)',
        focus: '0 0 0 3px rgba(37,99,235,0.12)',
      },
    },
  },
  plugins: [],
};

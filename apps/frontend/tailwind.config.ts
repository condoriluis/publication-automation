import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/features/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background:     'var(--background)',
        foreground:     'var(--foreground)',
        card:           { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        border:         'var(--border)',
        input:          'var(--input)',
        ring:           'var(--ring)',
        primary:        { DEFAULT: 'var(--primary)',     foreground: 'var(--primary-foreground)' },
        secondary:      { DEFAULT: 'var(--secondary)',   foreground: 'var(--secondary-foreground)' },
        destructive:    { DEFAULT: 'var(--destructive)', foreground: 'var(--destructive-foreground)' },
        muted:          { DEFAULT: 'var(--muted)',        foreground: 'var(--muted-foreground)' },
        accent:         { DEFAULT: 'var(--accent)',       foreground: 'var(--accent-foreground)' },
        success:        'var(--success)',
        warning:        'var(--warning)',
        // Facebook / Meta brand
        'fb-blue':      '#1877F2',
        'fb-blue-dark': '#0A5BC4',
        'fb-blue-light':'#E7F3FF',
        'fb-gray':      '#F0F2F5',
        'fb-border':    '#E4E6EB',
        'fb-text':      '#050505',
        'fb-secondary': '#65676B',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'fade-up':      { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in':      { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'scale-in':     { '0%': { opacity: '0', transform: 'scale(.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'slide-in-left':{ '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(0)' } },
      },
      animation: {
        'fade-up':       'fade-up .35s ease forwards',
        'fade-in':       'fade-in .2s ease forwards',
        'scale-in':      'scale-in .15s ease forwards',
        'slide-in-left': 'slide-in-left .25s ease forwards',
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require('tailwindcss-animate')],
};

export default config;

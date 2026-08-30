import type { Config } from 'tailwindcss';

/**
 * Design tokens transcribed directly from ~/Documents/design/NexusKey/DESIGN.md
 * ("Obsidian Registry"). This is the single source of truth for color,
 * type, radius, and spacing across every page -- no page re-declares its
 * own palette the way the four prototype HTML files each did.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#121317',
        surface: '#121317',
        'surface-dim': '#121317',
        'surface-bright': '#38393e',
        'surface-container-lowest': '#0d0e12',
        'surface-container-low': '#1a1b20',
        'surface-container': '#1f1f24',
        'surface-container-high': '#292a2e',
        'surface-container-highest': '#343439',
        'surface-card': '#1F2833',
        'surface-variant': '#343439',
        'surface-tint': '#3cdcd1',
        'on-background': '#e3e2e8',
        'on-surface': '#e3e2e8',
        'on-surface-variant': '#bacac7',
        'inverse-surface': '#e3e2e8',
        'inverse-on-surface': '#2f3035',
        outline: '#859491',
        'outline-variant': '#3c4948',
        'border-subtle': 'rgba(197, 198, 199, 0.15)',
        primary: '#ffffff',
        'on-primary': '#003734',
        'primary-container': '#62f9ee',
        'on-primary-container': '#00716b',
        'inverse-primary': '#006a64',
        secondary: '#c5c6c7',
        'on-secondary': '#2e3132',
        'secondary-container': '#47494a',
        'on-secondary-container': '#b7b8b9',
        tertiary: '#ffffff',
        'on-tertiary': '#003735',
        'tertiary-container': '#98f2ed',
        'on-tertiary-container': '#00706d',
        error: '#ffb4ab',
        'on-error': '#690005',
        'error-container': '#93000a',
        'on-error-container': '#ffdad6',
        'status-verified': '#66FCF1',
        'status-warning': '#F1C40F',
        'status-error': '#E74C3C',
        'status-neutral': '#45A29E',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
      spacing: {
        unit: '8px',
        gutter: '24px',
        'margin-mobile': '16px',
        'margin-desktop': '64px',
      },
      maxWidth: {
        'container-max': '1280px',
      },
      fontFamily: {
        display: ['var(--font-hanken)', 'sans-serif'],
        'headline-lg': ['var(--font-hanken)', 'sans-serif'],
        'headline-md': ['var(--font-hanken)', 'sans-serif'],
        'body-lg': ['var(--font-inter)', 'sans-serif'],
        'body-md': ['var(--font-inter)', 'sans-serif'],
        'body-sm': ['var(--font-inter)', 'sans-serif'],
        'label-caps': ['var(--font-mono)', 'monospace'],
        'mono-data': ['var(--font-mono)', 'monospace'],
      },
      fontSize: {
        'body-sm': ['12px', { lineHeight: '18px', fontWeight: '400' }],
        'headline-md': ['24px', { lineHeight: '32px', fontWeight: '500' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '500' }],
        'mono-data': ['13px', { lineHeight: '20px', fontWeight: '400' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'label-caps': ['11px', { lineHeight: '16px', letterSpacing: '0.08em', fontWeight: '600' }],
        display: ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
      },
    },
  },
  plugins: [],
};

export default config;

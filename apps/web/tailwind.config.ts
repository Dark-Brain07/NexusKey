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
        background: '#e0bbf4',
        surface: '#ffffff',
        'surface-dim': '#fff0f8',
        'surface-bright': '#ffffff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#fff5fa',
        'surface-container': '#ffebf6',
        'surface-container-high': '#ffe0f2',
        'surface-container-highest': '#ffd6ef',
        'surface-card': '#ffffff',
        'surface-variant': '#ffccf9',
        'surface-tint': '#ffb8e0',
        'on-background': '#1a1a1a',
        'on-surface': '#1a1a1a',
        'on-surface-variant': '#333333',
        'inverse-surface': '#1a1a1a',
        'inverse-on-surface': '#ffffff',
        outline: '#1a1a1a',
        'outline-variant': '#cccccc',
        'border-subtle': 'rgba(26, 26, 26, 0.15)',
        primary: '#ffb8e0',
        'on-primary': '#1a1a1a',
        'primary-container': '#ffccf9',
        'on-primary-container': '#1a1a1a',
        'inverse-primary': '#ffa3d6',
        secondary: '#8be9fd',
        'on-secondary': '#1a1a1a',
        'secondary-container': '#bce6ff',
        'on-secondary-container': '#1a1a1a',
        tertiary: '#fff69b',
        'on-tertiary': '#1a1a1a',
        'tertiary-container': '#fffbc2',
        'on-tertiary-container': '#1a1a1a',
        error: '#ff8585',
        'on-error': '#1a1a1a',
        'error-container': '#ffb5b5',
        'on-error-container': '#1a1a1a',
        'status-verified': '#c3f0ca',
        'status-warning': '#fff69b',
        'status-error': '#ff8585',
        'status-neutral': '#e0bbf4',
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

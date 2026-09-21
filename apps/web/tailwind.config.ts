import type { Config } from 'tailwindcss';

/**
 * Every value here reads from a CSS variable emitted by
 * `brandCssVariables()` in @classpilot/shared. Nothing is a literal, so the
 * brand config stays the single source of truth and a token change
 * propagates everywhere without a find-and-replace.
 */
export default {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        // Small phones (iPhone SE class) need one step below Tailwind's `sm`.
        xs: '400px',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // --- existing semantic tokens: unchanged, the workspace depends on them
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        primary: 'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        secondary: 'hsl(var(--secondary))',
        'secondary-foreground': 'hsl(var(--secondary-foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        accent: 'hsl(var(--accent))',
        'accent-foreground': 'hsl(var(--accent-foreground))',
        destructive: 'hsl(var(--destructive))',
        'destructive-foreground': 'hsl(var(--destructive-foreground))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',

        // --- depth palette: marketing and auth surfaces
        depth: {
          base: 'var(--depth-base)',
          raised: 'var(--depth-raised)',
          panel: 'var(--depth-panel)',
          ink: 'var(--depth-ink)',
          muted: 'var(--depth-mutedInk)',
          line: 'var(--depth-line)',
          'line-strong': 'var(--depth-lineStrong)',
          glow: 'var(--depth-glow)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      boxShadow: {
        low: 'var(--shadow-low)',
        mid: 'var(--shadow-mid)',
        high: 'var(--shadow-high)',
        glow: 'var(--shadow-glow)',
      },
      backdropBlur: {
        glass: 'var(--glass-blur)',
      },
      transitionDuration: {
        instant: 'var(--duration-instant)',
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
        deliberate: 'var(--duration-deliberate)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        'in-out': 'var(--ease-inOut)',
        spring: 'var(--ease-spring)',
      },
      keyframes: {
        // Entrances. Transform + opacity only, so these stay on the
        // compositor and never trigger layout.
        'rise-in': {
          from: { opacity: '0', transform: 'translate3d(0, 14px, 0)' },
          to: { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale3d(0.96, 0.96, 1)' },
          to: { opacity: '1', transform: 'scale3d(1, 1, 1)' },
        },
        // The hero: a packet travelling along a connector path.
        'travel': {
          '0%': { opacity: '0', offsetDistance: '0%' },
          '12%': { opacity: '1' },
          '88%': { opacity: '1' },
          '100%': { opacity: '0', offsetDistance: '100%' },
        },
        // The Coursen mark drawing itself.
        'trace': {
          from: { strokeDashoffset: 'var(--trace-length)' },
          to: { strokeDashoffset: '0' },
        },
        // A slow, barely-there drift for ambient background layers.
        'drift': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%': { transform: 'translate3d(0, -12px, 0) scale(1.03)' },
        },
        // Loading shimmer for skeletons.
        'shimmer': {
          from: { transform: 'translate3d(-100%, 0, 0)' },
          to: { transform: 'translate3d(100%, 0, 0)' },
        },
        // A single soft pulse on the mark when a sync lands.
        'pulse-ring': {
          '0%': { opacity: '0.5', transform: 'scale(0.9)' },
          '70%': { opacity: '0', transform: 'scale(1.6)' },
          '100%': { opacity: '0', transform: 'scale(1.6)' },
        },
      },
      animation: {
        'rise-in': 'rise-in var(--duration-slow) var(--ease-out) both',
        'fade-in': 'fade-in var(--duration-base) var(--ease-out) both',
        'scale-in': 'scale-in var(--duration-base) var(--ease-out) both',
        drift: 'drift 14s var(--ease-inOut) infinite',
        shimmer: 'shimmer 1.6s var(--ease-inOut) infinite',
        'pulse-ring': 'pulse-ring 2.4s var(--ease-out) infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;

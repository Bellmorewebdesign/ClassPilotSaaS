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

      /**
       * The V2 type roles. Components choose a ROLE (`text-h2`), never a size,
       * so the hierarchy stays consistent and a scale revision is a one-file
       * change. Mobile steps are applied by a media query in globals.css.
       */
      fontSize: {
        display: [
          'var(--text-display)',
          { lineHeight: 'var(--leading-display)', letterSpacing: 'var(--tracking-display)', fontWeight: 'var(--weight-display)' },
        ],
        h1: [
          'var(--text-h1)',
          { lineHeight: 'var(--leading-h1)', letterSpacing: 'var(--tracking-h1)', fontWeight: 'var(--weight-h1)' },
        ],
        h2: [
          'var(--text-h2)',
          { lineHeight: 'var(--leading-h2)', letterSpacing: 'var(--tracking-h2)', fontWeight: 'var(--weight-h2)' },
        ],
        h3: [
          'var(--text-h3)',
          { lineHeight: 'var(--leading-h3)', letterSpacing: 'var(--tracking-h3)', fontWeight: 'var(--weight-h3)' },
        ],
        body: ['var(--text-body)', { lineHeight: 'var(--leading-body)' }],
        'small-body': ['var(--text-smallBody)', { lineHeight: 'var(--leading-smallBody)' }],
        label: [
          'var(--text-label)',
          { lineHeight: 'var(--leading-label)', fontWeight: 'var(--weight-label)' },
        ],
        button: [
          'var(--text-button)',
          { lineHeight: 'var(--leading-button)', fontWeight: 'var(--weight-button)' },
        ],
        metadata: [
          'var(--text-metadata)',
          { lineHeight: 'var(--leading-metadata)', letterSpacing: 'var(--tracking-metadata)', fontWeight: 'var(--weight-metadata)' },
        ],
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
        // The dark brand surface. Not a second palette: `base` is Main ink
        // and `accent` is Signature sky, exactly as the kit's dark reveal.
        depth: {
          base: 'var(--depth-base)',
          sunken: 'var(--depth-sunken)',
          raised: 'var(--depth-raised)',
          ink: 'var(--depth-ink)',
          muted: 'var(--depth-mutedInk)',
          accent: 'var(--depth-accent)',
          line: 'var(--depth-line)',
          'line-strong': 'var(--depth-lineStrong)',
        },

        // V2 roles that have no Tailwind semantic equivalent.
        neutral: 'var(--brand-neutral)',
        'action-hover': 'var(--brand-actionHover)',
        sky: 'var(--brand-sky)',
        success: 'var(--brand-success)',
        'success-surface': 'var(--brand-successSurface)',
        warning: 'var(--brand-warning)',
        'warning-surface': 'var(--brand-warningSurface)',
        'error-text': 'var(--brand-error)',
        'error-surface': 'var(--brand-errorSurface)',
        disabled: 'var(--brand-disabled)',
        'disabled-fill': 'var(--brand-disabledFill)',
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
        curve: 'var(--duration-curve)',
      },
      transitionTimingFunction: {
        // The kit's reveal keySplines. There is deliberately no spring: V2
        // motion is "smooth, brief, and easy to ignore" (guide page 33).
        out: 'var(--ease-out)',
        'in-out': 'var(--ease-inOut)',
      },
      /*
       * Keyframes live in app/globals.css, not here.
       *
       * Tailwind only emits a theme keyframe when a matching `animate-*`
       * utility is generated. Several of these are driven by hand-written
       * component classes (.mark-curve, .activity-sweep, the ambient washes)
       * that Tailwind never sees, so declaring them here left those
       * animations referencing keyframes that were never shipped - the logo
       * reveal silently stayed at opacity 0. Defining them in the stylesheet
       * emits them unconditionally; the `animation` utilities below still
       * resolve to them by name.
       */
      animation: {
        'rise-in': 'rise-in var(--duration-slow) var(--ease-out) both',
        'fade-in': 'fade-in var(--duration-base) var(--ease-out) both',
        'scale-in': 'scale-in var(--duration-base) var(--ease-out) both',
        drift: 'drift 18s var(--ease-inOut) infinite',
        shimmer: 'shimmer 1.6s var(--ease-inOut) infinite',
        'activity-sweep': 'activity-sweep var(--duration-loop) linear infinite',
        'activity-dot': 'activity-dot var(--duration-loop) var(--ease-inOut) infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;

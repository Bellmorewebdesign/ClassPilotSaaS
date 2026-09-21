/**
 * Public identity only. Do not use these names as storage keys, package names,
 * API routes, or hosts. domainStyleName is display text, never a destination.
 */
export const brand = {
  name: 'Coursen AI',
  shortName: 'Coursen',
  domainStyleName: 'Coursen.ai',
  extensionName: 'Coursen Sync',
  tagline: 'Your classes. One intelligent workspace.',
  description:
    'Your Google Classroom classes and assignments, organized in one clear workspace.',
  extensionDescription:
    'Bring your Google Classroom classes and assignments into Coursen AI from your own signed-in browser session.',
  assistantTitle: 'Ask Coursen',
  assistantPlaceholder: 'Ask about your classes, assignments, or schedule…',
  colors: {
    sky: '#9FC7F3',
    pale: '#EAF3FE',
    action: '#32659C',
    ink: '#31445A',
    background: '#F7F9FC',
    surface: '#FFFFFF',
    muted: '#5D6D80',
    border: '#DCE4ED',
    input: '#7A8A9C',
    success: '#287354',
    successSurface: '#E8F5ED',
    warning: '#94601B',
    warningSurface: '#FFF3D9',
    error: '#AD444E',
    errorSurface: '#FCECEF',
  },
  mark: { path: 'M45 17 A21 21 0 1 0 45 47', dotX: 48, dotY: 32 },
} as const;

/**
 * Depth palette.
 *
 * The marketing surface is darker than the workspace on purpose: it lets the
 * product preview glow against it the way a device screen does in a photo,
 * and it draws a clear line between "this is the pitch" and "this is your
 * data". These are separate from `brand.colors` because the workspace must
 * stay light, calm and high-contrast for long reading sessions.
 */
export const depth = {
  /** Base canvas for marketing and auth surfaces. */
  base: '#0B1220',
  /** One step up - section bands. */
  raised: '#111B2D',
  /** Panel fill behind glass layers. */
  panel: '#16233A',
  /** Text on dark surfaces. */
  ink: '#EAF1FA',
  /** Secondary text on dark surfaces. Contrast ratio 7.0:1 on `base`. */
  mutedInk: '#9FB2C9',
  /** Hairline borders on dark surfaces. */
  line: 'rgba(159, 199, 243, 0.14)',
  /** Brighter hairline for hovered/active glass. */
  lineStrong: 'rgba(159, 199, 243, 0.28)',
  /** The accent that reads as "Coursen" on dark. */
  glow: '#7FB2F0',
} as const;

/**
 * Motion tokens.
 *
 * One vocabulary for every transition in the product, so a hover in the
 * marketing nav and a card entering the dashboard feel like the same hand
 * made them. Durations are deliberately short - premium motion is quick and
 * confident, not slow and showy.
 */
export const motion = {
  duration: {
    /** Hover, focus, colour changes. */
    instant: '120ms',
    /** Buttons, small state changes. */
    fast: '200ms',
    /** Cards entering, panels opening. */
    base: '320ms',
    /** Large surfaces, page entrances. */
    slow: '520ms',
    /** Hero choreography beats. */
    deliberate: '800ms',
  },
  easing: {
    /** Default. Decelerating - things arrive and settle. */
    out: 'cubic-bezier(0.22, 1, 0.36, 1)',
    /** Symmetric, for things that move between two states. */
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    /** A restrained overshoot. Used sparingly, never on text. */
    spring: 'cubic-bezier(0.34, 1.28, 0.64, 1)',
  },
} as const;

/**
 * Surface tokens - the "liquid glass" layer, kept deliberately restrained.
 *
 * The rule this encodes: glass is a LAYER, never a background for body text.
 * Blur stays low enough that text over it remains legible, and every glass
 * surface carries its own opaque-enough fill rather than relying on whatever
 * happens to be behind it.
 */
export const surface = {
  /** Frosted panel on a dark backdrop. */
  glassDark: 'rgba(22, 35, 58, 0.72)',
  /** Frosted panel on a light backdrop. */
  glassLight: 'rgba(255, 255, 255, 0.72)',
  /** Backdrop blur radius. Low on purpose - heavy blur is expensive and muddy. */
  blur: '18px',
  /** The top highlight that suggests a refractive edge. */
  sheen: 'rgba(255, 255, 255, 0.10)',
  radius: {
    sm: '0.625rem',
    md: '0.875rem',
    lg: '1.125rem',
    xl: '1.5rem',
    '2xl': '1.875rem',
  },
  shadow: {
    /** Resting card. Barely there. */
    low: '0 1px 2px rgba(15, 28, 48, 0.06), 0 1px 3px rgba(15, 28, 48, 0.04)',
    /** Hovered card / raised panel. */
    mid: '0 4px 12px rgba(15, 28, 48, 0.08), 0 12px 32px rgba(15, 28, 48, 0.06)',
    /** Floating product preview. */
    high: '0 24px 64px rgba(6, 16, 34, 0.22), 0 2px 8px rgba(6, 16, 34, 0.12)',
    /** Accent glow behind the mark. Never on text. */
    glow: '0 0 48px rgba(127, 178, 240, 0.28)',
  },
} as const;

function hsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  let hue = 0;
  if (delta) {
    hue =
      max === r
        ? ((g - b) / delta) % 6
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4;
  }
  return `${((hue * 60 + 360) % 360).toFixed(2)} ${(s * 100).toFixed(2)}% ${(l * 100).toFixed(2)}%`;
}

/** Shared by Tailwind's existing semantic tokens and the extension CSS. */
export function brandCssVariables(): Record<string, string> {
  const c = brand.colors;
  const semantic = {
    background: c.background,
    foreground: c.ink,
    card: c.surface,
    'card-foreground': c.ink,
    primary: c.action,
    'primary-foreground': c.surface,
    secondary: c.pale,
    'secondary-foreground': c.action,
    muted: c.background,
    'muted-foreground': c.muted,
    accent: c.action,
    'accent-foreground': c.surface,
    destructive: c.error,
    'destructive-foreground': c.surface,
    border: c.border,
    input: c.input,
    ring: c.action,
  };
  const flatten = (prefix: string, group: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(group).map(([key, value]) => [`--${prefix}-${key}`, value]),
    );

  return {
    ...Object.fromEntries(
      Object.entries(semantic).map(([key, color]) => [`--${key}`, hsl(color)]),
    ),
    ...Object.fromEntries(
      Object.entries(c).map(([key, color]) => [`--brand-${key}`, color]),
    ),
    ...flatten('depth', depth),
    ...flatten('duration', motion.duration),
    ...flatten('ease', motion.easing),
    ...flatten('radius', surface.radius),
    ...flatten('shadow', surface.shadow),
    '--glass-dark': surface.glassDark,
    '--glass-light': surface.glassLight,
    '--glass-blur': surface.blur,
    '--glass-sheen': surface.sheen,
    '--radius': '1rem',
  };
}

/** Build-time markup; escapes future names instead of injecting raw HTML. */
export function brandMarkup(template: string): string {
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (char) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[char]!,
    );
  return template.replace(/\{\{brand\.(\w+)\}\}/g, (_, key: string) => {
    const value = brand[key as keyof typeof brand];
    if (typeof value !== 'string')
      throw new Error(`Unknown brand template field: ${key}`);
    return escape(value);
  });
}

export function brandMarkSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="${brand.mark.path}" fill="none" stroke="${brand.colors.action}" stroke-width="8" stroke-linecap="round"/><circle cx="${brand.mark.dotX}" cy="${brand.mark.dotY}" r="4" fill="${brand.colors.action}"/></svg>`;
}

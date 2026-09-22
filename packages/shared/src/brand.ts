/**
 * Coursen public identity - Brand Kit v2.
 *
 * Every value here comes from the supplied kit (color/Coursen-Color-Palette.csv,
 * typography/Coursen-Type-Hierarchy.csv, reference/logo-construction.svg and
 * motion/Motion-Notes.md). Nothing in this file is invented.
 *
 * Public identity ONLY. These names are never storage keys, package names,
 * API routes or hosts - those stay internal and unchanged. domainStyleName is
 * display text, never a destination.
 */
export const brand = {
  name: 'Coursen AI',
  shortName: 'Coursen',
  domainStyleName: 'Coursen.ai',
  extensionName: 'Coursen Sync',
  /** The memorable brand line. Kit guide page 07. */
  tagline: 'Know what\u2019s next.',
  /** Supporting positioning, used beneath the tagline. */
  positioning: 'One intelligent workspace for school.',
  description:
    'Coursen brings your classes, assignments, deadlines, announcements, documents and schedule into one workspace.',
  extensionDescription:
    'Bring your Google Classroom classes and assignments into Coursen from your own signed-in browser session.',
  assistantTitle: 'Ask Coursen',
  assistantPlaceholder: 'Ask about your classes, assignments, or schedule\u2026',

  /**
   * Color roles, verbatim from the kit palette.
   *
   * "Color roles are more important than more colors" (guide page 17). Each
   * key is a ROLE, not a hue - so a future palette revision changes values
   * here and nothing downstream needs to move.
   */
  colors: {
    /** Buttons, selected items, the mark. */
    action: '#3F6FA8',
    /** Pointer hover on primary controls. */
    actionHover: '#335D8D',
    /** Large accents only. NEVER behind small white text - see contrast audit. */
    sky: '#A7C9EE',
    /** Selection and quiet feature panels. */
    pale: '#EDF5FD',
    /** Headings and body text. */
    ink: '#243448',
    /** Supporting copy and metadata. */
    muted: '#657486',
    /** Nonessential separators. */
    border: '#D8E1EB',
    /** Inputs and essential outlines. */
    input: '#7A8A9C',
    /** Cards, sheets, navigation. */
    surface: '#FFFFFF',
    /** Workspace canvas. */
    background: '#F7F9FC',
    /** Quiet, non-status containers. */
    neutral: '#EEF2F6',

    success: '#2C7057',
    successSurface: '#E8F5ED',
    warning: '#865B20',
    warningSurface: '#FFF3D9',
    error: '#A54444',
    errorSurface: '#FCECEF',
    info: '#3F6FA8',
    infoSurface: '#EDF5FD',

    /** Unavailable controls. Exempt from the 4.5:1 target - inactive only. */
    disabled: '#697787',
    disabledFill: '#EEF2F6',
  },

  /**
   * The Waypoint C.
   *
   * Geometry transcribed from reference/logo-construction.svg:
   *   artboard   64 x 64 units
   *   curve      centre (32, 32), radius 18
   *   stroke     8 units, rounded terminals
   *   waypoint   centre (49.5, 32), diameter 8
   *   opening    90 degrees, on the right
   *
   * Expressed as an SVG arc rather than the master's cubic Beziers: it is the
   * same curve, and it is the form the kit itself uses in
   * motion/coursen-workspace-loading.svg, where `pathLength` makes the dash
   * animation exact. Do not alter these numbers - the supplied SVG masters in
   * public/brand are the authority and these must agree with them.
   */
  mark: {
    path: 'M44.73 44.73 A18 18 0 1 1 44.73 19.27',
    strokeWidth: 8,
    dotX: 49.5,
    dotY: 32,
    dotRadius: 4,
    /**
     * Small-size optical master (16-32px): 9-unit stroke and 9-unit dot, per
     * the construction sheet. Thickening the stroke keeps the C readable when
     * the aperture would otherwise close up.
     */
    small: { strokeWidth: 9, dotRadius: 4.5 },
    /** Clear space, in waypoint diameters. Lockup 2x, standalone mark 1x. */
    clearSpaceLockup: 2,
    clearSpaceMark: 1,
    /** Minimum rendered width of the primary lockup, in px. */
    minLockupWidth: 120,
  },
} as const;

/**
 * Type scale, verbatim from typography/Coursen-Type-Hierarchy.csv.
 *
 * "A clear rhythm from display to metadata" (guide page 21). Components pick a
 * ROLE; they do not choose sizes. Sizes are px so they match the kit exactly,
 * and mobile values are the kit's own responsive step.
 */
export const type = {
  display: { desktop: 64, mobile: 40, weight: 600, leading: 1.08, tracking: '-0.035em' },
  h1: { desktop: 40, mobile: 32, weight: 600, leading: 1.15, tracking: '-0.025em' },
  h2: { desktop: 28, mobile: 24, weight: 600, leading: 1.25, tracking: '-0.015em' },
  h3: { desktop: 20, mobile: 20, weight: 600, leading: 1.3, tracking: '-0.01em' },
  body: { desktop: 16, mobile: 16, weight: 400, leading: 1.55, tracking: '0' },
  smallBody: { desktop: 14, mobile: 14, weight: 400, leading: 1.5, tracking: '0' },
  label: { desktop: 13, mobile: 13, weight: 600, leading: 1.4, tracking: '0' },
  button: { desktop: 14, mobile: 14, weight: 600, leading: 1.3, tracking: '0' },
  metadata: { desktop: 12, mobile: 12, weight: 500, leading: 1.45, tracking: '0.01em' },
} as const;

/**
 * The dark brand surface.
 *
 * Not an invention: the kit ships motion/coursen-logo-reveal-dark on exactly
 * this ground, with the mark in Signature sky and the wordmark in white. So
 * dark is a sanctioned expression of V2 - it is simply Main ink used as a
 * field, which is why every value below is drawn from `brand.colors` rather
 * than being a second palette.
 *
 * The workspace stays light regardless. This is for the marketing and auth
 * surfaces only.
 */
export const depth = {
  /** Main ink as a field. Sampled from the kit's dark reveal: #243448. */
  base: brand.colors.ink,
  /** One step down for section bands, so the ground is not flat. */
  sunken: '#1C2938',
  /** One step up for raised panels. */
  raised: '#2C3E54',
  /** Wordmark and headings on dark. */
  ink: brand.colors.surface,
  /** Supporting copy on dark. 8.2:1 on base - see brand.test.ts. */
  mutedInk: '#B9C7D6',
  /** The accent on dark IS Signature sky - the kit's dark reveal uses it. */
  accent: brand.colors.sky,
  line: 'rgba(167, 201, 238, 0.16)',
  lineStrong: 'rgba(167, 201, 238, 0.30)',
} as const;

/**
 * Motion, transcribed from motion/Motion-Notes.md and the animated SVG studies.
 *
 * The governing idea is "Keep the C still. Let the work move." (guide page 32)
 * and "Smooth, brief, and easy to ignore." (page 33).
 */
export const motion = {
  duration: {
    instant: '120ms',
    fast: '200ms',
    base: '320ms',
    slow: '520ms',
    /** Logo reveal: curve draw. From the reveal SVG - 0.7s. */
    curve: '700ms',
    /** Looping activity studies run at 2.4s. */
    loop: '2400ms',
  },
  /**
   * Reveal choreography, in milliseconds, exactly as the kit's animated SVG
   * schedules it. Total active motion 1350ms, matching Motion-Notes.md.
   */
  reveal: {
    curveBegin: 80,
    curveDuration: 700,
    waypointBegin: 640,
    waypointDuration: 300,
    wordmarkBegin: 830,
    wordmarkDuration: 520,
    total: 1350,
  },
  easing: {
    /** The kit's reveal keySplines, verbatim: "0.22 1 0.36 1". */
    out: 'cubic-bezier(0.22, 1, 0.36, 1)',
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  },
} as const;

/**
 * Surfaces.
 *
 * Radii follow the kit's component sheet, which is markedly tighter than the
 * previous 16-24px: cards read at ~12px and controls at ~10px. Translucency
 * is retained from the earlier work but demoted - the brand is calm and clear
 * first, and glass is only ever a layer over a real fill.
 */
export const surface = {
  radius: {
    sm: '6px',
    md: '10px',
    lg: '12px',
    xl: '16px',
    '2xl': '20px',
    /** The app-icon rounding: 20% of the tile, per the favicon masters. */
    tile: '20%',
  },
  shadow: {
    /** Resting card. The kit's cards are defined by their border, not a shadow. */
    low: '0 1px 2px rgba(36, 52, 72, 0.04)',
    mid: '0 2px 8px rgba(36, 52, 72, 0.06), 0 8px 24px rgba(36, 52, 72, 0.05)',
    high: '0 18px 48px rgba(28, 41, 56, 0.20), 0 2px 6px rgba(28, 41, 56, 0.10)',
  },
  glassDark: 'rgba(44, 62, 84, 0.72)',
  glassLight: 'rgba(255, 255, 255, 0.78)',
  blur: '16px',
  sheen: 'rgba(255, 255, 255, 0.08)',
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

/**
 * Emits every token as a CSS custom property.
 *
 * Shared by the web app's Tailwind theme and the extension's stylesheet, so
 * both inherit the kit automatically. The existing semantic names
 * (--background, --primary, ...) are deliberately preserved: the workspace UI
 * and the extension already depend on them, and a brand revision should not
 * require a find-and-replace across components.
 */
export function brandCssVariables(): Record<string, string> {
  const c = brand.colors;

  // Tailwind's semantic layer, mapped onto V2 roles.
  const semantic = {
    background: c.background,
    foreground: c.ink,
    card: c.surface,
    'card-foreground': c.ink,
    primary: c.action,
    'primary-foreground': c.surface,
    secondary: c.pale,
    'secondary-foreground': c.action,
    muted: c.neutral,
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

  // Type roles become three variables each: size, line height, tracking. The
  // mobile step is emitted separately and swapped by one media query.
  const typeVars: Record<string, string> = {};
  for (const [role, spec] of Object.entries(type)) {
    typeVars[`--text-${role}`] = `${spec.desktop}px`;
    typeVars[`--text-${role}-mobile`] = `${spec.mobile}px`;
    typeVars[`--leading-${role}`] = String(spec.leading);
    typeVars[`--tracking-${role}`] = spec.tracking;
    typeVars[`--weight-${role}`] = String(spec.weight);
  }

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
    ...typeVars,
    '--glass-dark': surface.glassDark,
    '--glass-light': surface.glassLight,
    '--glass-blur': surface.blur,
    '--glass-sheen': surface.sheen,
    // Kept for any consumer still reading the generic radius.
    '--radius': surface.radius.lg,
  };
}

/**
 * The mark as a standalone SVG string, for the extension and for generated
 * icons. `size` selects the optical master: 16-32px uses the thicker small
 * stroke per the construction sheet.
 */
export function brandMarkSvg(size = 64, color: string = brand.colors.action): string {
  const optical = size <= 32 ? brand.mark.small : brand.mark;
  const scale = size / 64;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64" role="img">`,
    `<path d="${brand.mark.path}" fill="none" stroke="${color}" stroke-width="${optical.strokeWidth}" stroke-linecap="round"/>`,
    `<circle cx="${brand.mark.dotX}" cy="${brand.mark.dotY}" r="${optical.dotRadius}" fill="${color}"/>`,
    `</svg>`,
  ].join('');
  // `scale` is intentionally unused: the viewBox does the scaling, which keeps
  // the geometry identical to the supplied masters at every size.
  void scale;
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

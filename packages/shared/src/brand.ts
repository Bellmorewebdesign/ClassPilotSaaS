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
  return {
    ...Object.fromEntries(
      Object.entries(semantic).map(([key, color]) => [`--${key}`, hsl(color)]),
    ),
    ...Object.fromEntries(
      Object.entries(c).map(([key, color]) => [`--brand-${key}`, color]),
    ),
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

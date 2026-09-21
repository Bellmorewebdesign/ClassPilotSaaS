import { describe, expect, it } from 'vitest';
import {
  brand,
  brandCssVariables,
  brandMarkup,
  brandMarkSvg,
  depth,
  motion,
  surface,
} from './brand.js';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

describe('public brand contract', () => {
  it('resolves public markup and rejects misspelled or non-text fields', () => {
    expect(brandMarkup('<title>{{brand.extensionName}}</title>')).toBe(
      `<title>${brand.extensionName}</title>`,
    );
    expect(() => brandMarkup('{{brand.missing}}')).toThrow(
      'Unknown brand template field',
    );
    expect(() => brandMarkup('{{brand.colors}}')).toThrow(
      'Unknown brand template field',
    );
    expect(brand.domainStyleName).not.toMatch(/^https?:/);
  });

  it('keeps normal text contrast at WCAG AA across shared semantic colors', () => {
    const c = brand.colors;
    for (const [foreground, background] of [
      [c.ink, c.background],
      [c.muted, c.background],
      [c.action, c.pale],
      [c.surface, c.action],
      [c.surface, c.error],
      [c.success, c.successSurface],
      [c.warning, c.warningSurface],
      [c.error, c.errorSurface],
    ]) {
      const values = [luminance(foreground!), luminance(background!)].sort(
        (a, b) => b - a,
      );
      expect(
        (values[0]! + 0.05) / (values[1]! + 0.05),
        `${foreground} on ${background}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('exposes both existing Tailwind tokens and extension color variables', () => {
    const variables = brandCssVariables();
    expect(variables['--brand-action']).toBe(brand.colors.action);
    expect(variables['--primary']).toMatch(/^\d+\.\d+ \d+\.\d+% \d+\.\d+%$/);
    expect(variables['--primary-foreground']).toBe('0.00 0.00% 100.00%');
  });
});

describe('brand mark geometry', () => {
  it('pins the mark path, because the trace animation hardcodes its length', () => {
    // apps/web/app/globals.css sets --trace-length: 99, the measured length of
    // this arc (268.83deg at r=21 = 98.53 units). If the mark changes shape,
    // that value must be recomputed or the draw-on animation breaks.
    expect(brand.mark.path).toBe('M45 17 A21 21 0 1 0 45 47');
    expect(brand.mark).toMatchObject({ dotX: 48, dotY: 32 });
  });

  it('renders a standalone SVG for the extension and favicons', () => {
    const svg = brandMarkSvg();
    expect(svg).toContain(brand.mark.path);
    expect(svg).toContain(brand.colors.action);
  });
});

describe('design tokens', () => {
  it('exposes depth, motion and surface tokens as CSS variables', () => {
    const vars = brandCssVariables();
    expect(vars['--depth-base']).toBe(depth.base);
    expect(vars['--duration-base']).toBe(motion.duration.base);
    expect(vars['--ease-out']).toBe(motion.easing.out);
    expect(vars['--radius-xl']).toBe(surface.radius.xl);
    expect(vars['--shadow-high']).toBe(surface.shadow.high);
    expect(vars['--glass-blur']).toBe(surface.blur);
  });

  it('keeps the original semantic tokens intact', () => {
    // The workspace UI and the extension both depend on these names; adding
    // depth tokens must not disturb them.
    const vars = brandCssVariables();
    for (const key of ['--background', '--foreground', '--primary', '--border', '--radius']) {
      expect(vars[key]).toBeDefined();
    }
    expect(vars['--brand-action']).toBe(brand.colors.action);
  });

  it('uses only transform/opacity-friendly durations under a second', () => {
    // Premium motion is quick. Anything over a second reads as sluggish.
    for (const value of Object.values(motion.duration)) {
      expect(Number.parseInt(value, 10)).toBeLessThanOrEqual(800);
    }
  });

  it('keeps dark-surface body text comfortably readable', () => {
    // WCAG AA for body text is 4.5:1; AAA is 7:1. mutedInk is used for
    // supporting copy on the marketing surface, so it must clear AA well.
    expect(contrastRatio(depth.mutedInk, depth.base)).toBeGreaterThan(7);
    expect(contrastRatio(depth.ink, depth.base)).toBeGreaterThan(14);
  });

  it('keeps the accent readable on the dark surface for large text', () => {
    expect(contrastRatio(depth.glow, depth.base)).toBeGreaterThan(4.5);
  });
});
/** WCAG 2.1 contrast ratio, built on the luminance helper above. */
function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

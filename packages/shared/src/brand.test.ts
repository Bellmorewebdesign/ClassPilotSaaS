import { describe, expect, it } from 'vitest';
import {
  brand,
  brandCssVariables,
  brandMarkup,
  brandMarkSvg,
  type,
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

describe('Waypoint C geometry (Brand Kit v2)', () => {
  it('matches the construction sheet exactly', () => {
    // reference/logo-construction.svg: 64x64 artboard, curve centre (32,32),
    // radius 18, stroke 8 with rounded terminals, waypoint (49.5, 32)
    // diameter 8, 90-degree opening on the right.
    expect(brand.mark.path).toBe('M44.73 44.73 A18 18 0 1 1 44.73 19.27');
    expect(brand.mark.strokeWidth).toBe(8);
    expect(brand.mark.dotX).toBe(49.5);
    expect(brand.mark.dotY).toBe(32);
    expect(brand.mark.dotRadius).toBe(4);
  });

  it('describes a radius-18 arc centred on the artboard', () => {
    // Guards the transcription: both endpoints must sit 18 units from (32,32).
    // "M44.73 44.73 A18 18 0 1 1 44.73 19.27" -> the arc's start point is the
    // first pair and its end point is the last.
    const [x1, y1, , , , , , x2, y2] = brand.mark.path
      .split(/[\sA-Za-z]+/)
      .filter(Boolean)
      .map(Number);
    for (const [x, y] of [
      [x1, y1],
      [x2, y2],
    ] as const) {
      expect(Math.hypot(x - 32, y - 32)).toBeCloseTo(18, 1);
    }
  });

  it('carries the small-size optical master for 16-32px', () => {
    // A thinner stroke closes the aperture at small sizes, so the kit
    // specifies 9-unit stroke and 9-unit dot below 32px.
    expect(brand.mark.small.strokeWidth).toBe(9);
    expect(brand.mark.small.dotRadius).toBe(4.5);
  });

  it('applies the optical master only at small sizes', () => {
    expect(brandMarkSvg(64)).toContain('stroke-width="8"');
    expect(brandMarkSvg(32)).toContain('stroke-width="9"');
    expect(brandMarkSvg(16)).toContain('stroke-width="9"');
  });

  it('never omits the waypoint - removing it is documented misuse', () => {
    for (const size of [16, 24, 32, 48, 64, 128]) {
      expect(brandMarkSvg(size)).toContain('<circle');
    }
  });

  it('records the clear-space and minimum-size rules', () => {
    expect(brand.mark.clearSpaceLockup).toBe(2);
    expect(brand.mark.clearSpaceMark).toBe(1);
    expect(brand.mark.minLockupWidth).toBe(120);
  });
});

describe('Brand Kit v2 palette', () => {
  it('matches color/Coursen-Color-Palette.csv role for role', () => {
    expect(brand.colors).toMatchObject({
      action: '#3F6FA8',
      actionHover: '#335D8D',
      sky: '#A7C9EE',
      pale: '#EDF5FD',
      ink: '#243448',
      muted: '#657486',
      border: '#D8E1EB',
      input: '#7A8A9C',
      surface: '#FFFFFF',
      background: '#F7F9FC',
      neutral: '#EEF2F6',
      success: '#2C7057',
      successSurface: '#E8F5ED',
      warning: '#865B20',
      warningSurface: '#FFF3D9',
      error: '#A54444',
      errorSurface: '#FCECEF',
      info: '#3F6FA8',
      infoSurface: '#EDF5FD',
      disabled: '#697787',
      disabledFill: '#EEF2F6',
    });
  });

  it('reproduces every PASS row of the kit contrast audit', () => {
    // color/Coursen-Contrast-Audit.csv, recomputed rather than trusted.
    const audit: Array<[string, string, number]> = [
      [brand.colors.ink, brand.colors.surface, 4.5],
      [brand.colors.muted, brand.colors.background, 4.5],
      [brand.colors.surface, brand.colors.action, 4.5],
      [brand.colors.surface, brand.colors.actionHover, 4.5],
      [brand.colors.action, brand.colors.pale, 4.5],
      [brand.colors.success, brand.colors.successSurface, 4.5],
      [brand.colors.warning, brand.colors.warningSurface, 4.5],
      [brand.colors.error, brand.colors.errorSurface, 4.5],
      [brand.colors.input, brand.colors.surface, 3],
    ];
    for (const [fg, bg, target] of audit) {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(target);
    }
  });

  it('keeps the documented FAIL pair out of reach for small text', () => {
    // "White on sky - avoid" is the one audited failure. Signature sky is a
    // large-accent colour only; this asserts the reason it is restricted.
    expect(contrastRatio(brand.colors.surface, brand.colors.sky)).toBeLessThan(4.5);
  });
});

describe('type scale', () => {
  it('matches typography/Coursen-Type-Hierarchy.csv', () => {
    expect(type.display).toMatchObject({ desktop: 64, mobile: 40, weight: 600, leading: 1.08 });
    expect(type.h1).toMatchObject({ desktop: 40, mobile: 32, weight: 600 });
    expect(type.h2).toMatchObject({ desktop: 28, mobile: 24, weight: 600 });
    expect(type.h3).toMatchObject({ desktop: 20, mobile: 20, weight: 600 });
    expect(type.body).toMatchObject({ desktop: 16, weight: 400, leading: 1.55 });
    expect(type.smallBody).toMatchObject({ desktop: 14, weight: 400 });
    expect(type.label).toMatchObject({ desktop: 13, weight: 600 });
    expect(type.button).toMatchObject({ desktop: 14, weight: 600 });
    expect(type.metadata).toMatchObject({ desktop: 12, weight: 500, tracking: '0.01em' });
  });

  it('exposes every role as CSS variables so components never pick sizes', () => {
    const vars = brandCssVariables();
    for (const role of Object.keys(type)) {
      expect(vars[`--text-${role}`]).toBeDefined();
      expect(vars[`--text-${role}-mobile`]).toBeDefined();
      expect(vars[`--leading-${role}`]).toBeDefined();
    }
  });

  it('never steps up from desktop to mobile', () => {
    for (const spec of Object.values(type)) {
      expect(spec.mobile).toBeLessThanOrEqual(spec.desktop);
    }
  });
});

describe('motion tokens', () => {
  it('reproduces the logo reveal schedule from the kit study', () => {
    // motion/coursen-logo-reveal-light.svg drives the curve from 0.08s for
    // 0.7s, the waypoint from 0.64s, and the wordmark from 0.83s for 0.52s.
    expect(motion.reveal).toMatchObject({
      curveBegin: 80,
      curveDuration: 700,
      waypointBegin: 640,
      wordmarkBegin: 830,
      wordmarkDuration: 520,
    });
  });

  it('keeps total reveal motion at the documented 1.35 seconds', () => {
    // Motion-Notes.md: "The reveal's active motion lasts about 1.35 seconds."
    expect(motion.reveal.wordmarkBegin + motion.reveal.wordmarkDuration).toBe(
      motion.reveal.total,
    );
    expect(motion.reveal.total).toBe(1350);
  });

  it('uses the kit easing verbatim', () => {
    // keySplines="0.22 1 0.36 1" in the reveal study.
    expect(motion.easing.out).toBe('cubic-bezier(0.22, 1, 0.36, 1)');
  });

  it('keeps interaction transitions brief and easy to ignore', () => {
    // The 2.4s loop is a continuous activity study, not a transition, so it
    // is excluded - anything a user waits on stays under a second.
    const transitions = ['instant', 'fast', 'base', 'slow', 'curve'] as const;
    for (const key of transitions) {
      expect(Number.parseInt(motion.duration[key], 10)).toBeLessThanOrEqual(800);
    }
    expect(motion.duration.loop).toBe('2400ms');
  });
});

describe('dark brand surface', () => {
  it('is Main ink, not a second palette', () => {
    // The kit's dark logo reveal sits on exactly this ground.
    expect(depth.base).toBe(brand.colors.ink);
    expect(depth.accent).toBe(brand.colors.sky);
    expect(depth.ink).toBe(brand.colors.surface);
  });

  it('keeps text on the dark surface above WCAG AAA', () => {
    expect(contrastRatio(depth.ink, depth.base)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(depth.mutedInk, depth.base)).toBeGreaterThanOrEqual(7);
  });

  it('keeps Signature sky readable on dark, where it is permitted', () => {
    // Sky fails on WHITE, which is why it is a large-accent colour there.
    // On the ink field it is comfortably legible - this is the pairing the
    // kit's own dark reveal uses.
    expect(contrastRatio(depth.accent, depth.base)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('design tokens', () => {
  it('exposes depth, motion and surface tokens as CSS variables', () => {
    const vars = brandCssVariables();
    expect(vars['--depth-base']).toBe(depth.base);
    expect(vars['--duration-base']).toBe(motion.duration.base);
    expect(vars['--ease-out']).toBe(motion.easing.out);
    expect(vars['--radius-lg']).toBe(surface.radius.lg);
    expect(vars['--shadow-high']).toBe(surface.shadow.high);
    expect(vars['--glass-blur']).toBe(surface.blur);
  });

  it('keeps the original semantic tokens intact', () => {
    // The workspace UI and the extension both depend on these names.
    const vars = brandCssVariables();
    for (const key of ['--background', '--foreground', '--primary', '--border', '--radius']) {
      expect(vars[key]).toBeDefined();
    }
    expect(vars['--brand-action']).toBe(brand.colors.action);
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

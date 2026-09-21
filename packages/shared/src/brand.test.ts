import { describe, expect, it } from 'vitest';
import { brand, brandCssVariables, brandMarkup } from './brand.js';

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

// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BrandLogo, BrandMark } from './brand-logo';
import { CoursenIcon } from './coursen-icon';

/**
 * The "giant C" regression suite.
 *
 * An <svg> carrying only a viewBox has no intrinsic size. CSS normally gives
 * it one, but a client-side route change commits the new DOM before the
 * route's stylesheet chunk arrives, and in that window the element falls back
 * to `width: 100%` of its containing block. On the sign-in page the brand
 * panel's `hidden lg:flex` has not applied either, so the block is the whole
 * document: navigating home -> /signin painted a 1440x1440px Waypoint C for
 * 12 frames.
 *
 * Presentation attributes live in the markup, so they hold from first paint.
 * These tests keep them there.
 */

afterEach(cleanup);

describe('BrandMark intrinsic sizing', () => {
  it('always carries width and height attributes', () => {
    const { container } = render(<BrandMark />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('32');
    expect(svg.getAttribute('height')).toBe('32');
  });

  it('reflects the size prop in the attributes', () => {
    for (const size of [16, 20, 24, 32, 48, 64, 160]) {
      const { container, unmount } = render(<BrandMark size={size} />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('width')).toBe(String(size));
      expect(svg.getAttribute('height')).toBe(String(size));
      unmount();
    }
  });

  it('is square, so it can never letterbox into a banner', () => {
    const { container } = render(<BrandMark size={64} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe(svg.getAttribute('height'));
    expect(svg.getAttribute('viewBox')).toBe('0 0 64 64');
  });

  it('keeps the attributes when a className also sizes it', () => {
    const { container } = render(<BrandMark size={48} className="h-12 w-12" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('48');
    expect(svg.getAttribute('class')).toContain('h-12');
  });

  it('still selects the small-size optical master below 32px', () => {
    const { container: small } = render(<BrandMark size={20} />);
    const { container: large } = render(<BrandMark size={64} />);
    const strokeOf = (c: HTMLElement) =>
      c.querySelector('path')!.getAttribute('stroke-width');
    expect(strokeOf(small)).toBe('9');
    expect(strokeOf(large)).toBe('8');
  });

  it('never omits the waypoint', () => {
    for (const size of [16, 32, 200]) {
      const { container, unmount } = render(<BrandMark size={size} />);
      expect(container.querySelector('circle')).not.toBeNull();
      unmount();
    }
  });
});

describe('BrandLogo intrinsic sizing', () => {
  it('sizes its mark inline as well as by attribute', () => {
    const { container } = render(<BrandLogo size={36} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('36');
    expect(svg.style.width).toBe('36px');
  });
});

describe('CoursenIcon intrinsic sizing', () => {
  it('carries width and height attributes', () => {
    const { container } = render(<CoursenIcon name="check" className="h-3 w-3" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('height')).toBe('24');
  });
});

describe('every mark call site bounds its own first paint', () => {
  /**
   * A `size` prop and a `h-N/w-N` class that disagree would paint at the
   * wrong size before CSS lands. They are allowed to differ only when a
   * responsive variant (sm:, lg:, xl:) intentionally scales the base size.
   */
  it('keeps size in step with the base Tailwind size class', () => {
    // vitest runs with apps/web as cwd.
    const root = process.cwd();
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.next') continue;
          walk(full);
        } else if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) {
          files.push(full);
        }
      }
    };
    walk(join(root, 'components'));
    walk(join(root, 'app'));

    const mismatches: string[] = [];
    let elementsChecked = 0;
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      if (!src.includes('<BrandMark')) continue;
      // Each <BrandMark ... /> element, attributes flattened.
      for (const match of src.matchAll(/<BrandMark\b([\s\S]*?)\/>/g)) {
        elementsChecked += 1;
        const attrs = match[1]!.replace(/\s+/g, ' ');
        const size = /size=\{(\d+)\}/.exec(attrs)?.[1];
        // Base (unprefixed) h-N class only.
        const rem = /(?:^|[\s"'])h-(\d+)\b/.exec(attrs)?.[1];
        if (!rem) continue;
        const cssPx = Number(rem) * 4;
        const sizePx = size ? Number(size) : 32;
        if (cssPx !== sizePx) {
          const name = file.slice(root.length + 1);
          mismatches.push(`${name}: size=${sizePx} but h-${rem} is ${cssPx}px`);
        }
      }
    }
    expect(mismatches).toEqual([]);
    // Guard the guard: if the scan stops finding elements it has stopped working.
    expect(elementsChecked).toBeGreaterThanOrEqual(8);
  });
});

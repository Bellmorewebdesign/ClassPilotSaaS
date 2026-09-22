import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Animations fail silently, so they get a test.
 *
 * A CSS rule that names a keyframe which was never emitted does not warn,
 * does not throw, and does not fall back - the element simply sits on its
 * starting frame forever. That is exactly how the logo reveal shipped
 * invisible once: the keyframes were declared in tailwind.config.ts, and
 * Tailwind only emits those for `animate-*` utilities it finds in the
 * source, never for hand-written component classes like `.mark-curve`.
 *
 * Nothing about that is visible in a build log or a type error, so these
 * assertions stand in for the eye that would otherwise have to catch it.
 */

const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

const defined = new Set(
  [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1]!),
);
const used = [...css.matchAll(/animation:\s*([\w-]+)/g)].map(
  (match) => match[1]!,
);

describe('globals.css animations', () => {
  it('references only keyframes the stylesheet actually defines', () => {
    const missing = [...new Set(used)].filter((name) => !defined.has(name));
    expect(missing).toEqual([]);
  });

  it('still drives the kit motion studies', () => {
    // The two the brand depends on most: the logo reveal and the workspace
    // activity loop. If either disappears, the entrance goes blank again.
    expect(used).toContain('draw-curve');
    expect(used).toContain('activity-sweep');
  });

  it('ends entrance transforms on none, not on an identity transform', () => {
    /*
     * These run with `both`, so the last frame is what the element keeps.
     * An identity transform still makes that element the containing block
     * for `position: fixed` children, which silently traps a full-screen
     * overlay inside the animated region.
     */
    for (const name of ['rise-in', 'scale-in']) {
      const block = new RegExp(`@keyframes ${name}\\s*\\{[\\s\\S]*?\\n\\}`);
      const body = block.exec(css)?.[0] ?? '';
      expect(body, `@keyframes ${name}`).toMatch(/to\s*\{[^}]*transform:\s*none/);
    }
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { brandCssVariables } from '@classpilot/shared';

/**
 * The popup's visual layer is generated, not transcribed.
 *
 * popup.css resolves every colour, size, radius and duration through a
 * variable that the build writes from brandCssVariables(). That is what makes
 * a palette revision in packages/shared reach the extension without anyone
 * remembering to edit this app. The moment someone pastes a hex value in
 * here, that guarantee is gone and nothing else would notice - so this test
 * notices.
 */

const css = readFileSync('public/popup.css', 'utf8');
/* Comments may quote kit values - it is the declarations that must be clean. */
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '');
const html = readFileSync('public/popup.html', 'utf8');
const tokens = brandCssVariables();

describe('popup styling stays driven by the shared brand tokens', () => {
  it('declares no literal colour anywhere in the stylesheet', () => {
    const literals = [
      ...declarations.matchAll(/#[0-9a-fA-F]{3,8}\b/g),
      ...declarations.matchAll(/\b(?:rgba?|hsla?)\(/g),
    ].map((match) => match[0]);

    expect(literals).toEqual([]);
  });

  it('only references variables the build actually emits', () => {
    const referenced = new Set(
      [...declarations.matchAll(/var\((--[\w-]+)/g)].map((match) => match[1]!),
    );
    // Variables popup.css defines for itself, layered over the shared ones.
    const local = new Set(
      [...declarations.matchAll(/^\s{2}(--[\w-]+):/gm)].map((match) => match[1]!),
    );

    const unknown = [...referenced].filter(
      (name) => !local.has(name) && !(name in tokens),
    );
    expect(unknown).toEqual([]);
  });

  it('uses the kit type roles rather than loose pixel sizes', () => {
    const fontSizes = [
      ...declarations.matchAll(/font-size:\s*([^;]+);/g),
    ].map((match) => match[1]!.trim());
    const loose = fontSizes.filter((value) => !value.startsWith('var(--text-'));

    // Two exceptions, neither of them product copy: the `0` that collapses
    // the line box around the lockup image, and the monospace debug dump.
    expect([...loose].sort()).toEqual(['0', '11px']);
  });

  it('renders the official Sync lockup instead of rebuilding it', () => {
    expect(html).toContain('src="coursen-sync.svg"');
    expect(html).not.toMatch(/<h1[^>]*>\s*\{\{brand\./);
  });
});

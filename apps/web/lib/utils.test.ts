import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cn, TYPE_ROLES, TEXT_COLOR_ROLES } from './utils';

/**
 * `cn` has to know the design tokens, and these tests are why.
 *
 * tailwind-merge does not read tailwind.config.ts. It ships a model of the
 * DEFAULT Tailwind scale and infers the group of anything it does not
 * recognise - and it inferred that every Brand Kit v2 colour role was a font
 * size. `cn('text-metadata text-success')` returned `'text-success'`.
 *
 * Nothing failed. Nothing warned. The text just rendered at the inherited
 * size, which on the homepage grew a row by 5.12px every animation loop and
 * shifted the whole page. Tests are the only thing that can see this.
 */

const config = readFileSync(new URL('../tailwind.config.ts', import.meta.url), 'utf8');

/** Pull the keys of a top-level `theme.extend` block out of the config. */
function themeKeys(block: string): string[] {
  const start = config.indexOf(`${block}: {`);
  if (start === -1) throw new Error(`tailwind.config.ts has no ${block} block`);
  let depth = 0;
  let end = start;
  for (let i = start + block.length + 2; i < config.length; i += 1) {
    if (config[i] === '{') depth += 1;
    else if (config[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  return [...config.slice(start, end).matchAll(/\n {8}'?([\w-]+)'?:/g)].map(
    (match) => match[1]!,
  );
}

describe('cn understands the Brand Kit v2 token groups', () => {
  it('keeps the type role when a colour role is applied with it', () => {
    // The exact pairing that was shifting the homepage.
    expect(cn('text-metadata text-success')).toContain('text-metadata');
    expect(cn('text-metadata text-success')).toContain('text-success');
  });

  it('keeps both across every size/colour combination', () => {
    const lost: string[] = [];
    for (const size of TYPE_ROLES) {
      for (const color of TEXT_COLOR_ROLES) {
        const merged = cn(`text-${size} text-${color}`);
        if (!merged.includes(`text-${size}`) || !merged.includes(`text-${color}`)) {
          lost.push(`text-${size} + text-${color} -> ${merged}`);
        }
      }
    }
    expect(lost).toEqual([]);
  });

  it('still lets a later size override an earlier one', () => {
    expect(cn('text-body text-h1')).toBe('text-h1');
    expect(cn('text-h1 text-metadata')).toBe('text-metadata');
  });

  it('still lets a later colour override an earlier one', () => {
    expect(cn('text-muted-foreground text-foreground')).toBe('text-foreground');
  });

  it('does not break the default Tailwind scale', () => {
    expect(cn('text-sm text-lg')).toBe('text-lg');
    expect(cn('px-2 px-4')).toBe('px-4');
  });
});

describe('the token lists stay in step with tailwind.config.ts', () => {
  it('covers every fontSize role the config defines', () => {
    const missing = themeKeys('fontSize').filter(
      (key) => !(TYPE_ROLES as readonly string[]).includes(key),
    );
    expect(missing).toEqual([]);
  });

  it('covers every flat colour role the config defines', () => {
    // `depth` is a nested scale, so it appears in the config as one key and
    // in TEXT_COLOR_ROLES as its expanded children.
    const missing = themeKeys('colors')
      .filter((key) => key !== 'depth')
      .filter((key) => !(TEXT_COLOR_ROLES as readonly string[]).includes(key));
    expect(missing).toEqual([]);
  });
});

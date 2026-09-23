import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Brand Kit v2 type roles.
 *
 * These are the keys of `theme.fontSize` in tailwind.config.ts. They have to
 * be repeated here because tailwind-merge does not read the Tailwind config -
 * it ships a model of the DEFAULT scale and infers everything else. The
 * guard against these two lists drifting apart is in lib/utils.test.ts, which
 * parses the config and fails if a role is missing.
 */
const TYPE_ROLES = [
  'display',
  'h1',
  'h2',
  'h3',
  'body',
  'small-body',
  'label',
  'button',
  'metadata',
] as const;

/**
 * Brand Kit v2 colour roles that `text-*` can name.
 *
 * Same reason as above, and the same test guards it.
 */
const TEXT_COLOR_ROLES = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
  'neutral',
  'action-hover',
  'sky',
  'success',
  'success-surface',
  'warning',
  'warning-surface',
  'error-text',
  'error-surface',
  'disabled',
  'disabled-fill',
  // `depth` is a nested scale: text-depth-ink, text-depth-accent, ...
  'depth-base',
  'depth-sunken',
  'depth-raised',
  'depth-ink',
  'depth-muted',
  'depth-accent',
  'depth-line',
  'depth-line-strong',
] as const;

/**
 * `cn`, taught this project's design tokens.
 *
 * WHY THIS IS NOT JUST `twMerge(clsx(...))`:
 *
 * Tailwind's `text-*` prefix is shared between font-size and text-colour, so
 * tailwind-merge has to decide which group a class belongs to. For the
 * default scale it knows the answer. For custom keys it guesses - and it
 * guessed that every one of this project's colour roles was a font size.
 *
 * The consequence was silent and everywhere: `cn('text-metadata text-success')`
 * returned `'text-success'`, dropping the size. On the homepage that made the
 * "Due date read" line jump 12px -> 16px each time it appeared, growing its
 * row by 5.12px and shifting the entire page below it on every animation
 * loop. A scan of the codebase found 18 class strings losing their type role
 * this way, across sign-in, the dashboard, assignment rows and the nav.
 *
 * Declaring both groups removes the guess. Sizes conflict only with sizes and
 * colours only with colours, which is what the design system means.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...TYPE_ROLES] }],
      'text-color': [{ text: [...TEXT_COLOR_ROLES] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export { TYPE_ROLES, TEXT_COLOR_ROLES };

/**
 * Text normalization shared by the extension and the API.
 *
 * The extension normalizes so batches are small and consistent; the API
 * normalizes again because it must never trust extension output. Running
 * these twice is idempotent by design.
 */

/** Max characters we keep for a short field (titles, teacher names, topics). */
export const SHORT_TEXT_MAX = 500;
/** Max characters we keep for a long field (assignment instructions). */
export const LONG_TEXT_MAX = 20_000;

/**
 * Collapse whitespace, strip zero-width and control characters, trim.
 * Returns null for anything that normalizes to an empty string, so callers
 * get a clean "we did not observe this" signal instead of `""`.
 */
export function normalizeText(
  value: unknown,
  maxLength: number = SHORT_TEXT_MAX,
): string | null {
  if (typeof value !== 'string') return null;

  const cleaned = value
    // Zero-width space / non-joiner / joiner / BOM.
    .replace(/[​-‍﻿]/g, '')
    // Control chars except tab/newline/carriage-return.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    // Non-breaking space and friends behave like ordinary spaces.
    .replace(/[   ]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\r?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleaned === '') return null;
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength).trim() : cleaned;
}

/** Same as {@link normalizeText} but with the long-field budget. */
export function normalizeLongText(value: unknown): string | null {
  return normalizeText(value, LONG_TEXT_MAX);
}

/**
 * Normalize a URL for storage.
 *
 * Rejects anything that is not http(s) — this is the guard that stops a
 * compromised or buggy extractor from handing us `javascript:` payloads that
 * the web app would later render into an anchor.
 */
export function normalizeUrl(value: unknown, maxLength = 2048): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const out = url.toString();
  return out.length > maxLength ? null : out;
}

/**
 * Parse a points value out of whatever the DOM gave us.
 * Accepts numbers, `"100"`, `"100 points"`, `"/100"`. Returns null when the
 * value is absent, unparseable, negative or implausibly large.
 */
export function normalizePoints(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'string') {
    const match = /-?\d+(?:\.\d+)?/.exec(value.replace(/,/g, ''));
    if (!match) return null;
    n = Number(match[0]);
  } else {
    return null;
  }
  if (!Number.isFinite(n) || n < 0 || n > 100_000) return null;
  return n;
}

/**
 * Coerce an arbitrary value onto a closed vocabulary.
 * Anything unrecognized becomes the supplied fallback — we never invent a
 * new enum member from untrusted input.
 */
export function normalizeEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  if (typeof value !== 'string') return fallback;
  const candidate = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return (allowed as readonly string[]).includes(candidate)
    ? (candidate as T)
    : fallback;
}

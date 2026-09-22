import { cn } from '@/lib/utils';

/**
 * The class abbreviation tile.
 *
 * The kit identifies a class by a two-letter tile in Light brand rather than
 * a generic icon, which gives a list of classes some visual differentiation
 * without inventing per-class colours the data cannot support.
 *
 * Derivation: initials of the first two words ("AP Calculus" -> "AP"), or the
 * first two letters of a single word ("Chemistry" -> "Ch"). Deterministic, so
 * a class always looks the same.
 */
export function classAbbreviation(name: string): string {
  const words = name
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);

  if (words.length === 0) return '??';
  if (words.length === 1) {
    const word = words[0]!;
    return (word.slice(0, 2).charAt(0).toUpperCase() + word.charAt(1)).trim() || word.charAt(0).toUpperCase();
  }
  return (words[0]!.charAt(0) + words[1]!.charAt(0)).toUpperCase();
}

export function ClassBadge({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-label text-primary',
        className,
      )}
    >
      {classAbbreviation(name)}
    </span>
  );
}

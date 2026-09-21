import { parseClassroomUrl } from '@classpilot/shared';

/**
 * Dedupe keys — the mechanism that makes syncing idempotent.
 *
 * A key is derived once per record and stored on the document. A unique index
 * on (userId, source, dedupeKey) then makes duplicates physically impossible,
 * rather than depending on application logic getting it right every time.
 *
 * Precedence is deliberate, best signal first:
 *
 *   id:<classroomId>   the opaque Classroom id from the URL. Survives renames,
 *                      re-posts and section changes.
 *   url:<canonicalUrl> the canonical page URL. Survives renames.
 *   name:/title:       last resort, derived from text. Renaming the item in
 *                      Classroom WILL create a second record — an accepted
 *                      trade-off, because the alternative is dropping data we
 *                      cannot otherwise identify.
 *
 * Keys are prefixed so an id can never collide with a URL or a title.
 */

const MAX_KEY_LENGTH = 600;

function clamp(key: string): string {
  return key.length > MAX_KEY_LENGTH ? key.slice(0, MAX_KEY_LENGTH) : key;
}

/** Normalize text used inside a fallback key so trivial whitespace/case
 * differences do not split one record into two. */
function keyText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function buildClassDedupeKey(input: {
  sourceId: string | null;
  canonicalUrl: string | null;
  name: string | null;
}): string | null {
  if (input.sourceId) return clamp(`id:${input.sourceId}`);
  if (input.canonicalUrl) return clamp(`url:${input.canonicalUrl}`);
  if (input.name) return clamp(`name:${keyText(input.name)}`);
  return null;
}

export function buildAssignmentDedupeKey(input: {
  sourceId: string | null;
  canonicalUrl: string | null;
  classDedupeKey: string;
  title: string | null;
}): string | null {
  if (input.sourceId) return clamp(`id:${input.sourceId}`);
  if (input.canonicalUrl) return clamp(`url:${input.canonicalUrl}`);
  if (input.title) {
    return clamp(`title:${input.classDedupeKey}::${keyText(input.title)}`);
  }
  return null;
}

/**
 * Work out which class an assignment belongs to, from whatever the extractor
 * managed to capture. Returns the class dedupe key, or null when the
 * assignment cannot be attributed to any class at all.
 */
export function resolveClassKeyForAssignment(input: {
  classSourceId: string | null;
  classCanonicalUrl: string | null;
  /** The assignment's own URL — it embeds the course id. */
  assignmentCanonicalUrl: string | null;
}): string | null {
  if (input.classSourceId) return `id:${input.classSourceId}`;

  // An assignment URL carries its course id: /c/<courseId>/a/<workId>/details.
  // This is the most reliable fallback we have.
  const fromAssignmentUrl = parseClassroomUrl(input.assignmentCanonicalUrl).courseId;
  if (fromAssignmentUrl) return `id:${fromAssignmentUrl}`;

  const fromClassUrl = parseClassroomUrl(input.classCanonicalUrl);
  if (fromClassUrl.courseId) return `id:${fromClassUrl.courseId}`;
  if (fromClassUrl.canonicalUrl) return `url:${fromClassUrl.canonicalUrl}`;

  return null;
}

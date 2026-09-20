/**
 * Google Classroom URL handling.
 *
 * URL shape is by far the most stable signal Classroom gives us — far more
 * stable than any CSS class or DOM structure. Every extractor should prefer
 * a URL-derived fact over a DOM-derived one.
 *
 * Observed Classroom URL grammar (all optionally prefixed with `/u/<n>` when
 * the browser is signed into multiple Google accounts):
 *
 *   /h                              home / class list
 *   /c/<courseId>                   a class "Stream" page
 *   /w/<courseId>/t/all             a class "Classwork" page
 *   /c/<courseId>/a/<courseWorkId>/details     an assignment detail page
 *   /c/<courseId>/m/<courseWorkId>/details     a material detail page
 *   /c/<courseId>/sa/<courseWorkId>/...        a per-student assignment view
 *
 * `courseId` and `courseWorkId` are opaque base64-ish tokens. We treat them as
 * opaque strings and never try to decode them.
 */

export const CLASSROOM_ORIGIN = 'https://classroom.google.com';

/** Matches the `/u/<n>` account-switcher prefix Classroom inserts. */
const ACCOUNT_PREFIX = /^\/u\/\d+(?=\/|$)/;

/** Opaque Classroom id token: base64url-ish, reasonably long. */
const ID_TOKEN = '[A-Za-z0-9_-]{4,}';

const CLASS_PATH = new RegExp(`^/(?:c|w)/(${ID_TOKEN})(?:/|$)`);
const COURSEWORK_PATH = new RegExp(
  `^/c/${ID_TOKEN}/(?:a|m|sa)/(${ID_TOKEN})(?:/|$)`,
);

export type ClassroomPageKind =
  | 'home'
  | 'class_stream'
  | 'class_classwork'
  | 'assignment_detail'
  | 'material_detail'
  | 'other';

export interface ParsedClassroomUrl {
  /** True when the URL is on classroom.google.com at all. */
  isClassroom: boolean;
  /** Best guess at what kind of page this URL addresses. */
  kind: ClassroomPageKind;
  /** Opaque Classroom course id, when the URL carries one. */
  courseId: string | null;
  /** Opaque Classroom coursework id, when the URL carries one. */
  courseWorkId: string | null;
  /** Absolute URL with the `/u/<n>` prefix, query and hash removed. */
  canonicalUrl: string | null;
}

function stripAccountPrefix(pathname: string): string {
  const stripped = pathname.replace(ACCOUNT_PREFIX, '');
  return stripped === '' ? '/' : stripped;
}

/** Remove a single trailing slash (but never turn "/" into ""). */
function stripTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;
}

/**
 * True when a string is a root-relative reference like `/c/ABC123`.
 *
 * We accept only root-relative refs, never bare path segments. `new URL()`
 * would happily turn *any* string into a classroom.google.com URL
 * ("not a url" -> "https://classroom.google.com/not%20a%20url"), which would
 * make every scrap of DOM text look like a valid Classroom link.
 */
function isRootRelativeRef(value: string): boolean {
  return value.startsWith('/');
}

/** True when a string already carries its own scheme. */
function hasScheme(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
}

/**
 * Resolve an absolute or root-relative href against classroom.google.com.
 * Returns null for anything that is not a usable http(s) URL — `javascript:`,
 * `mailto:`, `#anchor`, and arbitrary text all yield null.
 */
export function toAbsoluteClassroomUrl(
  href: string | null | undefined,
  base: string = CLASSROOM_ORIGIN,
): string | null {
  if (typeof href !== 'string') return null;
  const trimmed = href.trim();
  if (trimmed === '') return null;
  if (!hasScheme(trimmed) && !isRootRelativeRef(trimmed)) return null;

  let url: URL;
  try {
    url = new URL(trimmed, base);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  return url.toString();
}

/**
 * Parse a Classroom URL into its stable parts.
 * Never throws — an unparseable input yields `isClassroom: false`.
 */
export function parseClassroomUrl(
  rawUrl: string | null | undefined,
): ParsedClassroomUrl {
  const miss: ParsedClassroomUrl = {
    isClassroom: false,
    kind: 'other',
    courseId: null,
    courseWorkId: null,
    canonicalUrl: null,
  };
  if (typeof rawUrl !== 'string') return miss;
  const trimmed = rawUrl.trim();
  if (trimmed === '') return miss;
  // Only absolute URLs and root-relative refs are meaningful here; see
  // isRootRelativeRef for why arbitrary text must not resolve.
  if (!hasScheme(trimmed) && !isRootRelativeRef(trimmed)) return miss;

  let url: URL;
  try {
    url = new URL(trimmed, CLASSROOM_ORIGIN);
  } catch {
    return miss;
  }

  if (url.hostname !== 'classroom.google.com') return miss;

  const path = stripTrailingSlash(stripAccountPrefix(url.pathname));
  const courseId = CLASS_PATH.exec(path)?.[1] ?? null;
  const courseWorkId = COURSEWORK_PATH.exec(path)?.[1] ?? null;

  let kind: ClassroomPageKind = 'other';
  if (path === '/h' || path === '/' || path === '/u') {
    kind = 'home';
  } else if (courseWorkId) {
    kind = path.includes('/m/') ? 'material_detail' : 'assignment_detail';
  } else if (path.startsWith('/w/')) {
    kind = 'class_classwork';
  } else if (path.startsWith('/c/')) {
    kind = 'class_stream';
  }

  return {
    isClassroom: true,
    kind,
    courseId,
    courseWorkId,
    canonicalUrl: `${CLASSROOM_ORIGIN}${path}`,
  };
}

/** Canonical Stream URL for a course id. */
export function classStreamUrl(courseId: string): string {
  return `${CLASSROOM_ORIGIN}/c/${courseId}`;
}

/** Canonical Classwork URL for a course id. */
export function classworkUrl(courseId: string): string {
  return `${CLASSROOM_ORIGIN}/w/${courseId}/t/all`;
}

/** Canonical assignment detail URL. */
export function assignmentDetailUrl(
  courseId: string,
  courseWorkId: string,
): string {
  return `${CLASSROOM_ORIGIN}/c/${courseId}/a/${courseWorkId}/details`;
}

/** True when the URL points anywhere on Google Classroom. */
export function isClassroomUrl(rawUrl: string | null | undefined): boolean {
  return parseClassroomUrl(rawUrl).isClassroom;
}

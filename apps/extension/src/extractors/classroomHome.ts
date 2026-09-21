import {
  parseClassroomUrl,
  toAbsoluteClassroomUrl,
  type ClassroomClassCandidate,
} from '@classpilot/shared';
import {
  accessibleName,
  cleanText,
  closestMatching,
  headings,
  isAriaHidden,
  links,
  visibleText,
} from './dom.js';
import { ExtractionRecorder, type ExtractionContext } from './framework.js';

/**
 * Class discovery from the Classroom home page (https://classroom.google.com/h).
 *
 * CONFIDENCE: high for discovery, lower for per-class metadata.
 *
 * Discovery works off the URL grammar: every enrolled class is reachable via
 * an anchor whose href is `/c/<courseId>`. Google would have to change their
 * routing to break this, which is far less likely than a markup change.
 *
 * The class NAME, section, teacher and room are read from the card around
 * that anchor, which is markup-dependent. Each has an ordered set of
 * strategies and the winner is recorded, so a regression is diagnosable.
 *
 * What we do NOT do: guess. A card whose name we cannot read is reported as a
 * warning and skipped, rather than stored as "Untitled".
 */

export const CLASSROOM_HOME_EXTRACTOR_VERSION = '1.0.0';

export interface ClassDiscoveryResult {
  classes: ClassroomClassCandidate[];
  /** True when the page looks like a signed-in Classroom home page. */
  looksSignedIn: boolean;
}

/**
 * Anchors that point at a class but are navigation chrome rather than a class
 * card. Excluding them stops the same class being discovered three times.
 */
function isClassAnchor(href: string): boolean {
  const parsed = parseClassroomUrl(href);
  return parsed.isClassroom && parsed.courseId !== null && parsed.courseWorkId === null;
}

export function extractClassroomHome(
  context: ExtractionContext,
): { result: ClassDiscoveryResult; report: ReturnType<ExtractionRecorder['build']> } {
  const recorder = new ExtractionRecorder(
    'classroomHome',
    CLASSROOM_HOME_EXTRACTOR_VERSION,
    parseClassroomUrl(context.url).canonicalUrl,
  );

  const { document } = context;

  // A signed-out Classroom page redirects to accounts.google.com, so if we
  // are on classroom.google.com at all and see any class link, we are in.
  const allAnchors = links(document);
  const classAnchors = allAnchors.filter((anchor) => {
    if (isAriaHidden(anchor)) return false;
    const absolute = toAbsoluteClassroomUrl(anchor.getAttribute('href'));
    return absolute !== null && isClassAnchor(absolute);
  });

  recorder.note('classAnchors', 'url:/c/<courseId>', classAnchors.length > 0);

  if (classAnchors.length === 0) {
    recorder.warn(
      `no class anchors found among ${allAnchors.length} links on the page`,
    );
  }

  // One course can be linked several times (card title, "Classwork" shortcut,
  // sidebar entry). Keep the first anchor per course id -- the card link comes
  // first in document order, and it is the one with the richest surroundings.
  const byCourseId = new Map<string, HTMLAnchorElement>();
  for (const anchor of classAnchors) {
    const absolute = toAbsoluteClassroomUrl(anchor.getAttribute('href'));
    const courseId = parseClassroomUrl(absolute).courseId;
    if (!courseId) continue;
    if (!byCourseId.has(courseId)) byCourseId.set(courseId, anchor);
  }

  recorder.note('uniqueCourses', 'dedupe-by-courseId', byCourseId.size > 0);

  const classes: ClassroomClassCandidate[] = [];

  for (const [courseId, anchor] of byCourseId) {
    const cardRecorder = new ExtractionRecorder(
      'classroomHome.card',
      CLASSROOM_HOME_EXTRACTOR_VERSION,
      `https://classroom.google.com/c/${courseId}`,
    );

    const card = findCard(anchor);
    const name = extractClassName(anchor, card, cardRecorder);

    if (!name) {
      recorder.warn(`class card for one course had no readable name; skipped`);
      continue;
    }

    // Teacher first: the section strategy needs to know what the teacher
    // name is so it does not mistake one for the other. "Section B" and
    // "Dana Okafor" are both two capitalised words.
    const teacherName = extractTeacher(card, name, cardRecorder);

    classes.push({
      sourceId: courseId,
      canonicalUrl: `https://classroom.google.com/c/${courseId}`,
      name,
      section: extractSecondaryLine(card, name, teacherName, cardRecorder),
      teacherName,
      room: null,
      description: null,
      extraction: cardRecorder.build(),
    });
  }

  recorder.note('classes', 'card-extraction', classes.length > 0);

  return {
    result: {
      classes,
      looksSignedIn: classAnchors.length > 0 || isSignedInShell(document),
    },
    report: recorder.build(),
  };
}

/**
 * The card element wrapping a class link.
 *
 * Strategy: walk up until we hit something that looks like a card -- an
 * element with role="listitem", or a <li>, or an element carrying its own
 * aria-label. Falls back to the anchor's parent.
 *
 * CONFIDENCE: semantic. Classroom renders the class list as a list for
 * accessibility, so role/tag are more durable than class names.
 */
function findCard(anchor: HTMLAnchorElement): Element {
  const card = closestMatching(anchor, (candidate) => {
    const role = candidate.getAttribute('role');
    if (role === 'listitem' || role === 'article') return true;
    if (candidate.tagName.toLowerCase() === 'li') return true;
    return false;
  });
  return card ?? anchor.parentElement ?? anchor;
}

/**
 * The class name.
 *
 *  1. The anchor's own accessible name. Classroom labels the card link with
 *     the class name. (semantic)
 *  2. The first heading inside the card. (semantic)
 *  3. The card's aria-label. (semantic)
 *
 * We never fall back to "the longest text in the card": a class whose name we
 * cannot read is better reported as missing than stored wrong.
 */
function extractClassName(
  anchor: HTMLAnchorElement,
  card: Element,
  recorder: ExtractionRecorder,
): string | null {
  const fromAnchor = cleanText(accessibleName(anchor));
  if (fromAnchor && fromAnchor.length <= 200) {
    recorder.note('name', 'anchor-accessible-name', true);
    return fromAnchor;
  }

  const heading = headings(card)[0];
  const fromHeading = cleanText(accessibleName(heading ?? null));
  if (fromHeading) {
    recorder.note('name', 'card-heading', true);
    return fromHeading;
  }

  const fromCardLabel = cleanText(card.getAttribute('aria-label'));
  if (fromCardLabel) {
    recorder.note('name', 'card-aria-label', true);
    return fromCardLabel;
  }

  recorder.note('name', null as unknown as string, false);
  return null;
}

/**
 * The secondary line on a class card, which Classroom uses for the section.
 *
 * CONFIDENCE: heuristic. It is the first short line in the card that is not
 * the class name, not the teacher, and not the label of one of the card's own
 * navigation links ("Classwork", "View"). This is the weakest strategy in the
 * extractor and is expected to need refinement against a real DOM -- which is
 * exactly why its name appears in the report.
 */
function extractSecondaryLine(
  card: Element,
  className: string,
  teacherName: string | null,
  recorder: ExtractionRecorder,
): string | null {
  const linkLabels = new Set(
    links(card)
      .map((anchor) => cleanText(accessibleName(anchor)))
      .filter((label): label is string => label !== null),
  );

  const candidate = cardTextLines(card).find(
    (line) =>
      line !== className &&
      line !== teacherName &&
      !linkLabels.has(line) &&
      line.length <= 120,
  );

  recorder.note('section', 'card-secondary-line', candidate !== undefined);
  return candidate ?? null;
}

/**
 * The teacher's name.
 *
 * CONFIDENCE: heuristic. Classroom shows the teacher as a person's name on
 * the card, frequently also as the alt text of their avatar. The avatar is
 * tried first because it is structured; a name-shaped text line is the
 * fallback.
 *
 * An avatar alt that merely repeats the class name is a class banner, not a
 * teacher, and is ignored.
 */
function extractTeacher(
  card: Element,
  className: string,
  recorder: ExtractionRecorder,
): string | null {
  for (const image of Array.from(card.querySelectorAll('img[alt]'))) {
    const alt = cleanText(image.getAttribute('alt'));
    if (alt && alt !== className && looksLikeTeacherName(alt)) {
      recorder.note('teacherName', 'avatar-alt-text', true);
      return alt;
    }
  }

  const candidate = cardTextLines(card).find(
    (line) => line !== className && looksLikeTeacherName(line),
  );
  recorder.note('teacherName', 'card-name-shaped-line', candidate !== undefined);
  return candidate ?? null;
}

/**
 * Distinct text lines inside a card, in document order.
 *
 * Each DIRECT CHILD of the card is read separately. Reading the card as one
 * string runs siblings together -- an inline <a> holding the class name
 * followed by a <div> holding the section yields "AP Calculus AB Period 3"
 * rather than two lines.
 */
function cardTextLines(card: Element): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];

  const push = (value: string | null | undefined): void => {
    const line = cleanText(value ?? null);
    if (!line || seen.has(line)) return;
    seen.add(line);
    lines.push(line);
  };

  for (const child of Array.from(card.children)) {
    for (const part of (visibleText(child) ?? '').split('\n')) push(part);
  }

  // A card with no element children still has its own text.
  if (lines.length === 0) {
    for (const part of (visibleText(card) ?? '').split('\n')) push(part);
  }

  return lines;
}

/**
 * Whether a line looks like a person's name: two to four capitalised words,
 * optionally with an honorific. Deliberately conservative -- a false positive
 * would store a class topic as the teacher.
 */
function looksLikeTeacherName(line: string): boolean {
  if (line.length > 60) return false;
  if (/\d/.test(line)) return false;
  const words = line.split(' ').filter((word) => word !== '');
  if (words.length < 2 || words.length > 4) return false;
  return words.every((word) => /^(?:[A-Z][\w'.-]*|[A-Z]\.)$/.test(word));
}

/**
 * Whether the page looks like a signed-in Classroom shell even with no
 * classes -- a real state for a student between terms. Distinguishing this
 * from "not signed in" is what stops the popup showing the wrong error.
 */
function isSignedInShell(document: Document): boolean {
  if (document.querySelector('[role="navigation"], nav')) return true;
  if (document.querySelector('a[href*="SignOutOptions"], a[href*="accounts.google.com/SignOutOptions"]')) {
    return true;
  }
  return false;
}

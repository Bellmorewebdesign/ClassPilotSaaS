import {
  courseWorkDetailUrl,
  parseClassroomUrl,
  toAbsoluteClassroomUrl,
  type AssignmentType,
} from '@classpilot/shared';
import {
  accessibleName,
  cleanText,
  closestMatching,
  isAriaHidden,
  links,
  visibleText,
} from './dom.js';
import { ExtractionRecorder, type ExtractionContext } from './framework.js';

/**
 * Classwork page (https://classroom.google.com/w/<courseId>/t/all).
 *
 * CONFIDENCE: high for discovery, medium for the inline metadata.
 *
 * This extractor's job is to produce the WORK QUEUE: the list of coursework
 * item URLs the sync engine should then visit one at a time in the helper
 * tab. It also opportunistically reads the title, type and due label that
 * Classroom renders inline, so a sync that cannot open an item's detail page
 * still has something useful.
 *
 * Discovery again rests on the URL grammar: coursework items link to
 * `/c/<courseId>/a/<workId>/details` (assignments and quizzes) or
 * `/c/<courseId>/m/<workId>/details` (materials).
 *
 * That distinction is load-bearing. This extractor used to canonicalise
 * every discovered item into an `/a/` URL regardless of the link it came
 * from, which turned every material into a non-existent assignment page. The
 * kind is now carried through on the item.
 */

export const CLASSWORK_EXTRACTOR_VERSION = '1.1.0';

/**
 * Which Classroom route an item lives on.
 *
 * Not the same question as `assignmentType`. A quiz is an assignment as far
 * as routing is concerned (`/a/`), while a material is its own page
 * (`/m/`). Conflating the two produced URLs that pointed at the wrong page.
 */
export type CourseWorkKind = 'assignment' | 'material';

export interface ClassworkItemCandidate {
  /** Opaque coursework id from the URL. */
  sourceId: string;
  /** Canonical detail-page URL for the sync engine to visit. */
  canonicalUrl: string;
  /**
   * The route this item lives on, taken from the link Classroom rendered.
   * Preserved so the detail URL is never rebuilt as the wrong kind.
   */
  kind: CourseWorkKind;
  courseId: string;
  /** Title as rendered in the list; refined later from the detail page. */
  title: string | null;
  assignmentType: AssignmentType;
  /** Raw "Due ..." text if the list showed one. */
  dueLabel: string | null;
  /** Topic heading this item sits under, if the page groups by topic. */
  topic: string | null;
}

export interface ClassworkPageResult {
  courseId: string | null;
  items: ClassworkItemCandidate[];
}

export function extractClassworkPage(context: ExtractionContext): {
  result: ClassworkPageResult;
  report: ReturnType<ExtractionRecorder['build']>;
} {
  const parsedPage = parseClassroomUrl(context.url);
  const recorder = new ExtractionRecorder(
    'classworkPage',
    CLASSWORK_EXTRACTOR_VERSION,
    parsedPage.canonicalUrl,
  );

  const { document } = context;
  const courseId = parsedPage.courseId;
  recorder.note('courseId', 'url:/w/<courseId>', courseId !== null);

  const itemAnchors = links(document).filter((anchor) => {
    if (isAriaHidden(anchor)) return false;
    const absolute = toAbsoluteClassroomUrl(anchor.getAttribute('href'));
    const parsed = parseClassroomUrl(absolute);
    return parsed.courseWorkId !== null;
  });

  recorder.note('itemAnchors', 'url:/a|/m/<workId>/details', itemAnchors.length > 0);
  if (itemAnchors.length === 0) {
    recorder.warn('no coursework item links found on the classwork page');
  }

  const seen = new Set<string>();
  const items: ClassworkItemCandidate[] = [];

  for (const anchor of itemAnchors) {
    const absolute = toAbsoluteClassroomUrl(anchor.getAttribute('href'));
    const parsed = parseClassroomUrl(absolute);
    const workId = parsed.courseWorkId;
    const itemCourseId = parsed.courseId ?? courseId;
    if (!workId || !itemCourseId || seen.has(workId)) continue;
    seen.add(workId);

    const row = findItemRow(anchor);
    const rowText = visibleText(row) ?? '';

    /*
     * Read the kind off the URL Classroom gave us. Materials are /m/ pages
     * and assignments are /a/ pages; they render differently and canonicalising
     * one into the other sends the helper tab somewhere that does not exist.
     */
    const kind: CourseWorkKind =
      parsed.kind === 'material_detail' ? 'material' : 'assignment';

    items.push({
      sourceId: workId,
      canonicalUrl: courseWorkDetailUrl(itemCourseId, workId, kind),
      kind,
      courseId: itemCourseId,
      title: extractItemTitle(anchor, row),
      assignmentType: inferAssignmentType(parsed.kind, anchor, row),
      dueLabel: extractRowDueLabel(row, rowText),
      topic: extractTopic(row),
    });
  }

  recorder.note('items', 'row-extraction', items.length > 0);

  return { result: { courseId, items }, report: recorder.build() };
}

/**
 * The list row wrapping a coursework link.
 * CONFIDENCE: semantic -- Classroom renders classwork as a list.
 */
function findItemRow(anchor: HTMLAnchorElement): Element {
  const row = closestMatching(anchor, (candidate) => {
    const role = candidate.getAttribute('role');
    if (role === 'listitem' || role === 'article' || role === 'row') return true;
    return candidate.tagName.toLowerCase() === 'li';
  });
  return row ?? anchor.parentElement ?? anchor;
}

/**
 * The item title.
 *
 *  1. The anchor's accessible name. (semantic)
 *  2. The first non-empty line of the row, which is where Classroom puts the
 *     title. (heuristic)
 */
function extractItemTitle(anchor: HTMLAnchorElement, row: Element): string | null {
  const fromAnchor = cleanText(accessibleName(anchor));
  if (fromAnchor && fromAnchor.length <= 300) return fromAnchor;

  const firstLine = (visibleText(row) ?? '').split('\n').map(cleanText).find(Boolean);
  return firstLine && firstLine.length <= 300 ? firstLine : null;
}

/**
 * The item type.
 *
 *  1. URL shape: `/m/` is always a material. (url -- authoritative)
 *  2. The icon's accessible name, which Classroom sets to the item type.
 *     (semantic)
 *  3. Text patterns in the row. (textual)
 *
 * Returns 'unknown' rather than defaulting to 'assignment', so a wrong type
 * is never silently stored.
 */
function inferAssignmentType(
  urlKind: ReturnType<typeof parseClassroomUrl>['kind'],
  anchor: HTMLAnchorElement,
  row: Element,
): AssignmentType {
  if (urlKind === 'material_detail') return 'material';

  const iconLabels = Array.from(row.querySelectorAll('[aria-label], img[alt], svg title'))
    .map((element) =>
      cleanText(
        element.getAttribute('aria-label') ??
          element.getAttribute('alt') ??
          element.textContent,
      ),
    )
    .filter((label): label is string => label !== null)
    .map((label) => label.toLowerCase());

  const haystack = [
    ...iconLabels,
    (cleanText(accessibleName(anchor)) ?? '').toLowerCase(),
  ].join(' | ');

  if (/\bquiz\b/.test(haystack)) return 'quiz';
  if (/\bquestion\b/.test(haystack)) return 'question';
  if (/\bmaterial\b/.test(haystack)) return 'material';
  if (/\bassignment\b/.test(haystack)) return 'assignment';

  return 'unknown';
}

/**
 * The raw due label, read from a row's own text.
 *
 * CONFIDENCE: textual. Matching the literal words "Due" and "No due date"
 * survives markup changes entirely, but is English-only -- a known limitation
 * recorded here rather than hidden.
 *
 * Two guards matter:
 *
 *  - "No due date" is checked across the WHOLE text, not per line. A row
 *    frequently renders as one run-on string ("Power Rule Practice No due
 *    date"), and the substring "due date" inside it must not be mistaken for
 *    a real deadline.
 *  - A "Due ..." match longer than 80 characters is prose that happens to
 *    contain the word, not a label, so it is discarded.
 */
export function extractDueLabel(text: string): string | null {
  if (text === '') return null;

  // An explicit statement that there is no deadline. This is a real answer,
  // not a parse failure, so it is returned as-is for the server to record.
  if (/\bno due date\b/i.test(text)) return 'No due date';

  for (const line of text.split('\n')) {
    const cleaned = cleanText(line);
    if (!cleaned) continue;
    const match = /\bDue\b[^\n]*/i.exec(cleaned);
    if (!match) continue;
    const label = cleanText(match[0]);
    if (label && label.length <= 80) return label;
  }

  return null;
}

/**
 * The due label for one classwork row.
 *
 * Tries the structural reading first -- an element inside the row whose own
 * text IS the label -- because that is immune to sibling text running
 * together. Falls back to scanning the row's full text.
 */
function extractRowDueLabel(row: Element, rowText: string): string | null {
  for (const element of Array.from(row.querySelectorAll('*'))) {
    if (element.children.length > 0) continue;
    const text = cleanText(element.textContent);
    if (!text || text.length > 80) continue;
    if (/^no due date$/i.test(text)) return 'No due date';
    if (/^due\b/i.test(text)) return text;
  }
  return extractDueLabel(rowText);
}

/**
 * The topic heading an item sits under.
 *
 * CONFIDENCE: heuristic. Classroom groups classwork under topic headings; we
 * look for the nearest preceding heading element. Refinement against a real
 * DOM is expected.
 */
function extractTopic(row: Element): string | null {
  const section = closestMatching(
    row,
    (candidate) =>
      candidate.getAttribute('role') === 'region' ||
      candidate.tagName.toLowerCase() === 'section',
    6,
  );
  if (!section) return null;

  const heading = section.querySelector('h1, h2, h3, [role="heading"]');
  const topic = cleanText(accessibleName(heading));
  return topic && topic.length <= 200 ? topic : null;
}

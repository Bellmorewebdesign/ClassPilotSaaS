import {
  classifyAttachment,
  parseClassroomUrl,
  parseDueLabel,
  toAbsoluteClassroomUrl,
  type AssignmentCandidate,
  type AssignmentStatus,
  type AssignmentType,
  type AttachmentCandidate,
  type GradeCandidate,
} from '@classpilot/shared';
import {
  accessibleName,
  cleanMultilineText,
  cleanText,
  findAllByTextPattern,
  headings,
  isAriaHidden,
  links,
  mainRegion,
  visibleText,
} from './dom.js';
import {
  ExtractionRecorder,
  isGenericPageTitle,
  strategy,
  type ExtractionContext,
} from './framework.js';
import { extractDueLabel } from './classworkPage.js';

/**
 * Assignment detail page
 * (https://classroom.google.com/c/<courseId>/a/<workId>/details).
 *
 * This is the richest page and therefore the one with the most DOM
 * uncertainty. Every field runs through an ordered strategy list and the
 * winner is recorded, so we can see at a glance which fields are coming from
 * a durable signal and which are resting on a heuristic.
 *
 * Signals by confidence:
 *   url       courseId, courseWorkId, canonical URL
 *   semantic  title (heading), attachments (link hosts), page structure
 *   textual   due label, points, status chips, grade
 *   heuristic instructions (longest prose block in main)
 */

export const ASSIGNMENT_EXTRACTOR_VERSION = '1.0.0';

export interface AssignmentPageResult {
  candidate: AssignmentCandidate | null;
  /** Set when the page is not a usable assignment page. */
  failureReason: string | null;
}

export function extractAssignmentPage(
  context: ExtractionContext,
): AssignmentPageResult {
  const parsedPage = parseClassroomUrl(context.url);
  const recorder = new ExtractionRecorder(
    'assignmentPage',
    ASSIGNMENT_EXTRACTOR_VERSION,
    parsedPage.canonicalUrl,
  );

  if (!parsedPage.courseWorkId || !parsedPage.courseId) {
    return {
      candidate: null,
      failureReason: 'not_an_assignment_page',
    };
  }

  const main = mainRegion(context.document);
  const mainText = visibleText(main) ?? '';

  const title = recorder.resolve('title', titleStrategies(main), context);

  if (!title) {
    // Without a title there is nothing worth storing; the API would reject it
    // anyway. Fail here with a clear reason instead of sending junk.
    return { candidate: null, failureReason: 'assignment_title_not_found' };
  }

  const dueLabel = recorder.resolve('dueLabel', dueLabelStrategies(mainText), context);
  const dueAt = dueLabel ? parseDueLabel(dueLabel, context.now).dueAt : null;
  recorder.note('dueAt', dueAt ? 'parsed-from-dueLabel' : 'unparseable-or-absent', dueAt !== null);

  const attachments = extractAttachments(main, recorder);

  const candidate: AssignmentCandidate = {
    sourceId: parsedPage.courseWorkId,
    canonicalUrl: parsedPage.canonicalUrl,
    classSourceId: parsedPage.courseId,
    classCanonicalUrl: `https://classroom.google.com/c/${parsedPage.courseId}`,
    title,
    instructions: recorder.resolve('instructions', instructionStrategies(main, title), context),
    assignmentType: resolveAssignmentType(parsedPage.kind, mainText, recorder),
    topic: recorder.resolve('topic', topicStrategies(main), context),
    dueAtIso: dueAt ? dueAt.toISOString() : null,
    dueLabel,
    pointsPossible: recorder.resolve('pointsPossible', pointsStrategies(mainText), context),
    status: resolveStatus(mainText, recorder),
    grade: resolveGrade(mainText, recorder),
    attachments,
    extraction: recorder.build(),
  };

  return { candidate, failureReason: null };
}

// ---------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------

function titleStrategies(main: Element) {
  return [
    strategy<string>(
      'main-first-heading',
      'semantic',
      'The first <h1>/<h2>/role=heading inside the main region. Classroom marks the assignment title as a heading for screen readers.',
      () => {
        const heading = headings(main)[0];
        const text = cleanText(accessibleName(heading ?? null));
        return text && text.length <= 300 ? text : null;
      },
    ),
    strategy<string>(
      'document-title-minus-suffix',
      'semantic',
      'document.title, with a trailing " - Google Classroom"-style suffix removed. Rejects the app shell\'s own titles.',
      (context) => {
        const raw = cleanText(context.document.title);
        if (!raw) return null;
        const withoutSuffix = cleanText(raw.replace(/\s*[-|]\s*Google Classroom\s*$/i, ''));
        if (!withoutSuffix || withoutSuffix.length > 300) return null;
        return isGenericPageTitle(withoutSuffix) ? null : withoutSuffix;
      },
    ),
  ];
}

// ---------------------------------------------------------------------------
// Due date
// ---------------------------------------------------------------------------

function dueLabelStrategies(mainText: string) {
  return [
    strategy<string>(
      'aria-label-due',
      'semantic',
      'An element whose aria-label starts with "Due".',
      (context) => {
        const labelled = Array.from(
          context.document.querySelectorAll('[aria-label]'),
        ).find((element) => {
          if (isAriaHidden(element)) return false;
          const label = element.getAttribute('aria-label') ?? '';
          return /^\s*(due\b|no due date)/i.test(label);
        });
        const label = cleanText(labelled?.getAttribute('aria-label'));
        return label && label.length <= 80 ? label : null;
      },
    ),
    strategy<string>(
      'text-due-line',
      'textual',
      'A visible line matching /Due .../ or "No due date". Survives markup changes; English-only.',
      () => extractDueLabel(mainText),
    ),
  ];
}

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

function pointsStrategies(mainText: string) {
  return [
    strategy<number>(
      'text-n-points',
      'textual',
      'A visible line of the form "100 points" / "1 point".',
      () => {
        const match = /\b(\d{1,5}(?:\.\d+)?)\s*points?\b/i.exec(mainText);
        return match?.[1] ? Number(match[1]) : null;
      },
    ),
    strategy<number>(
      'text-ungraded',
      'textual',
      'An explicit "Ungraded" label, which means there is no points value.',
      () => {
        // Returning null lets the field record as "not found", which is the
        // truthful outcome: ungraded work has no points possible.
        return /\bungraded\b/i.test(mainText) ? null : null;
      },
    ),
  ];
}

// ---------------------------------------------------------------------------
// Instructions
// ---------------------------------------------------------------------------

function instructionStrategies(main: Element, title: string) {
  return [
    strategy<string>(
      'longest-prose-block',
      'heuristic',
      'The longest text block in the main region that is not the title, not a chip and not a link list. EXPECTED TO NEED REFINEMENT against a real Classroom DOM.',
      () => {
        let best: string | null = null;

        for (const element of Array.from(main.querySelectorAll('div, p, section, span'))) {
          if (isAriaHidden(element)) continue;
          // Skip containers -- we want the block that owns the prose.
          if (element.querySelector('a[href], button')) continue;

          const text = cleanMultilineText(visibleText(element));
          if (!text) continue;
          if (text === title) continue;
          if (text.length < 25) continue;
          if (text.length > 20_000) continue;
          // A block that is mostly a due/points chip is not instructions.
          if (/^(due\b|no due date|\d+\s*points?\b)/i.test(text)) continue;

          if (!best || text.length > best.length) best = text;
        }

        return best;
      },
    ),
  ];
}

// ---------------------------------------------------------------------------
// Topic
// ---------------------------------------------------------------------------

function topicStrategies(main: Element) {
  return [
    strategy<string>(
      'breadcrumb-secondary-heading',
      'heuristic',
      'The second heading in the main region, which is where Classroom shows the topic on a detail page.',
      () => {
        const second = headings(main)[1];
        const text = cleanText(accessibleName(second ?? null));
        return text && text.length <= 200 ? text : null;
      },
    ),
  ];
}

// ---------------------------------------------------------------------------
// Type, status, grade
// ---------------------------------------------------------------------------

function resolveAssignmentType(
  urlKind: ReturnType<typeof parseClassroomUrl>['kind'],
  mainText: string,
  recorder: ExtractionRecorder,
): AssignmentType {
  if (urlKind === 'material_detail') {
    recorder.note('assignmentType', 'url:/m/', true);
    return 'material';
  }
  if (/\bquiz assignment\b|\bquiz\b/i.test(mainText)) {
    recorder.note('assignmentType', 'text-quiz', true);
    return 'quiz';
  }
  if (/\bshort answer question\b|\bmultiple choice question\b/i.test(mainText)) {
    recorder.note('assignmentType', 'text-question', true);
    return 'question';
  }
  if (urlKind === 'assignment_detail') {
    recorder.note('assignmentType', 'url:/a/', true);
    return 'assignment';
  }
  recorder.note('assignmentType', 'unresolved', false);
  return 'unknown';
}

/**
 * Submission status.
 *
 * CONFIDENCE: textual. Classroom shows a status chip: "Assigned",
 * "Turned in", "Returned", "Missing", "Done late". Order matters -- an item
 * can read "Turned in late", and "Missing" should win over "Assigned".
 */
function resolveStatus(mainText: string, recorder: ExtractionRecorder): AssignmentStatus {
  const checks: Array<[RegExp, AssignmentStatus, string]> = [
    [/\bmissing\b/i, 'missing', 'text-missing'],
    [/\breturned\b/i, 'returned', 'text-returned'],
    [/\bturned in\b|\bhanded in\b|\bsubmitted\b|\bdone late\b/i, 'submitted', 'text-submitted'],
    [/\bassigned\b/i, 'assigned', 'text-assigned'],
  ];

  for (const [pattern, status, strategyName] of checks) {
    if (pattern.test(mainText)) {
      recorder.note('status', strategyName, true);
      return status;
    }
  }

  recorder.note('status', 'unresolved', false);
  return 'unknown';
}

/**
 * Grade, when Classroom is showing one.
 *
 * CONFIDENCE: textual. Matches "92/100" and "Grade: 92". Returns null rather
 * than a partial guess -- a wrong grade is worse than no grade.
 */
function resolveGrade(mainText: string, recorder: ExtractionRecorder): GradeCandidate | null {
  const fraction = /\b(\d{1,5}(?:\.\d+)?)\s*\/\s*(\d{1,5}(?:\.\d+)?)\b/.exec(mainText);
  if (fraction?.[1] && fraction[2]) {
    recorder.note('grade', 'text-fraction', true);
    return {
      raw: `${fraction[1]}/${fraction[2]}`,
      earned: Number(fraction[1]),
      possible: Number(fraction[2]),
    };
  }

  const labelled = /\bgrade[:\s]+(\d{1,5}(?:\.\d+)?)\b/i.exec(mainText);
  if (labelled?.[1]) {
    recorder.note('grade', 'text-grade-label', true);
    return { raw: labelled[1], earned: Number(labelled[1]), possible: null };
  }

  recorder.note('grade', 'unresolved', false);
  return null;
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

/**
 * Attachments.
 *
 * CONFIDENCE: semantic/url. We collect every link in the main region that
 * points OUTSIDE Classroom's own navigation, then classify it by host. This
 * is markup-independent: it does not matter how Google renders the chip, only
 * that it is an anchor to the file.
 *
 * V1 records name, URL and type. It never opens the attachment.
 */
function extractAttachments(main: Element, recorder: ExtractionRecorder): AttachmentCandidate[] {
  const attachments: AttachmentCandidate[] = [];
  const seen = new Set<string>();

  for (const anchor of links(main)) {
    if (isAriaHidden(anchor)) continue;

    const href = toAbsoluteClassroomUrl(anchor.getAttribute('href'));
    if (!href) continue;

    let host: string;
    try {
      host = new URL(href).hostname.toLowerCase();
    } catch {
      continue;
    }

    // Classroom's own links are navigation, not attachments.
    if (host === 'classroom.google.com') continue;
    // Account and support chrome.
    if (host === 'accounts.google.com' || host === 'support.google.com') continue;
    if (host === 'www.google.com' || host === 'policies.google.com') continue;

    if (seen.has(href)) continue;
    seen.add(href);

    const name = cleanText(accessibleName(anchor));
    const classified = classifyAttachment(href, name);

    attachments.push({
      name,
      url: href,
      mimeType: classified.mimeType,
      provider: classified.provider,
      attachmentType: classified.attachmentType,
    });
  }

  recorder.note('attachments', 'main-region-external-links', attachments.length > 0);
  return attachments;
}

/**
 * Text-pattern chips found on the page, exposed for the diagnostic extractor.
 * Returns the matched LABELS only, never surrounding content.
 */
export function findStatusChips(main: Element): string[] {
  return findAllByTextPattern(main, /^(assigned|turned in|returned|missing|done late|graded)$/i)
    .map((match) => match.text)
    .slice(0, 20);
}

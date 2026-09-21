import { parseClassroomUrl, toAbsoluteClassroomUrl } from '@classpilot/shared';
import { cleanText, isAriaHidden, links, mainRegion } from './dom.js';

/**
 * Structural diagnostics.
 *
 * Classroom DOM extraction is experimental. When a selector stops matching we
 * need to see the page's SHAPE -- but a student's assignment text is private
 * and must not leave their machine to debug a scraper.
 *
 * So this module reports structure and never content:
 *
 *   REPORTED   tag names, ARIA roles, heading levels, link URL patterns,
 *              counts, text-length buckets, which extractor strategies would
 *              match, the aria-label KEYS Classroom uses
 *   NEVER      assignment titles, instructions, teacher names, class names,
 *              attachment filenames, or any raw text node
 *
 * `includeText` exists for the developer debugging their OWN machine. It is
 * off by default, is never enabled by the sync engine, and the popup labels
 * it clearly. Output with it on must not be shared.
 */

export const DIAGNOSTICS_VERSION = '1.0.0';

export interface DiagnosticsOptions {
  /**
   * Include short text samples. DEFAULT FALSE. Local debugging only --
   * output becomes privacy-sensitive and must not be pasted into a bug
   * report or shared.
   */
  includeText?: boolean;
}

export interface StructureReport {
  version: string;
  /** Canonical URL of the page, which carries no personal data. */
  pageUrl: string | null;
  pageKind: string;
  capturedAt: string;

  /** What the page looks like at a glance. */
  document: {
    titleLength: number;
    hasMainLandmark: boolean;
    hasNavLandmark: boolean;
    totalElements: number;
    totalLinks: number;
  };

  /** Link shapes, bucketed by what they point at. Hosts only, no paths. */
  linkPatterns: Array<{ pattern: string; count: number; example: string | null }>;

  /** Heading outline: levels and text LENGTHS, not text. */
  headings: Array<{ level: string; textLength: number; hasAriaLabel: boolean }>;

  /** The ARIA roles present and how many of each. */
  roles: Array<{ role: string; count: number }>;

  /**
   * aria-label values, filtered to short generic UI labels only. A label
   * longer than 40 characters is likely to be content, so only its length is
   * reported.
   */
  ariaLabels: Array<{ label: string | null; length: number }>;

  /** Which of our strategies would currently find something. */
  strategyProbes: Array<{ strategy: string; wouldMatch: boolean; detail: string }>;

  /** Text blocks in main, by size, so we can see where the prose lives. */
  textBlocks: Array<{ tag: string; role: string | null; length: number; sample: string | null }>;
}

/** Generic UI words that are safe to report verbatim. */
const SAFE_LABEL_PATTERN =
  /^(assigned|turned in|returned|missing|done late|graded|ungraded|due|no due date|class(work| comments)?|stream|people|grades|open|close|menu|more|back|next|previous|settings|add|create|submit|hand in|view|attachment|link|edit|search|notifications|main menu|account)$/i;

export function captureStructure(
  document: Document,
  url: string,
  options: DiagnosticsOptions = {},
): StructureReport {
  const includeText = options.includeText === true;
  const parsed = parseClassroomUrl(url);
  const main = mainRegion(document);

  return {
    version: DIAGNOSTICS_VERSION,
    pageUrl: parsed.canonicalUrl,
    pageKind: parsed.kind,
    capturedAt: new Date().toISOString(),

    document: {
      titleLength: document.title.length,
      hasMainLandmark:
        document.querySelector('main, [role="main"]') !== null,
      hasNavLandmark: document.querySelector('nav, [role="navigation"]') !== null,
      totalElements: document.querySelectorAll('*').length,
      totalLinks: document.querySelectorAll('a[href]').length,
    },

    linkPatterns: summarizeLinks(document),
    headings: summarizeHeadings(main),
    roles: summarizeRoles(main),
    ariaLabels: summarizeAriaLabels(main, includeText),
    strategyProbes: probeStrategies(document, main),
    textBlocks: summarizeTextBlocks(main, includeText),
  };
}

/**
 * Link shapes. Classroom URLs are reduced to their grammar (the ids are
 * replaced with a placeholder), and third-party links keep only their host.
 */
function summarizeLinks(document: Document): StructureReport['linkPatterns'] {
  const counts = new Map<string, { count: number; example: string | null }>();

  for (const anchor of links(document)) {
    const href = toAbsoluteClassroomUrl(anchor.getAttribute('href'));
    if (!href) continue;

    let pattern: string;
    let example: string | null = null;

    const classroom = parseClassroomUrl(href);
    if (classroom.isClassroom) {
      pattern = `classroom.google.com${describeClassroomPath(classroom)}`;
      example = pattern;
    } else {
      try {
        pattern = new URL(href).hostname.toLowerCase();
        example = pattern;
      } catch {
        continue;
      }
    }

    const existing = counts.get(pattern);
    if (existing) existing.count += 1;
    else counts.set(pattern, { count: 1, example });
  }

  return [...counts.entries()]
    .map(([pattern, value]) => ({ pattern, count: value.count, example: value.example }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 40);
}

/** "/c/<id>/a/<id>/details" with ids replaced -- structure, not identity. */
function describeClassroomPath(parsed: ReturnType<typeof parseClassroomUrl>): string {
  switch (parsed.kind) {
    case 'home':
      return '/h';
    case 'class_stream':
      return '/c/<courseId>';
    case 'class_classwork':
      return '/w/<courseId>/t/all';
    case 'assignment_detail':
      return '/c/<courseId>/a/<workId>/details';
    case 'material_detail':
      return '/c/<courseId>/m/<workId>/details';
    default:
      return '/<other>';
  }
}

function summarizeHeadings(main: Element): StructureReport['headings'] {
  return Array.from(main.querySelectorAll('h1, h2, h3, h4, [role="heading"]'))
    .filter((element) => !isAriaHidden(element))
    .slice(0, 30)
    .map((element) => ({
      level:
        element.getAttribute('role') === 'heading'
          ? `role=heading[aria-level=${element.getAttribute('aria-level') ?? '?'}]`
          : element.tagName.toLowerCase(),
      textLength: (cleanText(element.textContent) ?? '').length,
      hasAriaLabel: element.hasAttribute('aria-label'),
    }));
}

function summarizeRoles(main: Element): StructureReport['roles'] {
  const counts = new Map<string, number>();
  for (const element of Array.from(main.querySelectorAll('[role]'))) {
    const role = element.getAttribute('role');
    if (!role) continue;
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

/**
 * aria-label values. Only labels matching the generic-UI allow-list are
 * reported verbatim; anything else contributes its length alone, because a
 * long aria-label on Classroom is usually the assignment title.
 */
function summarizeAriaLabels(
  main: Element,
  includeText: boolean,
): StructureReport['ariaLabels'] {
  const results: StructureReport['ariaLabels'] = [];
  const seen = new Set<string>();

  for (const element of Array.from(main.querySelectorAll('[aria-label]')).slice(0, 200)) {
    const label = cleanText(element.getAttribute('aria-label'));
    if (!label) continue;

    const safe = includeText || (label.length <= 40 && SAFE_LABEL_PATTERN.test(label));
    const key = safe ? label.toLowerCase() : `len:${label.length}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({ label: safe ? label : null, length: label.length });
    if (results.length >= 40) break;
  }

  return results;
}

/**
 * Probe each extraction strategy and report whether it would match.
 *
 * This is the single most useful part of the report: it turns "the sync came
 * back empty" into "the class-anchor strategy matched 7 links but the
 * card-heading strategy matched none".
 */
function probeStrategies(document: Document, main: Element): StructureReport['strategyProbes'] {
  const classAnchors = links(document).filter((anchor) => {
    const parsed = parseClassroomUrl(toAbsoluteClassroomUrl(anchor.getAttribute('href')));
    return parsed.courseId !== null && parsed.courseWorkId === null;
  });

  const workAnchors = links(document).filter(
    (anchor) =>
      parseClassroomUrl(toAbsoluteClassroomUrl(anchor.getAttribute('href'))).courseWorkId !==
      null,
  );

  const externalLinks = links(main).filter((anchor) => {
    const href = toAbsoluteClassroomUrl(anchor.getAttribute('href'));
    if (!href) return false;
    try {
      return new URL(href).hostname.toLowerCase() !== 'classroom.google.com';
    } catch {
      return false;
    }
  });

  const mainText = cleanText(main.textContent) ?? '';

  return [
    probe('classroomHome:url-class-anchors', classAnchors.length > 0, `${classAnchors.length} anchors match /c/<courseId>`),
    probe('classworkPage:url-item-anchors', workAnchors.length > 0, `${workAnchors.length} anchors match /a|/m/<workId>/details`),
    probe('assignmentPage:main-first-heading', main.querySelector('h1, h2, [role="heading"]') !== null, 'a heading exists in the main region'),
    probe('assignmentPage:aria-label-due', findsAriaDue(document), 'an aria-label starting with "Due" exists'),
    probe('assignmentPage:text-due-line', /\bdue\b|\bno due date\b/i.test(mainText), 'the word "Due" appears in main'),
    probe('assignmentPage:text-n-points', /\b\d{1,5}\s*points?\b/i.test(mainText), 'an "N points" label appears in main'),
    probe('assignmentPage:status-chip', /\b(assigned|turned in|returned|missing|done late)\b/i.test(mainText), 'a status word appears in main'),
    probe('assignmentPage:attachments', externalLinks.length > 0, `${externalLinks.length} non-Classroom links in main`),
    probe('dom:main-landmark', document.querySelector('main, [role="main"]') !== null, 'page has a <main> or role="main" landmark'),
    probe('dom:list-semantics', main.querySelector('[role="listitem"], li') !== null, 'page uses list semantics for cards/rows'),
  ];
}

function probe(strategyName: string, wouldMatch: boolean, detail: string) {
  return { strategy: strategyName, wouldMatch, detail };
}

function findsAriaDue(document: Document): boolean {
  return Array.from(document.querySelectorAll('[aria-label]')).some((element) =>
    /^\s*(due\b|no due date)/i.test(element.getAttribute('aria-label') ?? ''),
  );
}

/**
 * Where the prose lives. Reports tag, role and LENGTH so we can see which
 * container holds the instructions without reading them.
 */
function summarizeTextBlocks(
  main: Element,
  includeText: boolean,
): StructureReport['textBlocks'] {
  const blocks: StructureReport['textBlocks'] = [];

  for (const element of Array.from(main.querySelectorAll('div, p, section, span, li'))) {
    if (isAriaHidden(element)) continue;
    if (element.querySelector('a[href], button')) continue;

    const text = cleanText(element.textContent);
    if (!text || text.length < 20) continue;

    blocks.push({
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute('role'),
      length: text.length,
      // Local debugging only; null by default.
      sample: includeText ? text.slice(0, 120) : null,
    });
  }

  return blocks.sort((a, b) => b.length - a.length).slice(0, 25);
}

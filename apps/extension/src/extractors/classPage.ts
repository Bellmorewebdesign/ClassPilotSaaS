import { parseClassroomUrl, type ClassroomClassCandidate } from '@classpilot/shared';
import {
  accessibleName,
  cleanText,
  findByTextPattern,
  headings,
  mainRegion,
  visibleText,
} from './dom.js';
import {
  ExtractionRecorder,
  isGenericPageTitle,
  strategy,
  type ExtractionContext,
} from './framework.js';

/**
 * Class stream page (https://classroom.google.com/c/<courseId>).
 *
 * CONFIDENCE: medium.
 *
 * The home page already tells us a class exists and what it is called. This
 * extractor exists to enrich that record with the fields only the class page
 * shows -- room and description -- and to give a second, independent reading
 * of the name and section.
 *
 * It is optional in the sync flow: a class page that fails to parse costs us
 * a couple of metadata fields, not the class.
 */

export const CLASS_PAGE_EXTRACTOR_VERSION = '1.0.0';

export interface ClassPageResult {
  candidate: ClassroomClassCandidate | null;
  failureReason: string | null;
}

export function extractClassPage(context: ExtractionContext): ClassPageResult {
  const parsedPage = parseClassroomUrl(context.url);
  const recorder = new ExtractionRecorder(
    'classPage',
    CLASS_PAGE_EXTRACTOR_VERSION,
    parsedPage.canonicalUrl,
  );

  if (!parsedPage.courseId) {
    return { candidate: null, failureReason: 'not_a_class_page' };
  }

  const main = mainRegion(context.document);

  const name = recorder.resolve(
    'name',
    [
      strategy<string>(
        'banner-heading',
        'semantic',
        'The first heading in the main region, which Classroom uses for the class name on the stream banner.',
        () => {
          const text = cleanText(accessibleName(headings(main)[0] ?? null));
          return text && text.length <= 300 ? text : null;
        },
      ),
      strategy<string>(
        'document-title',
        'semantic',
        'document.title, which Classroom sets to the class name on a stream page.',
        (ctx) => {
          const raw = cleanText(ctx.document.title);
          if (!raw) return null;
          const trimmed = cleanText(raw.replace(/\s*[-|]\s*Google Classroom\s*$/i, ''));
          if (!trimmed || trimmed.length > 300) return null;
          return isGenericPageTitle(trimmed) ? null : trimmed;
        },
      ),
    ],
    context,
  );

  if (!name) {
    return { candidate: null, failureReason: 'class_name_not_found' };
  }

  const candidate: ClassroomClassCandidate = {
    sourceId: parsedPage.courseId,
    canonicalUrl: parsedPage.canonicalUrl,
    name,
    section: recorder.resolve('section', sectionStrategies(main, name), context),
    teacherName: recorder.resolve('teacherName', teacherStrategies(main, name), context),
    room: recorder.resolve('room', roomStrategies(main), context),
    description: recorder.resolve('description', descriptionStrategies(main, name), context),
    extraction: recorder.build(),
  };

  return { candidate, failureReason: null };
}

function sectionStrategies(main: Element, className: string) {
  return [
    strategy<string>(
      'second-heading',
      'semantic',
      'The heading immediately after the class name, which is where the section appears on the banner.',
      () => {
        const text = cleanText(accessibleName(headings(main)[1] ?? null));
        return text && text !== className && text.length <= 200 ? text : null;
      },
    ),
  ];
}

function teacherStrategies(main: Element, className: string) {
  return [
    strategy<string>(
      'teacher-avatar-alt',
      'semantic',
      'The alt text of the teacher avatar image in the class header.',
      () => {
        for (const image of Array.from(main.querySelectorAll('img[alt]'))) {
          const alt = cleanText(image.getAttribute('alt'));
          if (!alt || alt === className) continue;
          if (alt.length <= 60 && !/\d/.test(alt) && alt.includes(' ')) return alt;
        }
        return null;
      },
    ),
  ];
}

function roomStrategies(main: Element) {
  return [
    strategy<string>(
      'room-label',
      'textual',
      'A visible line of the form "Room 204" / "Room: 204".',
      () => {
        const match = findByTextPattern(main, /^Room\b[:\s]/i);
        if (!match) return null;
        const room = cleanText(match.text.replace(/^Room\b[:\s]*/i, ''));
        return room && room.length <= 100 ? room : null;
      },
    ),
  ];
}

function descriptionStrategies(main: Element, className: string) {
  return [
    strategy<string>(
      'about-section-prose',
      'heuristic',
      'The longest prose block in the class header area that is not the name. EXPECTED TO NEED REFINEMENT against a real Classroom DOM.',
      () => {
        const header = main.querySelector('header, [role="banner"]') ?? main;
        let best: string | null = null;
        for (const element of Array.from(header.querySelectorAll('div, p, span'))) {
          if (element.querySelector('a[href], button')) continue;
          const text = cleanText(visibleText(element));
          if (!text || text === className) continue;
          if (text.length < 40 || text.length > 5000) continue;
          if (!best || text.length > best.length) best = text;
        }
        return best;
      },
    ),
  ];
}

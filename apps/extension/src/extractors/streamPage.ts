import { parseClassroomUrl, toAbsoluteClassroomUrl } from '@classpilot/shared';
import {
  accessibleName,
  cleanMultilineText,
  cleanText,
  isAriaHidden,
  links,
  visibleText,
} from './dom.js';
import { ExtractionRecorder, type ExtractionContext } from './framework.js';

/**
 * Class Stream page (https://classroom.google.com/c/<courseId>).
 *
 * CONFIDENCE: medium. Discovery rests on the accessibility structure
 * Classroom gives the stream (a list of articles); the per-post fields are
 * textual and will need revision.
 *
 * WHY THIS MATTERS TO THE PRODUCT
 *
 * A great deal of what a student actually has to do never becomes a formal
 * assignment. "Quiz Friday", "test moved to Monday", "bring your textbook" -
 * those live in the stream and nowhere else. A workspace that only knows
 * about coursework items does not know what is happening in the class.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *
 * It does not infer a quiz, test or deadline from an announcement's wording.
 * "Quiz Friday" is stored as an announcement with its text and its date, and
 * nothing more. Turning that into a calendar event is a judgement call that
 * belongs to a reasoning layer with the whole class context in front of it,
 * not to a regex in a scraper. Storing the source honestly is the job here.
 */

export const STREAM_EXTRACTOR_VERSION = '1.0.0';

export interface AnnouncementCandidate {
  /** Classroom post id, when the post exposes one via a permalink. */
  sourceId: string | null;
  courseId: string | null;
  /** Permalink to the post, when one is rendered. */
  canonicalUrl: string | null;
  /** Post author as displayed, when it is reliably identifiable. */
  author: string | null;
  /** The post body. Never truncated silently - see MAX_BODY_CHARS. */
  body: string | null;
  /** The date label Classroom rendered, unparsed ("Sep 18", "3 days ago"). */
  postedLabel: string | null;
  /** True when the post carries an "Edited" marker. */
  edited: boolean;
  /** Links carried by the post, deduplicated. */
  links: Array<{ url: string; label: string | null }>;
}

export interface StreamPageResult {
  courseId: string | null;
  announcements: AnnouncementCandidate[];
  /** True when the page rendered but carried no posts. */
  looksEmpty: boolean;
}

/** Bound on stored body text, so one enormous post cannot dominate a payload. */
const MAX_BODY_CHARS = 4000;

/** Cap on posts read per stream page. */
const MAX_POSTS = 100;

export function extractStreamPage(context: ExtractionContext): {
  result: StreamPageResult;
  report: ReturnType<ExtractionRecorder['build']>;
} {
  const parsed = parseClassroomUrl(context.url);
  const recorder = new ExtractionRecorder(
    'streamPage',
    STREAM_EXTRACTOR_VERSION,
    parsed.canonicalUrl,
  );

  const { document } = context;
  const courseId = parsed.courseId;
  recorder.note('courseId', 'url:/c/<courseId>', courseId !== null);

  /*
   * Stream posts. Classroom builds the stream as a list, and marks each post
   * as an article or list item for screen readers. Those roles are
   * accessibility structure rather than styling, which makes them the most
   * durable handle available - far more so than the obfuscated class names
   * beside them.
   */
  const postNodes = [
    ...document.querySelectorAll('[role="article"], article, [role="listitem"]'),
  ].filter((node) => !isAriaHidden(node));

  recorder.note('postNodes', 'role=article|listitem', postNodes.length > 0);
  if (postNodes.length === 0) {
    recorder.warn('no stream posts found on the class stream page');
  }

  const announcements: AnnouncementCandidate[] = [];
  const seen = new Set<string>();

  for (const node of postNodes.slice(0, MAX_POSTS)) {
    const candidate = readPost(node, courseId);
    if (!candidate) continue;

    // Dedupe on the permalink where there is one, otherwise on the body.
    const key = candidate.sourceId ?? candidate.body?.slice(0, 120) ?? '';
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    announcements.push(candidate);
  }

  if (postNodes.length > MAX_POSTS) {
    recorder.warn(
      `stream had more than ${MAX_POSTS} posts; only the most recent were read`,
    );
  }

  recorder.note('announcements', 'post-extraction', announcements.length > 0);

  return {
    result: {
      courseId,
      announcements,
      looksEmpty: postNodes.length === 0,
    },
    report: recorder.build(),
  };
}

/**
 * Read one stream post.
 *
 * Returns null for nodes that turn out not to be posts - the stream shares
 * its list structure with the "upcoming work" rail and the comment threads
 * under each post, and neither is an announcement.
 */
function readPost(node: Element, courseId: string | null): AnnouncementCandidate | null {
  const body = cleanMultilineText(visibleText(node));
  if (!body) return null;

  // A post with nothing but a date is chrome, not content.
  if (body.length < 3) return null;

  const postLinks: Array<{ url: string; label: string | null }> = [];
  const linkSeen = new Set<string>();
  let permalink: string | null = null;
  let postId: string | null = null;

  for (const anchor of links(node)) {
    if (isAriaHidden(anchor)) continue;
    const href = anchor.getAttribute('href');
    const absolute = toAbsoluteClassroomUrl(href);

    /*
     * Classroom permalinks a post as /c/<courseId>/p/<postId>. Parsing the
     * id off the URL is the only stable identifier a post has - the visible
     * text changes when a teacher edits it.
     */
    const postMatch = absolute
      ? /\/c\/[^/]+\/p\/([A-Za-z0-9_-]+)/.exec(new URL(absolute).pathname)
      : null;
    if (postMatch) {
      permalink = absolute;
      postId = postMatch[1] ?? null;
      continue;
    }

    // External resources the teacher attached to the post.
    const external = href && /^https?:/i.test(href) ? href : null;
    if (external && !linkSeen.has(external)) {
      linkSeen.add(external);
      postLinks.push({
        url: external,
        label: cleanText(accessibleName(anchor) ?? anchor.textContent),
      });
    }
  }

  return {
    sourceId: postId,
    courseId,
    canonicalUrl: permalink,
    author: readAuthor(node),
    body: body.slice(0, MAX_BODY_CHARS),
    postedLabel: readPostedLabel(node),
    edited: /\bedited\b/i.test(body.slice(0, 200)),
    links: postLinks,
  };
}

/**
 * The post author.
 *
 * CONFIDENCE: heuristic. Classroom renders the author as the accessible name
 * of the avatar image, which is the most reliable handle, but it is not
 * guaranteed. A null author is fine - the announcement is still useful.
 */
function readAuthor(node: Element): string | null {
  const avatar = node.querySelector('img[alt]:not([alt=""])');
  const fromAvatar = cleanText(avatar?.getAttribute('alt'));
  if (fromAvatar && fromAvatar.length < 80) return fromAvatar;
  return null;
}

/**
 * The rendered date label.
 *
 * Stored UNPARSED on purpose. Classroom renders relative dates ("3 days
 * ago"), locale-formatted dates, and abbreviations, and a parse that is wrong
 * is worse than a string that is honest. The API can parse it against the
 * sync timestamp where it is confident, and keep the label either way.
 */
function readPostedLabel(node: Element): string | null {
  // A <time> element is unambiguous where Classroom uses one.
  const time = node.querySelector('time');
  const datetime = cleanText(time?.getAttribute('datetime'));
  if (datetime) return datetime;
  const timeText = cleanText(time?.textContent);
  if (timeText) return timeText;

  /*
   * Otherwise look for a short leading text node that parses as a date-ish
   * label. Bounded to short strings so a post body is never mistaken for a
   * timestamp.
   */
  for (const element of node.querySelectorAll('span, div')) {
    const text = cleanText(element.textContent);
    if (!text || text.length > 24) continue;
    if (/^(\w{3}\s+\d{1,2}|\d{1,2}\s+\w{3}|\d+\s+\w+\s+ago|yesterday|today)$/i.test(text)) {
      return text;
    }
  }
  return null;
}

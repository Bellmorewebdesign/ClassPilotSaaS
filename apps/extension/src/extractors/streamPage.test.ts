import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { extractStreamPage } from './streamPage.js';

/**
 * Stream extraction tests.
 *
 * Announcements carry a lot of what a student actually has to do - "quiz
 * Friday", "test moved to Monday" - and none of it ever becomes a formal
 * assignment. These tests cover discovery and, just as importantly, the
 * restraint: the extractor stores what the teacher wrote and does not try to
 * turn it into a calendar event.
 */

const COURSE = 'Njk5MjMxMjM';
const STREAM_URL = `https://classroom.google.com/c/${COURSE}`;
const POST = 'cDoxMjM0NTY3';

function extract(html: string) {
  const window = new Window();
  window.document.body.innerHTML = html;
  return extractStreamPage({
    document: window.document as unknown as Document,
    url: STREAM_URL,
    now: new Date('2026-09-22T12:00:00Z'),
  }).result;
}

describe('announcement discovery', () => {
  it('finds posts marked as articles', () => {
    const result = extract('<main><div role="article">Quiz Friday on chapter 4.</div></main>');
    expect(result.announcements).toHaveLength(1);
    expect(result.announcements[0]?.body).toContain('Quiz Friday');
  });

  it('reads the course id from the URL', () => {
    const result = extract('<main><div role="article">Anything at all</div></main>');
    expect(result.courseId).toBe(COURSE);
  });

  it('captures the permalink and post id when one is rendered', () => {
    const result = extract(
      `<main><div role="article">Test moved to Monday<a href="/c/${COURSE}/p/${POST}">Sep 18</a></div></main>`,
    );
    expect(result.announcements[0]?.sourceId).toBe(POST);
    expect(result.announcements[0]?.canonicalUrl).toBe(
      `https://classroom.google.com/c/${COURSE}/p/${POST}`,
    );
  });

  it('collects external links the teacher attached', () => {
    const result = extract(
      '<main><div role="article">Read this before Friday<a href="https://example.edu/article">The article</a></div></main>',
    );
    expect(result.announcements[0]?.links).toEqual([
      { url: 'https://example.edu/article', label: 'The article' },
    ]);
  });

  it('does not treat the permalink as an attached resource', () => {
    const result = extract(
      `<main><div role="article">Notice<a href="/c/${COURSE}/p/${POST}">Sep 18</a></div></main>`,
    );
    expect(result.announcements[0]?.links).toEqual([]);
  });

  it('reads a datetime attribute where Classroom renders one', () => {
    const result = extract(
      '<main><div role="article">Bring your textbook<time datetime="2026-09-18T15:00:00Z">Sep 18</time></div></main>',
    );
    expect(result.announcements[0]?.postedLabel).toBe('2026-09-18T15:00:00Z');
  });

  it('falls back to a short rendered date label', () => {
    const result = extract(
      '<main><div role="article">Bring your textbook<span>Sep 18</span></div></main>',
    );
    expect(result.announcements[0]?.postedLabel).toBe('Sep 18');
  });

  it('reads the author from the avatar alt text', () => {
    const result = extract(
      '<main><div role="article"><img alt="Ms Okafor" src="x.png">Quiz Friday</div></main>',
    );
    expect(result.announcements[0]?.author).toBe('Ms Okafor');
  });

  it('leaves the author null rather than guessing', () => {
    const result = extract('<main><div role="article">Quiz Friday</div></main>');
    expect(result.announcements[0]?.author).toBeNull();
  });

  it('reports an empty stream as empty, not as a failure', () => {
    const result = extract('<main><p>No posts yet</p></main>');
    expect(result.announcements).toEqual([]);
    expect(result.looksEmpty).toBe(true);
  });

  it('deduplicates repeated posts', () => {
    const result = extract(
      `<main>
        <div role="article">Notice<a href="/c/${COURSE}/p/${POST}">Sep 18</a></div>
        <div role="article">Notice<a href="/c/${COURSE}/p/${POST}">Sep 18</a></div>
      </main>`,
    );
    expect(result.announcements).toHaveLength(1);
  });

  it('skips aria-hidden nodes', () => {
    const result = extract(
      '<main><div role="article" aria-hidden="true">Hidden chrome</div></main>',
    );
    expect(result.announcements).toEqual([]);
  });

  it('bounds an enormous post rather than storing it whole', () => {
    const huge = 'x'.repeat(10_000);
    const result = extract(`<main><div role="article">${huge}</div></main>`);
    expect(result.announcements[0]?.body?.length).toBeLessThanOrEqual(4000);
  });
});

describe('announcements are stored, not interpreted', () => {
  it('does not invent a quiz from the words "quiz Friday"', () => {
    const result = extract('<main><div role="article">Quiz Friday on chapter 4.</div></main>');
    const announcement = result.announcements[0]!;
    // The body is kept verbatim and nothing resembling an event is produced.
    expect(announcement.body).toContain('Quiz Friday on chapter 4.');
    expect(Object.keys(announcement)).not.toContain('eventType');
    expect(Object.keys(announcement)).not.toContain('dueAt');
  });

  it('keeps the rendered date label unparsed', () => {
    const result = extract(
      '<main><div role="article">Test moved<span>3 days ago</span></div></main>',
    );
    // "3 days ago" is honest. A timestamp derived from it would be a guess.
    expect(result.announcements[0]?.postedLabel).toBe('3 days ago');
  });
});

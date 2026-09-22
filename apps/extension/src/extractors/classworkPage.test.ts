import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { loadFixture } from '../__tests__/helpers/loadFixture.js';
import { extractClassworkPage, extractDueLabel } from './classworkPage.js';

const CLASSWORK_URL = 'https://classroom.google.com/w/Njk5MjMxMjM/t/all';

describe('extractClassworkPage', () => {
  it('discovers every coursework item, deduplicated by work id', () => {
    const { result } = extractClassworkPage(
      loadFixture('classwork-page.html', CLASSWORK_URL),
    );
    expect(result.items).toHaveLength(4);
    const ids = result.items.map((item) => item.sourceId);
    expect(new Set(ids).size).toBe(4);
  });

  it('reads the course id from the page URL', () => {
    const { result } = extractClassworkPage(
      loadFixture('classwork-page.html', CLASSWORK_URL),
    );
    expect(result.courseId).toBe('Njk5MjMxMjM');
  });

  it('builds a canonical detail URL for the sync engine to visit', () => {
    const { result } = extractClassworkPage(
      loadFixture('classwork-page.html', CLASSWORK_URL),
    );
    expect(result.items[0]).toMatchObject({
      sourceId: 'NTQzMjE5OA',
      canonicalUrl:
        'https://classroom.google.com/c/Njk5MjMxMjM/a/NTQzMjE5OA/details',
      title: 'Limits Worksheet',
    });
  });

  it('normalizes a /u/<n> item link into the canonical form', () => {
    const { result } = extractClassworkPage(
      loadFixture('classwork-page.html', CLASSWORK_URL),
    );
    const powerRule = result.items.find((item) => item.sourceId === 'ODg4ODg4OA');
    expect(powerRule?.canonicalUrl).toBe(
      'https://classroom.google.com/c/Njk5MjMxMjM/a/ODg4ODg4OA/details',
    );
  });

  it('classifies item types from the icon label and the URL shape', () => {
    const { result } = extractClassworkPage(
      loadFixture('classwork-page.html', CLASSWORK_URL),
    );
    const byId = new Map(result.items.map((item) => [item.sourceId, item]));
    expect(byId.get('NTQzMjE5OA')?.assignmentType).toBe('assignment');
    expect(byId.get('NzY1NDMyMQ')?.assignmentType).toBe('quiz');
    // The /m/ URL shape is authoritative for materials.
    expect(byId.get('MTIzNDU2Nw')?.assignmentType).toBe('material');
  });

  it('captures the inline due label verbatim', () => {
    const { result } = extractClassworkPage(
      loadFixture('classwork-page.html', CLASSWORK_URL),
    );
    const byId = new Map(result.items.map((item) => [item.sourceId, item]));
    expect(byId.get('NTQzMjE5OA')?.dueLabel).toBe('Due Sep 24, 11:59 PM');
    expect(byId.get('NzY1NDMyMQ')?.dueLabel).toBe('Due Sep 26');
    expect(byId.get('ODg4ODg4OA')?.dueLabel).toBe('No due date');
    // An item with no due text must report null, not a guess.
    expect(byId.get('MTIzNDU2Nw')?.dueLabel).toBeNull();
  });

  it('reads the topic heading each item sits under', () => {
    const { result } = extractClassworkPage(
      loadFixture('classwork-page.html', CLASSWORK_URL),
    );
    const byId = new Map(result.items.map((item) => [item.sourceId, item]));
    expect(byId.get('NTQzMjE5OA')?.topic).toBe('Unit 1: Limits');
    expect(byId.get('ODg4ODg4OA')?.topic).toBe('Unit 2: Derivatives');
  });

  it('warns when the page has no coursework links at all', () => {
    const { report } = extractClassworkPage(
      loadFixture('classroom-signed-out.html', CLASSWORK_URL),
    );
    expect(report.warnings.join(' ')).toMatch(/no coursework item links/);
  });
});

describe('extractDueLabel', () => {
  it('reads common Classroom due phrasings', () => {
    expect(extractDueLabel('Due Sep 24, 11:59 PM')).toBe('Due Sep 24, 11:59 PM');
    expect(extractDueLabel('Posted Sep 1\nDue Tomorrow, 8:00 AM')).toBe(
      'Due Tomorrow, 8:00 AM',
    );
    expect(extractDueLabel('No due date')).toBe('No due date');
  });

  it('ignores the word "due" buried in a paragraph of instructions', () => {
    const prose =
      'This project is due at the end of the unit and will be graded on the rubric handed out in class last week, so please read it carefully before starting.';
    expect(extractDueLabel(prose)).toBeNull();
  });

  it('returns null for text with no due information', () => {
    expect(extractDueLabel('')).toBeNull();
    expect(extractDueLabel('Chapter 4 Reading')).toBeNull();
  });
});

/**
 * Coursework URL kinds.
 *
 * This extractor used to build every discovered item's detail URL as
 * `/c/<courseId>/a/<workId>/details` regardless of the link it came from,
 * which silently turned every MATERIAL into a non-existent assignment page.
 * The helper tab then navigated somewhere that did not exist, and the item
 * came back unreadable.
 */
describe('assignment and material URLs are never confused', () => {
  const COURSE = 'Njk5MjMxMjM';
  const WORK = 'NTQzMjE5OA';
  const MATERIAL = 'ODc2NTQzMjE';

  function pageWith(hrefs: string[]): Document {
    const window = new Window();
    window.document.body.innerHTML = `<main><ul>${hrefs
      .map((href) => `<li role="listitem"><a href="${href}">Item</a></li>`)
      .join('')}</ul></main>`;
    return window.document as unknown as Document;
  }

  function extract(hrefs: string[]) {
    return extractClassworkPage({
      document: pageWith(hrefs),
      url: CLASSWORK_URL,
      now: new Date(),
    }).result.items;
  }

  it('keeps /a/ for an assignment link', () => {
    const [item] = extract([`/c/${COURSE}/a/${WORK}/details`]);
    expect(item?.kind).toBe('assignment');
    expect(item?.canonicalUrl).toBe(
      `https://classroom.google.com/c/${COURSE}/a/${WORK}/details`,
    );
  });

  it('keeps /m/ for a material link', () => {
    const [item] = extract([`/c/${COURSE}/m/${MATERIAL}/details`]);
    expect(item?.kind).toBe('material');
    expect(item?.canonicalUrl).toBe(
      `https://classroom.google.com/c/${COURSE}/m/${MATERIAL}/details`,
    );
  });

  it('never rewrites a material into an assignment URL', () => {
    const [item] = extract([`/c/${COURSE}/m/${MATERIAL}/details`]);
    expect(item?.canonicalUrl).not.toContain('/a/');
  });

  it('preserves the kind of each item in a mixed list', () => {
    const items = extract([
      `/c/${COURSE}/a/${WORK}/details`,
      `/c/${COURSE}/m/${MATERIAL}/details`,
    ]);
    expect(items.map((item) => item.kind)).toEqual(['assignment', 'material']);
    expect(items[0]?.canonicalUrl).toContain('/a/');
    expect(items[1]?.canonicalUrl).toContain('/m/');
  });

  it('deduplicates by source id, keeping the first link seen', () => {
    const items = extract([
      `/c/${COURSE}/a/${WORK}/details`,
      `/c/${COURSE}/a/${WORK}/details`,
    ]);
    expect(items).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';
import { loadFixture } from '../__tests__/helpers/loadFixture.js';
import { extractAssignmentPage } from './assignmentPage.js';

const URL_FULL =
  'https://classroom.google.com/c/Njk5MjMxMjM/a/NTQzMjE5OA/details';
const URL_MINIMAL =
  'https://classroom.google.com/c/Njk5MjMxMjM/a/MTExMTExMQ/details';
const URL_GRADED =
  'https://classroom.google.com/c/Njk5MjMxMjM/a/MjIyMjIyMg/details';

/** 20 Sep 2026, so "Due Sep 24" resolves forward. */
const NOW = new Date(2026, 8, 20, 19, 0, 0);

describe('extractAssignmentPage', () => {
  it('extracts a fully populated assignment', () => {
    const { candidate, failureReason } = extractAssignmentPage(
      loadFixture('assignment-page.html', URL_FULL, NOW),
    );

    expect(failureReason).toBeNull();
    expect(candidate).toMatchObject({
      sourceId: 'NTQzMjE5OA',
      classSourceId: 'Njk5MjMxMjM',
      canonicalUrl: URL_FULL,
      classCanonicalUrl: 'https://classroom.google.com/c/Njk5MjMxMjM',
      title: 'Limits Worksheet',
      topic: 'Unit 1: Limits',
      assignmentType: 'assignment',
      pointsPossible: 100,
      status: 'assigned',
      dueLabel: 'Due Sep 24, 11:59 PM',
    });
  });

  it('resolves the due label into an instant', () => {
    const { candidate } = extractAssignmentPage(
      loadFixture('assignment-page.html', URL_FULL, NOW),
    );
    const dueAt = new Date(candidate!.dueAtIso!);
    expect(dueAt.getMonth()).toBe(8);
    expect(dueAt.getDate()).toBe(24);
    expect(dueAt.getHours()).toBe(23);
    expect(dueAt.getMinutes()).toBe(59);
  });

  it('captures the instructions', () => {
    const { candidate } = extractAssignmentPage(
      loadFixture('assignment-page.html', URL_FULL, NOW),
    );
    expect(candidate!.instructions).toContain('Complete problems 1 through 20');
    expect(candidate!.instructions).toContain('Show all of your work');
  });

  it('collects attachments and classifies each by host', () => {
    const { candidate } = extractAssignmentPage(
      loadFixture('assignment-page.html', URL_FULL, NOW),
    );
    // Keyed by URL, not by type: two different attachments can share a type.
    const byUrl = new Map(candidate!.attachments.map((a) => [a.url, a]));

    expect(candidate!.attachments).toHaveLength(4);

    expect(byUrl.get('https://drive.google.com/file/d/1abcdefg/view')).toMatchObject({
      name: 'Limits Worksheet.pdf',
      attachmentType: 'pdf',
      provider: 'google_drive',
      mimeType: 'application/pdf',
    });
    expect(byUrl.get('https://docs.google.com/presentation/d/1xyz/edit')).toMatchObject({
      attachmentType: 'google_slides',
      provider: 'google_slides',
    });
    expect(byUrl.get('https://www.youtube.com/watch?v=abc123')).toMatchObject({
      attachmentType: 'youtube',
      provider: 'youtube',
    });
    expect(byUrl.get('https://example.edu/handouts/limits.pdf')).toMatchObject({
      attachmentType: 'pdf',
      provider: 'external',
    });
  });

  it("does not mistake Classroom's own navigation links for attachments", () => {
    const { candidate } = extractAssignmentPage(
      loadFixture('assignment-page.html', URL_FULL, NOW),
    );
    const urls = candidate!.attachments.map((a) => a.url);
    expect(urls.some((url) => url.includes('classroom.google.com'))).toBe(false);
    expect(urls.some((url) => url.includes('support.google.com'))).toBe(false);
    expect(urls.every((url) => url.startsWith('https://'))).toBe(true);
  });

  it('emits nulls rather than fabricating values on a sparse page', () => {
    const { candidate, failureReason } = extractAssignmentPage(
      loadFixture('assignment-page-minimal.html', URL_MINIMAL, NOW),
    );

    expect(failureReason).toBeNull();
    expect(candidate).toMatchObject({
      title: 'Chapter 4 Reading',
      dueLabel: 'No due date',
      dueAtIso: null,
      pointsPossible: null,
      instructions: null,
      grade: null,
      attachments: [],
      status: 'unknown',
    });
  });

  it('reads a grade and a returned status', () => {
    const { candidate } = extractAssignmentPage(
      loadFixture('assignment-page-graded.html', URL_GRADED, NOW),
    );
    expect(candidate).toMatchObject({
      status: 'returned',
      pointsPossible: 100,
      grade: { raw: '92/100', earned: 92, possible: 100 },
    });
  });

  it('refuses a URL that is not an assignment detail page', () => {
    const { candidate, failureReason } = extractAssignmentPage(
      loadFixture('assignment-page.html', 'https://classroom.google.com/h', NOW),
    );
    expect(candidate).toBeNull();
    expect(failureReason).toBe('not_an_assignment_page');
  });

  it('fails with a reason rather than storing a title-less record', () => {
    // This fixture's only heading-free content has document.title "Classes",
    // which is the app shell's own title -- it must never become a title.
    const { candidate, failureReason } = extractAssignmentPage(
      loadFixture('classroom-home-empty.html', URL_FULL, NOW),
    );
    expect(candidate).toBeNull();
    expect(failureReason).toBe('assignment_title_not_found');
  });

  it('falls back to document.title when the page has no heading', () => {
    const context = loadFixture('assignment-page-minimal.html', URL_MINIMAL, NOW);
    context.document.querySelector('h1')?.remove();

    const { candidate } = extractAssignmentPage(context);
    expect(candidate?.title).toBe('Chapter 4 Reading');
    expect(
      candidate?.extraction.provenance.find((entry) => entry.field === 'title'),
    ).toMatchObject({ strategy: 'document-title-minus-suffix' });
  });

  it('records which strategy produced each field', () => {
    const { candidate } = extractAssignmentPage(
      loadFixture('assignment-page.html', URL_FULL, NOW),
    );
    const provenance = candidate!.extraction.provenance;
    const byField = new Map(provenance.map((entry) => [entry.field, entry]));

    expect(byField.get('title')).toMatchObject({
      strategy: 'main-first-heading',
      found: true,
    });
    expect(byField.get('dueLabel')).toMatchObject({
      strategy: 'aria-label-due',
      found: true,
    });
    expect(byField.get('pointsPossible')).toMatchObject({
      strategy: 'text-n-points',
      found: true,
    });
    expect(byField.get('attachments')?.found).toBe(true);
  });

  it('marks fields as not found on a sparse page, so gaps are visible', () => {
    const { candidate } = extractAssignmentPage(
      loadFixture('assignment-page-minimal.html', URL_MINIMAL, NOW),
    );
    const missing = candidate!.extraction.provenance
      .filter((entry) => !entry.found)
      .map((entry) => entry.field);

    expect(missing).toEqual(
      expect.arrayContaining(['pointsPossible', 'instructions', 'grade']),
    );
  });

  it('never puts assignment content into the extraction report', () => {
    const { candidate } = extractAssignmentPage(
      loadFixture('assignment-page.html', URL_FULL, NOW),
    );
    const serialized = JSON.stringify(candidate!.extraction);
    expect(serialized).not.toContain('Complete problems');
    expect(serialized).not.toContain('Limits Worksheet');
  });
});

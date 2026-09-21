import { describe, expect, it } from 'vitest';
import { loadFixture } from '../__tests__/helpers/loadFixture.js';
import { extractClassPage } from './classPage.js';

const CLASS_URL = 'https://classroom.google.com/c/Njk5MjMxMjM';

describe('extractClassPage', () => {
  it('enriches a class with the fields only the class page shows', () => {
    const { candidate, failureReason } = extractClassPage(
      loadFixture('class-page.html', CLASS_URL),
    );

    expect(failureReason).toBeNull();
    expect(candidate).toMatchObject({
      sourceId: 'Njk5MjMxMjM',
      canonicalUrl: CLASS_URL,
      name: 'AP Calculus AB',
      section: 'Period 3',
      teacherName: 'Miguel Rivera',
      room: '204',
    });
    expect(candidate!.description).toContain('limits, derivatives, integrals');
  });

  it('refuses a URL that is not a class page', () => {
    const { candidate, failureReason } = extractClassPage(
      loadFixture('class-page.html', 'https://classroom.google.com/h'),
    );
    expect(candidate).toBeNull();
    expect(failureReason).toBe('not_a_class_page');
  });

  it('fails with a reason when the class name cannot be read', () => {
    const { candidate, failureReason } = extractClassPage(
      loadFixture('classroom-home-empty.html', CLASS_URL),
    );
    expect(candidate).toBeNull();
    expect(failureReason).toBe('class_name_not_found');
  });
});

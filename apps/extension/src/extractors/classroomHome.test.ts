import { describe, expect, it } from 'vitest';
import { loadFixture } from '../__tests__/helpers/loadFixture.js';
import { extractClassroomHome } from './classroomHome.js';

const HOME_URL = 'https://classroom.google.com/h';

describe('extractClassroomHome', () => {
  it('discovers every enrolled class', () => {
    const { result } = extractClassroomHome(loadFixture('classroom-home.html', HOME_URL));

    expect(result.classes).toHaveLength(3);
    expect(result.classes.map((c) => c.name)).toEqual([
      'AP Calculus AB',
      'English Literature',
      'Chemistry Honors',
    ]);
    expect(result.looksSignedIn).toBe(true);
  });

  it('derives the canonical class URL from the course id', () => {
    const { result } = extractClassroomHome(loadFixture('classroom-home.html', HOME_URL));
    expect(result.classes[0]).toMatchObject({
      sourceId: 'Njk5MjMxMjM',
      canonicalUrl: 'https://classroom.google.com/c/Njk5MjMxMjM',
    });
  });

  it('strips the /u/<n> account prefix from a class link', () => {
    const { result } = extractClassroomHome(loadFixture('classroom-home.html', HOME_URL));
    const english = result.classes.find((c) => c.name === 'English Literature');
    expect(english?.sourceId).toBe('ODcyMTQ1Njc');
    expect(english?.canonicalUrl).toBe('https://classroom.google.com/c/ODcyMTQ1Njc');
  });

  it('does not report the same class twice when a card links to it more than once', () => {
    const { result } = extractClassroomHome(loadFixture('classroom-home.html', HOME_URL));
    const ids = result.classes.map((c) => c.sourceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reads the section and teacher when the card shows them', () => {
    const { result } = extractClassroomHome(loadFixture('classroom-home.html', HOME_URL));
    expect(result.classes[0]).toMatchObject({
      section: 'Period 3',
      teacherName: 'Miguel Rivera',
    });
  });

  it('emits null - never a guess - when the card has no teacher', () => {
    const { result } = extractClassroomHome(loadFixture('classroom-home.html', HOME_URL));
    const chemistry = result.classes.find((c) => c.name === 'Chemistry Honors');
    // The only img alt on this card repeats the class name, so it must not be
    // mistaken for a teacher.
    expect(chemistry?.teacherName).toBeNull();
  });

  it('records which strategy produced each field', () => {
    const { result } = extractClassroomHome(loadFixture('classroom-home.html', HOME_URL));
    const provenance = result.classes[0]!.extraction.provenance;
    expect(provenance).toEqual(
      expect.arrayContaining([
        { field: 'name', strategy: 'anchor-accessible-name', found: true },
        { field: 'teacherName', strategy: 'avatar-alt-text', found: true },
      ]),
    );
  });

  it('distinguishes "signed in with no classes" from "not signed in"', () => {
    const empty = extractClassroomHome(loadFixture('classroom-home-empty.html', HOME_URL));
    expect(empty.result.classes).toHaveLength(0);
    expect(empty.result.looksSignedIn).toBe(true);

    const signedOut = extractClassroomHome(loadFixture('classroom-signed-out.html', HOME_URL));
    expect(signedOut.result.classes).toHaveLength(0);
    expect(signedOut.result.looksSignedIn).toBe(false);
  });

  it('warns when no class anchors were found at all', () => {
    const { report } = extractClassroomHome(
      loadFixture('classroom-signed-out.html', HOME_URL),
    );
    expect(report.warnings.join(' ')).toMatch(/no class anchors/);
  });

  it('never puts page content into the extraction report', () => {
    const { result, report } = extractClassroomHome(
      loadFixture('classroom-home.html', HOME_URL),
    );
    const serialized = JSON.stringify([report, result.classes.map((c) => c.extraction)]);
    expect(serialized).not.toContain('AP Calculus');
    expect(serialized).not.toContain('Miguel Rivera');
  });
});

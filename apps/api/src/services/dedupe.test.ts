import { describe, expect, it } from 'vitest';
import {
  buildAssignmentDedupeKey,
  buildClassDedupeKey,
  resolveClassKeyForAssignment,
} from './dedupe.js';

describe('buildClassDedupeKey', () => {
  it('prefers the Classroom course id above everything else', () => {
    expect(
      buildClassDedupeKey({
        sourceId: 'ABC123',
        canonicalUrl: 'https://classroom.google.com/c/ABC123',
        name: 'AP Calculus AB',
      }),
    ).toBe('id:ABC123');
  });

  it('falls back to the canonical URL, then the name', () => {
    expect(
      buildClassDedupeKey({
        sourceId: null,
        canonicalUrl: 'https://classroom.google.com/c/ABC123',
        name: 'AP Calculus AB',
      }),
    ).toBe('url:https://classroom.google.com/c/ABC123');

    expect(
      buildClassDedupeKey({ sourceId: null, canonicalUrl: null, name: 'AP Calculus AB' }),
    ).toBe('name:ap calculus ab');
  });

  it('normalizes case and whitespace in the name fallback', () => {
    const a = buildClassDedupeKey({ sourceId: null, canonicalUrl: null, name: 'AP  Calculus AB' });
    const b = buildClassDedupeKey({ sourceId: null, canonicalUrl: null, name: 'ap calculus ab ' });
    expect(a).toBe(b);
  });

  it('returns null when the class cannot be identified at all', () => {
    expect(buildClassDedupeKey({ sourceId: null, canonicalUrl: null, name: null })).toBeNull();
  });

  it('prefixes keys so an id can never collide with a URL or a name', () => {
    const byId = buildClassDedupeKey({ sourceId: 'X', canonicalUrl: null, name: null });
    const byName = buildClassDedupeKey({ sourceId: null, canonicalUrl: null, name: 'X' });
    expect(byId).not.toBe(byName);
  });
});

describe('buildAssignmentDedupeKey', () => {
  const classKey = 'id:ABC123';

  it('prefers the coursework id', () => {
    expect(
      buildAssignmentDedupeKey({
        sourceId: 'WORK1',
        canonicalUrl: 'https://classroom.google.com/c/ABC123/a/WORK1/details',
        classDedupeKey: classKey,
        title: 'Limits',
      }),
    ).toBe('id:WORK1');
  });

  it('scopes the title fallback to its class, so two classes can share a title', () => {
    const a = buildAssignmentDedupeKey({
      sourceId: null,
      canonicalUrl: null,
      classDedupeKey: 'id:CLASS_A',
      title: 'Chapter 1 Reading',
    });
    const b = buildAssignmentDedupeKey({
      sourceId: null,
      canonicalUrl: null,
      classDedupeKey: 'id:CLASS_B',
      title: 'Chapter 1 Reading',
    });
    expect(a).not.toBe(b);
  });

  it('returns null when nothing identifies the assignment', () => {
    expect(
      buildAssignmentDedupeKey({
        sourceId: null,
        canonicalUrl: null,
        classDedupeKey: classKey,
        title: null,
      }),
    ).toBeNull();
  });
});

describe('resolveClassKeyForAssignment', () => {
  it('uses the explicit class source id when present', () => {
    expect(
      resolveClassKeyForAssignment({
        classSourceId: 'ABC123',
        classCanonicalUrl: null,
        assignmentCanonicalUrl: null,
      }),
    ).toBe('id:ABC123');
  });

  it("recovers the course id from the assignment's own URL", () => {
    expect(
      resolveClassKeyForAssignment({
        classSourceId: null,
        classCanonicalUrl: null,
        assignmentCanonicalUrl:
          'https://classroom.google.com/c/Njk5MjM/a/NTQzMjE/details',
      }),
    ).toBe('id:Njk5MjM');
  });

  it('falls back to the class URL', () => {
    expect(
      resolveClassKeyForAssignment({
        classSourceId: null,
        classCanonicalUrl: 'https://classroom.google.com/c/Njk5MjM',
        assignmentCanonicalUrl: null,
      }),
    ).toBe('id:Njk5MjM');
  });

  it('returns null when the assignment cannot be attributed to any class', () => {
    expect(
      resolveClassKeyForAssignment({
        classSourceId: null,
        classCanonicalUrl: null,
        assignmentCanonicalUrl: null,
      }),
    ).toBeNull();
  });
});

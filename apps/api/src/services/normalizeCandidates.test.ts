import { describe, expect, it } from 'vitest';
import {
  assignmentCandidateSchema,
  classroomClassCandidateSchema,
} from '@classpilot/shared';
import {
  assignmentCandidate,
  classCandidate,
} from '../__tests__/helpers/fixtures.js';
import {
  normalizeAssignmentCandidate,
  normalizeClassCandidate,
} from './normalizeCandidates.js';

const NOW = new Date('2026-09-20T19:00:00.000Z');

/** Run a raw candidate through Zod exactly as a real request would. */
function parseClass(overrides: Parameters<typeof classCandidate>[0] = {}) {
  return classroomClassCandidateSchema.parse(classCandidate(overrides));
}
function parseAssignment(overrides: Parameters<typeof assignmentCandidate>[0] = {}) {
  return assignmentCandidateSchema.parse(assignmentCandidate(overrides));
}

describe('normalizeClassCandidate', () => {
  it('normalizes a well-formed class', () => {
    const result = normalizeClassCandidate(parseClass());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('AP Calculus AB');
    expect(result.value.sourceId).toBe('Njk5MjMxMjM');
    expect(result.value.canonicalUrl).toBe('https://classroom.google.com/c/Njk5MjMxMjM');
    expect(result.value.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('re-derives the source id from the URL rather than trusting the client', () => {
    const result = normalizeClassCandidate(
      parseClass({
        sourceId: 'LIES',
        canonicalUrl: 'https://classroom.google.com/c/TRUTH123',
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sourceId).toBe('TRUTH123');
  });

  it('strips the /u/<n> prefix when canonicalizing', () => {
    const result = normalizeClassCandidate(
      parseClass({ canonicalUrl: 'https://classroom.google.com/u/1/c/Njk5MjMxMjM' }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.canonicalUrl).toBe('https://classroom.google.com/c/Njk5MjMxMjM');
  });

  it('rejects a class with no usable name', () => {
    const result = normalizeClassCandidate(parseClass({ name: null }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('class_missing_name');
  });

  it('produces the same hash for the same content and a different one on change', () => {
    const a = normalizeClassCandidate(parseClass());
    const b = normalizeClassCandidate(parseClass());
    const c = normalizeClassCandidate(parseClass({ room: '999' }));
    expect(a.ok && b.ok && c.ok).toBe(true);
    if (!a.ok || !b.ok || !c.ok) return;
    expect(a.value.contentHash).toBe(b.value.contentHash);
    expect(a.value.contentHash).not.toBe(c.value.contentHash);
  });
});

describe('normalizeAssignmentCandidate', () => {
  it('normalizes a well-formed assignment', () => {
    const result = normalizeAssignmentCandidate(parseAssignment(), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe('Limits Worksheet');
    expect(result.value.sourceId).toBe('NTQzMjE5OA');
    expect(result.value.classSourceId).toBe('Njk5MjMxMjM');
    expect(result.value.dueAt?.toISOString()).toBe('2026-09-24T23:59:00.000Z');
    expect(result.value.pointsPossible).toBe(100);
  });

  it('rejects an assignment with no title', () => {
    const result = normalizeAssignmentCandidate(parseAssignment({ title: null }), NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('assignment_missing_title');
  });

  it('falls back to parsing the raw due label when no ISO instant is supplied', () => {
    const result = normalizeAssignmentCandidate(
      parseAssignment({ dueAtIso: null, dueLabel: 'Due Sep 24, 11:59 PM' }),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.dueAt).not.toBeNull();
    expect(result.value.dueAt?.getDate()).toBe(24);
    expect(result.value.dueLabel).toBe('Due Sep 24, 11:59 PM');
  });

  it('stores null rather than guessing when the due label is unparseable', () => {
    const result = normalizeAssignmentCandidate(
      parseAssignment({ dueAtIso: null, dueLabel: 'Due whenever' }),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.dueAt).toBeNull();
    // The label is still kept so a human can audit what we read.
    expect(result.value.dueLabel).toBe('Due whenever');
  });

  it('re-classifies attachments from the URL, ignoring the client hint', () => {
    const result = normalizeAssignmentCandidate(
      parseAssignment({
        attachments: [
          {
            name: 'Notes',
            url: 'https://docs.google.com/document/d/1abc/edit',
            mimeType: 'text/plain',
            provider: 'youtube',
            attachmentType: 'youtube',
          },
        ],
      }),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.attachments[0]).toMatchObject({
      attachmentType: 'google_doc',
      provider: 'google_docs',
      mimeType: 'application/vnd.google-apps.document',
    });
  });

  it('collapses duplicate attachment URLs', () => {
    const attachment = {
      name: 'Worksheet.pdf',
      url: 'https://drive.google.com/file/d/1abc/view',
      mimeType: null,
      provider: 'unknown' as const,
      attachmentType: 'unknown' as const,
    };
    const result = normalizeAssignmentCandidate(
      parseAssignment({ attachments: [attachment, { ...attachment }] }),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.attachments).toHaveLength(1);
  });

  it('treats an empty grade object as no grade', () => {
    const result = normalizeAssignmentCandidate(
      parseAssignment({ grade: { raw: null, earned: null, possible: null } }),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.grade).toBeNull();
  });

  it('keeps a real grade', () => {
    const result = normalizeAssignmentCandidate(
      parseAssignment({ grade: { raw: '92/100', earned: 92, possible: 100 } }),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.grade).toEqual({ raw: '92/100', earned: 92, possible: 100 });
  });

  it('coerces an unrecognized status to unknown instead of storing it', () => {
    const parsed = parseAssignment();
    // Simulate a payload that got past Zod with an out-of-vocabulary value.
    const tampered = { ...parsed, status: 'PWNED' as never };
    const result = normalizeAssignmentCandidate(tampered, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('unknown');
  });

  it('changes the content hash when a meaningful field changes', () => {
    const a = normalizeAssignmentCandidate(parseAssignment(), NOW);
    const b = normalizeAssignmentCandidate(parseAssignment({ pointsPossible: 50 }), NOW);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.value.contentHash).not.toBe(b.value.contentHash);
  });

  it('does NOT change the content hash when only the due label wording changes', () => {
    // dueLabel is presentational; dueAt is the fact. Hashing the label would
    // make every re-render of "Due Tomorrow" look like a real change.
    const a = normalizeAssignmentCandidate(parseAssignment(), NOW);
    const b = normalizeAssignmentCandidate(
      parseAssignment({ dueLabel: 'Due Thursday, 11:59 PM' }),
      NOW,
    );
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.value.contentHash).toBe(b.value.contentHash);
  });
});

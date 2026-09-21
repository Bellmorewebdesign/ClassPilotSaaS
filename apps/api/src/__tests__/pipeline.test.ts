import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { syncClassroomBatchRequestSchema } from '@classpilot/shared';
import {
  buildAssignmentDedupeKey,
  buildClassDedupeKey,
  resolveClassKeyForAssignment,
} from '../services/dedupe.js';
import {
  normalizeAssignmentCandidate,
  normalizeClassCandidate,
} from '../services/normalizeCandidates.js';

/**
 * End-to-end pipeline test, minus persistence.
 *
 * Runs a REAL recorded extension payload (see fixtures/README.md) through the
 * API's full ingestion path: Zod validation, normalization, and dedupe-key
 * derivation. It stops short of the database, which the suite in
 * syncService.test.ts covers when one is available.
 *
 * What this proves without needing MongoDB: the extension's actual output is
 * accepted, normalizes to sensible records, and produces the dedupe keys that
 * make re-syncing idempotent.
 */

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const rawPayload: unknown = JSON.parse(
  readFileSync(join(fixturesDir, 'extension-payload.json'), 'utf8'),
);

/** Fixed clock so due-date normalization is deterministic. */
const NOW = new Date(2026, 8, 20, 19, 0, 0);

describe('API ingestion pipeline against real extension output', () => {
  it('accepts the recorded payload', () => {
    const result = syncClassroomBatchRequestSchema.safeParse(rawPayload);
    if (!result.success) {
      throw new Error(
        `recorded extension payload rejected:\n${result.error.issues
          .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
          .join('\n')}`,
      );
    }
    expect(result.data.classes).toHaveLength(4);
    expect(result.data.assignments).toHaveLength(3);
  });

  it('normalizes every class without rejecting any', () => {
    const payload = syncClassroomBatchRequestSchema.parse(rawPayload);
    for (const candidate of payload.classes) {
      const result = normalizeClassCandidate(candidate);
      expect(result.ok).toBe(true);
    }
  });

  it('collapses the same class arriving from two different pages', () => {
    const payload = syncClassroomBatchRequestSchema.parse(rawPayload);

    // "AP Calculus AB" is discovered twice: once as a home-page card and once
    // from its own class page. Both must produce the SAME dedupe key, or the
    // dashboard would show the class twice after a single sync.
    const keys = payload.classes
      .map((candidate) => normalizeClassCandidate(candidate))
      .filter((result) => result.ok)
      .map((result) => buildClassDedupeKey(result.value));

    expect(keys).toHaveLength(4);
    expect(new Set(keys).size).toBe(3);
    expect(keys.filter((key) => key === 'id:Njk5MjMxMjM')).toHaveLength(2);
  });

  it('normalizes every assignment without rejecting any', () => {
    const payload = syncClassroomBatchRequestSchema.parse(rawPayload);
    for (const candidate of payload.assignments) {
      const result = normalizeAssignmentCandidate(candidate, NOW);
      expect(result.ok).toBe(true);
    }
  });

  it('attributes every assignment to a class that the payload also carries', () => {
    const payload = syncClassroomBatchRequestSchema.parse(rawPayload);

    const classKeys = new Set(
      payload.classes
        .map((candidate) => normalizeClassCandidate(candidate))
        .filter((result) => result.ok)
        .map((result) => buildClassDedupeKey(result.value)),
    );

    for (const candidate of payload.assignments) {
      const result = normalizeAssignmentCandidate(candidate, NOW);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;

      const classKey = resolveClassKeyForAssignment({
        classSourceId: result.value.classSourceId,
        classCanonicalUrl: result.value.classCanonicalUrl,
        assignmentCanonicalUrl: result.value.canonicalUrl,
      });

      // An assignment whose class key is not in the payload would be rejected
      // at ingest as assignment_class_not_found.
      expect(classKey).not.toBeNull();
      expect(classKeys.has(classKey!)).toBe(true);
    }
  });

  it('gives every assignment a stable, unique dedupe key', () => {
    const payload = syncClassroomBatchRequestSchema.parse(rawPayload);

    const keys = payload.assignments.map((candidate) => {
      const result = normalizeAssignmentCandidate(candidate, NOW);
      if (!result.ok) throw new Error(result.reason);
      const classKey = resolveClassKeyForAssignment({
        classSourceId: result.value.classSourceId,
        classCanonicalUrl: result.value.classCanonicalUrl,
        assignmentCanonicalUrl: result.value.canonicalUrl,
      })!;
      return buildAssignmentDedupeKey({
        sourceId: result.value.sourceId,
        canonicalUrl: result.value.canonicalUrl,
        classDedupeKey: classKey,
        title: result.value.title,
      });
    });

    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(3);
    expect(keys.every((key) => key?.startsWith('id:'))).toBe(true);
  });

  it('produces identical content hashes on a second pass (idempotency)', () => {
    const payload = syncClassroomBatchRequestSchema.parse(rawPayload);

    const hashOnce = payload.assignments.map((candidate) => {
      const result = normalizeAssignmentCandidate(candidate, NOW);
      return result.ok ? result.value.contentHash : null;
    });
    const hashTwice = payload.assignments.map((candidate) => {
      const result = normalizeAssignmentCandidate(candidate, NOW);
      return result.ok ? result.value.contentHash : null;
    });

    expect(hashOnce).toEqual(hashTwice);
    expect(hashOnce.every((hash) => hash !== null)).toBe(true);
  });

  it('carries the fields the dashboard actually renders', () => {
    const payload = syncClassroomBatchRequestSchema.parse(rawPayload);
    const worksheet = payload.assignments.find((a) => a.title === 'Limits Worksheet');
    expect(worksheet).toBeDefined();

    const result = normalizeAssignmentCandidate(worksheet!, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.title).toBe('Limits Worksheet');
    expect(result.value.instructions).toContain('Complete problems 1 through 20');
    expect(result.value.pointsPossible).toBe(100);
    expect(result.value.status).toBe('assigned');
    expect(result.value.dueAt).not.toBeNull();
    expect(result.value.attachments).toHaveLength(4);
    expect(result.value.attachments.map((a) => a.attachmentType).sort()).toEqual([
      'google_slides',
      'pdf',
      'pdf',
      'youtube',
    ]);
  });

  it('preserves nulls for a sparse assignment instead of inventing values', () => {
    const payload = syncClassroomBatchRequestSchema.parse(rawPayload);
    const reading = payload.assignments.find((a) => a.title === 'Chapter 4 Reading');
    const result = normalizeAssignmentCandidate(reading!, NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.dueAt).toBeNull();
    expect(result.value.pointsPossible).toBeNull();
    expect(result.value.instructions).toBeNull();
    expect(result.value.grade).toBeNull();
    expect(result.value.attachments).toEqual([]);
  });

  it('reads the grade off the returned assignment', () => {
    const payload = syncClassroomBatchRequestSchema.parse(rawPayload);
    const quiz = payload.assignments.find((a) => a.title === 'Derivatives Quiz');
    const result = normalizeAssignmentCandidate(quiz!, NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('returned');
    expect(result.value.grade).toEqual({ raw: '92/100', earned: 92, possible: 100 });
  });
});

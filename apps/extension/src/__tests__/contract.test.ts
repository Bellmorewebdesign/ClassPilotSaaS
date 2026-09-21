import { describe, expect, it } from 'vitest';
import {
  syncClassroomBatchRequestSchema,
  type SyncClassroomBatchRequest,
} from '@classpilot/shared';
import { extractAssignmentPage } from '../extractors/assignmentPage.js';
import { extractClassPage } from '../extractors/classPage.js';
import { extractClassroomHome } from '../extractors/classroomHome.js';
import { extractClassworkPage } from '../extractors/classworkPage.js';
import { loadFixture } from './helpers/loadFixture.js';

/**
 * Contract test: extractor output must satisfy the API's wire schema.
 *
 * This is the seam where a sync fails at runtime with a 400 that no unit test
 * would catch. The extractors and the API agree on @classpilot/shared's Zod
 * schemas, so here we run the real extractors against fixtures, assemble the
 * exact payload the sync engine would POST, and parse it with the exact
 * schema the API uses.
 *
 * If this passes, a real sync cannot be rejected for being malformed.
 */

const NOW = new Date(2026, 8, 20, 19, 0, 0);
const HOME_URL = 'https://classroom.google.com/h';
const CLASSWORK_URL = 'https://classroom.google.com/w/Njk5MjMxMjM/t/all';
const ASSIGNMENT_URL =
  'https://classroom.google.com/c/Njk5MjMxMjM/a/NTQzMjE5OA/details';
const CLASS_URL = 'https://classroom.google.com/c/Njk5MjMxMjM';

/** Assemble a payload the way the sync engine does. */
function buildPayload(): SyncClassroomBatchRequest {
  const home = extractClassroomHome(loadFixture('classroom-home.html', HOME_URL, NOW));
  const classPage = extractClassPage(loadFixture('class-page.html', CLASS_URL, NOW));

  const assignments = [
    extractAssignmentPage(loadFixture('assignment-page.html', ASSIGNMENT_URL, NOW)),
    extractAssignmentPage(
      loadFixture(
        'assignment-page-graded.html',
        'https://classroom.google.com/c/Njk5MjMxMjM/a/MjIyMjIyMg/details',
        NOW,
      ),
    ),
    extractAssignmentPage(
      loadFixture(
        'assignment-page-minimal.html',
        'https://classroom.google.com/c/Njk5MjMxMjM/a/MTExMTExMQ/details',
        NOW,
      ),
    ),
  ]
    .map((result) => result.candidate)
    .filter((candidate) => candidate !== null);

  return {
    syncId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
    startedAt: NOW.toISOString(),
    classes: [
      ...home.result.classes,
      ...(classPage.candidate ? [classPage.candidate] : []),
    ],
    assignments,
    warnings: [
      {
        code: 'assignment_load_failed',
        message: 'One assignment page did not load: Timed out waiting for the page to load.',
        url: 'https://classroom.google.com/c/Njk5MjMxMjM/a/OTk5OTk5OQ/details',
      },
    ],
    clientVersion: '0.1.0',
    batchIndex: 0,
    final: true,
  };
}

describe('extension output satisfies the API wire contract', () => {
  it('a realistic full payload parses cleanly', () => {
    const result = syncClassroomBatchRequestSchema.safeParse(buildPayload());

    if (!result.success) {
      // Surface the offending field rather than a wall of Zod output.
      throw new Error(
        `payload rejected:\n${result.error.issues
          .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
          .join('\n')}`,
      );
    }

    expect(result.success).toBe(true);
    expect(result.data.classes.length).toBeGreaterThan(0);
    expect(result.data.assignments.length).toBe(3);
  });

  it('every discovered class parses individually', () => {
    const { result } = extractClassroomHome(
      loadFixture('classroom-home.html', HOME_URL, NOW),
    );

    for (const klass of result.classes) {
      const parsed = syncClassroomBatchRequestSchema.safeParse({
        syncId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
        classes: [klass],
        assignments: [],
      });
      expect(parsed.success).toBe(true);
    }
  });

  it('classwork discovery produces URLs the assignment schema accepts', () => {
    const { result } = extractClassworkPage(
      loadFixture('classwork-page.html', CLASSWORK_URL, NOW),
    );

    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      // The sync engine navigates to exactly this URL, so it must be an
      // absolute http(s) URL the API would also accept.
      expect(() => new URL(item.canonicalUrl)).not.toThrow();
      expect(item.canonicalUrl.startsWith('https://classroom.google.com/')).toBe(true);
    }
  });

  it('a sparse assignment (all nulls) still satisfies the contract', () => {
    const { candidate } = extractAssignmentPage(
      loadFixture(
        'assignment-page-minimal.html',
        'https://classroom.google.com/c/Njk5MjMxMjM/a/MTExMTExMQ/details',
        NOW,
      ),
    );

    const parsed = syncClassroomBatchRequestSchema.safeParse({
      syncId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
      classes: [],
      assignments: [candidate],
    });
    expect(parsed.success).toBe(true);
  });

  it('extraction reports stay within the schema size caps', () => {
    const payload = buildPayload();
    const parsed = syncClassroomBatchRequestSchema.safeParse(payload);
    expect(parsed.success).toBe(true);

    for (const assignment of payload.assignments ?? []) {
      expect(assignment.extraction.provenance!.length).toBeLessThanOrEqual(60);
      expect(assignment.extraction.warnings!.length).toBeLessThanOrEqual(50);
    }
  });

  it('a payload carrying a dangerous attachment URL is REJECTED', () => {
    const { candidate } = extractAssignmentPage(
      loadFixture('assignment-page.html', ASSIGNMENT_URL, NOW),
    );
    const tampered = {
      ...candidate!,
      attachments: [
        {
          name: 'Evil',
          url: 'javascript:alert(document.cookie)',
          mimeType: null,
          provider: 'unknown' as const,
          attachmentType: 'unknown' as const,
        },
      ],
    };

    const parsed = syncClassroomBatchRequestSchema.safeParse({
      syncId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
      classes: [],
      assignments: [tampered],
    });
    // The contract is the last line of defence even if an extractor is
    // compromised or a page is hostile.
    expect(parsed.success).toBe(false);
  });
});

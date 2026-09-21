import type {
  AssignmentCandidateInput,
  ClassroomClassCandidateInput,
  ExtractionReportInput,
  SyncClassroomBatchRequest,
} from '@classpilot/shared';

/**
 * Payload builders for tests.
 *
 * These produce the exact shape the extension sends, so a test that passes
 * here reflects what will happen with a real sync.
 */

export function extractionReport(
  overrides: Partial<ExtractionReportInput> = {},
): ExtractionReportInput {
  return {
    extractor: 'test',
    version: '1.0.0',
    pageUrl: null,
    provenance: [],
    warnings: [],
    durationMs: 1,
    ...overrides,
  };
}

export function classCandidate(
  overrides: Partial<ClassroomClassCandidateInput> = {},
): ClassroomClassCandidateInput {
  return {
    sourceId: 'Njk5MjMxMjM',
    canonicalUrl: 'https://classroom.google.com/c/Njk5MjMxMjM',
    name: 'AP Calculus AB',
    section: 'Period 3',
    teacherName: 'Mr. Rivera',
    room: '204',
    description: null,
    extraction: extractionReport({ extractor: 'classroomHome' }),
    ...overrides,
  };
}

export function assignmentCandidate(
  overrides: Partial<AssignmentCandidateInput> = {},
): AssignmentCandidateInput {
  return {
    sourceId: 'NTQzMjE5OA',
    canonicalUrl:
      'https://classroom.google.com/c/Njk5MjMxMjM/a/NTQzMjE5OA/details',
    classSourceId: 'Njk5MjMxMjM',
    classCanonicalUrl: 'https://classroom.google.com/c/Njk5MjMxMjM',
    title: 'Limits Worksheet',
    instructions: 'Complete problems 1-20 and show all work.',
    assignmentType: 'assignment',
    topic: 'Unit 1: Limits',
    dueAtIso: '2026-09-24T23:59:00.000Z',
    dueLabel: 'Due Sep 24, 11:59 PM',
    pointsPossible: 100,
    status: 'assigned',
    grade: null,
    attachments: [
      {
        name: 'Limits Worksheet.pdf',
        url: 'https://drive.google.com/file/d/1abcdef/view',
        mimeType: null,
        provider: 'unknown',
        attachmentType: 'unknown',
      },
    ],
    extraction: extractionReport({ extractor: 'assignmentPage' }),
    ...overrides,
  };
}

let syncCounter = 0;

export function syncPayload(
  overrides: Partial<SyncClassroomBatchRequest> = {},
): SyncClassroomBatchRequest {
  syncCounter += 1;
  return {
    syncId: `test-sync-${String(syncCounter).padStart(6, '0')}`,
    startedAt: '2026-09-20T19:32:00.000Z',
    classes: [classCandidate()],
    assignments: [assignmentCandidate()],
    warnings: [],
    clientVersion: '0.1.0',
    batchIndex: 0,
    final: true,
    ...overrides,
  };
}

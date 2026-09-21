import mongoose from 'mongoose';
import type { Types } from 'mongoose';

/**
 * Mongoose ships as CommonJS, so ESM named value imports of its runtime
 * exports are not reliably available. Runtime use goes through the default
 * import (`mongoose.Types.ObjectId`); `Types` is imported as a type only.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  syncClassroomBatchRequestSchema,
  type ParsedSyncClassroomBatchRequest,
} from '@classpilot/shared';
import { loadEnv, type AppEnv } from '../config/env.js';
import { Assignment, ClassroomClass, SyncRun } from '../models/index.js';
import { ingestSync } from '../services/syncService.js';
import {
  assignmentCandidate,
  classCandidate,
  syncPayload,
} from './helpers/fixtures.js';
import {
  clearTestDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
  silentLogger,
  syncTestIndexes,
} from './helpers/mongo.js';

/**
 * Sync ingestion against a real MongoDB.
 *
 * These are the tests that prove the product's central promise: "re-syncing
 * does not duplicate everything". They need a real database because the
 * duplicate-prevention guarantee is a unique index, not application logic.
 *
 * See helpers/mongo.ts for how to point them at a database.
 */

const dbAvailable = await connectTestDatabase();

const env: AppEnv = loadEnv({
  MONGODB_URI: 'mongodb://localhost:27017/ignored-in-tests',
  AUTH_MODE: 'dev',
  DEV_EXTENSION_TOKEN: 'x'.repeat(64),
} as NodeJS.ProcessEnv);

const NOW = new Date('2026-09-20T19:32:00.000Z');

function parse(overrides: Parameters<typeof syncPayload>[0] = {}): ParsedSyncClassroomBatchRequest {
  return syncClassroomBatchRequestSchema.parse(syncPayload(overrides));
}

function ingest(
  userId: Types.ObjectId,
  payload: ParsedSyncClassroomBatchRequest,
  options: { isFinal?: boolean; now?: Date } = {},
) {
  return ingestSync({
    userId,
    payload,
    logger: silentLogger(),
    env,
    isFinal: options.isFinal ?? true,
    now: options.now ?? NOW,
  });
}

describe.skipIf(!dbAvailable)('ingestSync', () => {
  const userA = new mongoose.Types.ObjectId();
  const userB = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    await syncTestIndexes();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  // --- Basic storage ------------------------------------------------------

  it('stores a class and its assignment', async () => {
    const result = await ingest(userA, parse());

    expect(result.classesCreated).toBe(1);
    expect(result.assignmentsCreated).toBe(1);
    expect(result.rejected).toEqual([]);
    expect(result.totals).toEqual({ classes: 1, assignments: 1 });

    const klass = await ClassroomClass.findOne({ userId: userA }).lean();
    expect(klass?.name).toBe('AP Calculus AB');
    expect(klass?.dedupeKey).toBe('id:Njk5MjMxMjM');
    expect(klass?.firstSeenAt.toISOString()).toBe(NOW.toISOString());

    const assignment = await Assignment.findOne({ userId: userA }).lean();
    expect(assignment?.title).toBe('Limits Worksheet');
    expect(assignment?.classId.toString()).toBe(klass?._id.toString());
    expect(assignment?.attachments).toHaveLength(1);
    expect(assignment?.attachments[0]?.attachmentType).toBe('pdf');
  });

  // --- Idempotency --------------------------------------------------------

  it('is idempotent: syncing identical data twice creates nothing new', async () => {
    await ingest(userA, parse());
    const second = await ingest(userA, parse());

    expect(second.classesCreated).toBe(0);
    expect(second.assignmentsCreated).toBe(0);
    expect(second.assignmentsUnchanged).toBe(1);

    expect(await ClassroomClass.countDocuments({ userId: userA })).toBe(1);
    expect(await Assignment.countDocuments({ userId: userA })).toBe(1);
  });

  it('is idempotent across ten repeated syncs', async () => {
    for (let i = 0; i < 10; i += 1) {
      await ingest(userA, parse());
    }
    expect(await ClassroomClass.countDocuments({ userId: userA })).toBe(1);
    expect(await Assignment.countDocuments({ userId: userA })).toBe(1);
  });

  it('treats the /u/<n> spelling of a URL as the same class', async () => {
    await ingest(userA, parse());
    await ingest(
      userA,
      parse({
        classes: [
          classCandidate({
            sourceId: null,
            canonicalUrl: 'https://classroom.google.com/u/3/c/Njk5MjMxMjM',
          }),
        ],
        assignments: [],
      }),
    );
    expect(await ClassroomClass.countDocuments({ userId: userA })).toBe(1);
  });

  it('moves lastSeenAt forward on an unchanged re-sync without touching firstSeenAt', async () => {
    await ingest(userA, parse(), { now: NOW });

    const later = new Date(NOW.getTime() + 3_600_000);
    await ingest(userA, parse(), { now: later });

    const assignment = await Assignment.findOne({ userId: userA }).lean();
    expect(assignment?.firstSeenAt.toISOString()).toBe(NOW.toISOString());
    expect(assignment?.lastSeenAt.toISOString()).toBe(later.toISOString());
    expect(assignment?.lastSyncedAt.toISOString()).toBe(later.toISOString());
  });

  // --- Change detection ---------------------------------------------------

  it('reports an update and rewrites the row when content changes', async () => {
    await ingest(userA, parse());

    const changed = await ingest(
      userA,
      parse({
        assignments: [
          assignmentCandidate({ title: 'Limits Worksheet (revised)', pointsPossible: 50 }),
        ],
      }),
    );

    expect(changed.assignmentsCreated).toBe(0);
    expect(changed.assignmentsUpdated).toBe(1);
    expect(changed.assignmentsUnchanged).toBe(0);

    const assignment = await Assignment.findOne({ userId: userA }).lean();
    expect(assignment?.title).toBe('Limits Worksheet (revised)');
    expect(assignment?.pointsPossible).toBe(50);
    expect(await Assignment.countDocuments({ userId: userA })).toBe(1);
  });

  it('detects a due-date change', async () => {
    await ingest(userA, parse());
    const result = await ingest(
      userA,
      parse({
        assignments: [assignmentCandidate({ dueAtIso: '2026-09-26T23:59:00.000Z' })],
      }),
    );
    expect(result.assignmentsUpdated).toBe(1);

    const assignment = await Assignment.findOne({ userId: userA }).lean();
    expect(assignment?.dueAt?.toISOString()).toBe('2026-09-26T23:59:00.000Z');
  });

  it('detects an added attachment', async () => {
    await ingest(userA, parse());
    const result = await ingest(
      userA,
      parse({
        assignments: [
          assignmentCandidate({
            attachments: [
              {
                name: 'Limits Worksheet.pdf',
                url: 'https://drive.google.com/file/d/1abcdef/view',
                mimeType: null,
                provider: 'unknown',
                attachmentType: 'unknown',
              },
              {
                name: 'Review Slides',
                url: 'https://docs.google.com/presentation/d/1xyz/edit',
                mimeType: null,
                provider: 'unknown',
                attachmentType: 'unknown',
              },
            ],
          }),
        ],
      }),
    );
    expect(result.assignmentsUpdated).toBe(1);

    const assignment = await Assignment.findOne({ userId: userA }).lean();
    expect(assignment?.attachments).toHaveLength(2);
    expect(assignment?.attachments[1]?.attachmentType).toBe('google_slides');
  });

  it('does not count a re-sync as an update when only the due label wording changes', async () => {
    await ingest(userA, parse());
    const result = await ingest(
      userA,
      parse({ assignments: [assignmentCandidate({ dueLabel: 'Due Thursday, 11:59 PM' })] }),
    );
    expect(result.assignmentsUnchanged).toBe(1);
    expect(result.assignmentsUpdated).toBe(0);
  });

  // --- Duplicate prevention ----------------------------------------------

  it('does not create two classes when the same class appears twice in one payload', async () => {
    const result = await ingest(
      userA,
      parse({ classes: [classCandidate(), classCandidate()], assignments: [] }),
    );
    expect(result.classesCreated).toBe(1);
    expect(await ClassroomClass.countDocuments({ userId: userA })).toBe(1);
  });

  it('keeps one row when an assignment has no id and is matched by title', async () => {
    const noIdAssignment = assignmentCandidate({
      sourceId: null,
      canonicalUrl: null,
      classSourceId: 'Njk5MjMxMjM',
    });
    await ingest(userA, parse({ assignments: [noIdAssignment] }));
    await ingest(userA, parse({ assignments: [noIdAssignment] }));
    expect(await Assignment.countDocuments({ userId: userA })).toBe(1);
  });

  it('enforces uniqueness at the database level, not just in application code', async () => {
    await ingest(userA, parse());
    const existing = await ClassroomClass.findOne({ userId: userA }).lean();

    await expect(
      ClassroomClass.create({
        userId: userA,
        source: 'google_classroom_browser',
        dedupeKey: existing!.dedupeKey,
        sourceId: existing!.sourceId,
        canonicalUrl: existing!.canonicalUrl,
        name: 'Sneaky Duplicate',
        section: null,
        teacherName: null,
        room: null,
        description: null,
        contentHash: 'deadbeef',
        firstSeenAt: NOW,
        lastSeenAt: NOW,
        lastSyncedAt: NOW,
      }),
    ).rejects.toThrow(/duplicate key/i);
  });

  // --- User isolation -----------------------------------------------------

  it('keeps two users completely separate even with identical Classroom data', async () => {
    await ingest(userA, parse());
    await ingest(userB, parse());

    expect(await ClassroomClass.countDocuments({ userId: userA })).toBe(1);
    expect(await ClassroomClass.countDocuments({ userId: userB })).toBe(1);
    expect(await ClassroomClass.countDocuments({})).toBe(2);

    const aClass = await ClassroomClass.findOne({ userId: userA }).lean();
    const bClass = await ClassroomClass.findOne({ userId: userB }).lean();
    expect(aClass!._id.toString()).not.toBe(bClass!._id.toString());
  });

  it("one user's update never touches another user's row", async () => {
    await ingest(userA, parse());
    await ingest(userB, parse());

    await ingest(
      userB,
      parse({ assignments: [assignmentCandidate({ title: 'B-only edit' })] }),
    );

    const aAssignment = await Assignment.findOne({ userId: userA }).lean();
    const bAssignment = await Assignment.findOne({ userId: userB }).lean();
    expect(aAssignment?.title).toBe('Limits Worksheet');
    expect(bAssignment?.title).toBe('B-only edit');
  });

  it('never links an assignment to a class belonging to a different user', async () => {
    // User A syncs the class; user B syncs only the assignment for it.
    await ingest(userA, parse({ assignments: [] }));
    const result = await ingest(userB, parse({ classes: [], assignments: [assignmentCandidate()] }));

    expect(result.assignmentsCreated).toBe(0);
    expect(result.rejected).toEqual([
      expect.objectContaining({ kind: 'assignment', reason: 'assignment_class_not_found' }),
    ]);
    expect(await Assignment.countDocuments({ userId: userB })).toBe(0);
  });

  // --- Partial failure tolerance -----------------------------------------

  it('rejects one bad record and still stores the rest', async () => {
    const result = await ingest(
      userA,
      parse({
        assignments: [
          assignmentCandidate(),
          assignmentCandidate({ sourceId: 'OTHER1', canonicalUrl: null, title: null }),
          assignmentCandidate({
            sourceId: 'OTHER2',
            canonicalUrl:
              'https://classroom.google.com/c/Njk5MjMxMjM/a/OTHER2/details',
            title: 'Homework 2',
          }),
        ],
      }),
    );

    expect(result.assignmentsCreated).toBe(2);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.reason).toBe('assignment_missing_title');
    expect(await Assignment.countDocuments({ userId: userA })).toBe(2);
  });

  it('rejects an assignment whose class was never synced, without failing the run', async () => {
    const result = await ingest(
      userA,
      parse({
        classes: [],
        assignments: [assignmentCandidate()],
      }),
    );
    expect(result.rejected[0]?.reason).toBe('assignment_class_not_found');
    expect(result.status).toBe('completed_with_warnings');
  });

  // --- Batching -----------------------------------------------------------

  it('stitches multiple batches into one sync run', async () => {
    const syncId = 'batched-sync-0001';

    await ingest(
      userA,
      parse({ syncId, classes: [classCandidate()], assignments: [], batchIndex: 0, final: false }),
      { isFinal: false },
    );
    await ingest(
      userA,
      parse({ syncId, classes: [], assignments: [assignmentCandidate()], batchIndex: 1, final: true }),
      { isFinal: true },
    );

    const runs = await SyncRun.find({ userId: userA }).lean();
    expect(runs).toHaveLength(1);
    expect(runs[0]?.batchesReceived).toBe(2);
    expect(runs[0]?.classesCreated).toBe(1);
    expect(runs[0]?.assignmentsCreated).toBe(1);
    expect(runs[0]?.status).toBe('completed');
    expect(runs[0]?.finishedAt).not.toBeNull();
  });

  it('an assignment in a later batch finds a class synced in an earlier one', async () => {
    const syncId = 'batched-sync-0002';
    await ingest(
      userA,
      parse({ syncId, classes: [classCandidate()], assignments: [], final: false }),
      { isFinal: false },
    );
    const second = await ingest(
      userA,
      parse({ syncId, classes: [], assignments: [assignmentCandidate()], final: true }),
      { isFinal: true },
    );
    expect(second.assignmentsCreated).toBe(1);
    expect(second.rejected).toEqual([]);
  });

  it('records warnings and downgrades the run status', async () => {
    const result = await ingest(
      userA,
      parse({
        warnings: [
          { code: 'assignment_page_timeout', message: 'One assignment page timed out.', url: null },
        ],
      }),
    );
    expect(result.status).toBe('completed_with_warnings');

    const run = await SyncRun.findOne({ userId: userA }).lean();
    expect(run?.warnings).toHaveLength(1);
    expect(run?.warnings[0]?.code).toBe('assignment_page_timeout');
  });

  it('leaves the run "running" until a final batch arrives', async () => {
    const syncId = 'batched-sync-0003';
    const result = await ingest(userA, parse({ syncId, final: false }), { isFinal: false });
    expect(result.status).toBe('running');

    const run = await SyncRun.findOne({ userId: userA, syncId }).lean();
    expect(run?.finishedAt).toBeNull();
  });

  // --- Debug mode ---------------------------------------------------------

  it('stores extraction reports only when SCRAPER_DEBUG is on', async () => {
    await ingest(userA, parse({ syncId: 'debug-off-0001' }));
    const off = await SyncRun.findOne({ userId: userA, syncId: 'debug-off-0001' }).lean();
    expect(off?.extractionReports).toHaveLength(0);

    const debugEnv: AppEnv = { ...env, SCRAPER_DEBUG: true };
    await ingestSync({
      userId: userA,
      payload: parse({ syncId: 'debug-on-0001' }),
      logger: silentLogger(),
      env: debugEnv,
      isFinal: true,
      now: NOW,
    });
    const on = await SyncRun.findOne({ userId: userA, syncId: 'debug-on-0001' }).lean();
    expect(on!.extractionReports.length).toBeGreaterThan(0);
  });
});

import type { Types } from 'mongoose';

/**
 * Mongoose ships as CommonJS, so ESM named value imports of its runtime
 * exports are not reliably available. Only the `Types` type is needed here,
 * which imports normally.
 */
import type {
  ParsedSyncClassroomBatchRequest,
  SyncResultDto,
  SyncRunStatus,
} from '@classpilot/shared';
import type { AppEnv } from '../config/env.js';
import { SYNC_EVENTS, type SyncLogger } from '../lib/logger.js';
import {
  Assignment,
  ClassroomClass,
  SyncRun,
  type ClassroomClassDoc,
} from '../models/index.js';
import {
  buildAssignmentDedupeKey,
  buildClassDedupeKey,
  resolveClassKeyForAssignment,
} from './dedupe.js';
import {
  normalizeAssignmentCandidate,
  normalizeClassCandidate,
  type NormalizedAssignment,
  type NormalizedClass,
} from './normalizeCandidates.js';

/**
 * Sync ingestion.
 *
 * Guarantees this service provides:
 *
 *  - Idempotent. Syncing the same Classroom twice creates nothing new; it
 *    only moves `lastSeenAt` / `lastSyncedAt` forward.
 *  - Change-aware. `contentHash` distinguishes "seen again" from "changed",
 *    which is what the popup's "4 new / 2 updated" counters report.
 *  - User-scoped. Every query filters on `userId`; no code path can read or
 *    write another user's rows.
 *  - Partially tolerant. One unusable record is rejected with a reason and
 *    the remaining 99 still land. A single bad assignment never aborts a sync.
 */

const MAX_STORED_WARNINGS = 200;

export interface IngestParams {
  userId: Types.ObjectId;
  payload: ParsedSyncClassroomBatchRequest;
  logger: SyncLogger;
  env: AppEnv;
  /** Marks the sync run finished. True for the single-shot endpoint. */
  isFinal: boolean;
  /** Injectable for deterministic tests. */
  now?: Date;
}

interface Counters {
  classesSeen: number;
  assignmentsSeen: number;
  classesCreated: number;
  classesUpdated: number;
  assignmentsCreated: number;
  assignmentsUpdated: number;
  assignmentsUnchanged: number;
}

type Rejection = SyncResultDto['rejected'][number];

export async function ingestSync(params: IngestParams): Promise<SyncResultDto> {
  const { userId, payload, logger, env, isFinal } = params;
  const now = params.now ?? new Date();
  const syncLogger = logger.child({ syncId: payload.syncId, userId: userId.toString() });

  const counters: Counters = {
    classesSeen: 0,
    assignmentsSeen: 0,
    classesCreated: 0,
    classesUpdated: 0,
    assignmentsCreated: 0,
    assignmentsUpdated: 0,
    assignmentsUnchanged: 0,
  };
  const rejected: Rejection[] = [];

  const startedAt = payload.startedAt ? new Date(payload.startedAt) : now;
  const isNewRun = await openSyncRun({
    userId,
    syncId: payload.syncId,
    startedAt,
    clientVersion: payload.clientVersion,
  });

  if (isNewRun) {
    syncLogger.info(
      { event: SYNC_EVENTS.started, clientVersion: payload.clientVersion },
      'sync started',
    );
  }
  syncLogger.info(
    {
      event: SYNC_EVENTS.batch,
      batchIndex: payload.batchIndex,
      classes: payload.classes.length,
      assignments: payload.assignments.length,
      final: isFinal,
    },
    'sync batch received',
  );

  // --- Phase 1: classes ---------------------------------------------------
  // Classes go first so assignments in the same batch can resolve their
  // parent immediately.
  for (const candidate of payload.classes) {
    counters.classesSeen += 1;
    const normalized = normalizeClassCandidate(candidate);
    if (!normalized.ok) {
      rejected.push({ kind: 'class', reason: normalized.reason, url: normalized.url });
      syncLogger.warn(
        { event: SYNC_EVENTS.rejected, kind: 'class', reason: normalized.reason },
        'class rejected',
      );
      continue;
    }

    const dedupeKey = buildClassDedupeKey(normalized.value);
    if (!dedupeKey) {
      rejected.push({
        kind: 'class',
        reason: 'class_not_identifiable',
        url: normalized.value.canonicalUrl,
      });
      continue;
    }

    const outcome = await upsertClass({
      userId,
      dedupeKey,
      normalized: normalized.value,
      now,
    });

    if (outcome === 'created') {
      counters.classesCreated += 1;
      syncLogger.info(
        { event: SYNC_EVENTS.classDiscovered, classSourceId: normalized.value.sourceId },
        'class discovered',
      );
    } else if (outcome === 'updated') {
      counters.classesUpdated += 1;
      syncLogger.info(
        { event: SYNC_EVENTS.classUpdated, classSourceId: normalized.value.sourceId },
        'class updated',
      );
    }
  }

  // --- Phase 2: assignments ----------------------------------------------
  // Parent-class lookups are cached per request; a 60-assignment batch from
  // one class then costs one query instead of sixty.
  const classCache = new Map<string, ClassroomClassDoc | null>();

  for (const candidate of payload.assignments) {
    counters.assignmentsSeen += 1;
    const normalized = normalizeAssignmentCandidate(candidate, now);
    if (!normalized.ok) {
      rejected.push({
        kind: 'assignment',
        reason: normalized.reason,
        url: normalized.url,
      });
      syncLogger.warn(
        { event: SYNC_EVENTS.rejected, kind: 'assignment', reason: normalized.reason },
        'assignment rejected',
      );
      continue;
    }

    const classKey = resolveClassKeyForAssignment({
      classSourceId: normalized.value.classSourceId,
      classCanonicalUrl: normalized.value.classCanonicalUrl,
      assignmentCanonicalUrl: normalized.value.canonicalUrl,
    });

    if (!classKey) {
      rejected.push({
        kind: 'assignment',
        reason: 'assignment_class_unresolved',
        url: normalized.value.canonicalUrl,
      });
      continue;
    }

    const parentClass = await findClass({ userId, dedupeKey: classKey, cache: classCache });
    if (!parentClass) {
      // The class was never synced (or was rejected). Keeping the assignment
      // would orphan it, so we reject with a reason the UI can explain.
      rejected.push({
        kind: 'assignment',
        reason: 'assignment_class_not_found',
        url: normalized.value.canonicalUrl,
      });
      syncLogger.warn(
        { event: SYNC_EVENTS.rejected, kind: 'assignment', reason: 'assignment_class_not_found' },
        'assignment has no known parent class',
      );
      continue;
    }

    const dedupeKey = buildAssignmentDedupeKey({
      sourceId: normalized.value.sourceId,
      canonicalUrl: normalized.value.canonicalUrl,
      classDedupeKey: classKey,
      title: normalized.value.title,
    });
    if (!dedupeKey) {
      rejected.push({
        kind: 'assignment',
        reason: 'assignment_not_identifiable',
        url: normalized.value.canonicalUrl,
      });
      continue;
    }

    const outcome = await upsertAssignment({
      userId,
      classId: parentClass._id,
      dedupeKey,
      normalized: normalized.value,
      now,
    });

    if (outcome === 'created') {
      counters.assignmentsCreated += 1;
      syncLogger.info(
        {
          event: SYNC_EVENTS.assignmentDiscovered,
          classId: parentClass._id.toString(),
          assignmentSourceId: normalized.value.sourceId,
        },
        'assignment discovered',
      );
    } else if (outcome === 'updated') {
      counters.assignmentsUpdated += 1;
      syncLogger.info(
        {
          event: SYNC_EVENTS.assignmentUpdated,
          classId: parentClass._id.toString(),
          assignmentSourceId: normalized.value.sourceId,
        },
        'assignment updated',
      );
    } else {
      counters.assignmentsUnchanged += 1;
      syncLogger.debug(
        {
          event: SYNC_EVENTS.assignmentUnchanged,
          classId: parentClass._id.toString(),
        },
        'assignment unchanged',
      );
    }
  }

  // --- Phase 3: record the run -------------------------------------------
  const warnings = payload.warnings.map((warning) => ({
    code: warning.code,
    message: warning.message,
    url: warning.url,
  }));

  const status = await closeOrAdvanceSyncRun({
    userId,
    syncId: payload.syncId,
    counters,
    warnings,
    rejectedCount: rejected.length,
    isFinal,
    now,
    extractionReports: env.SCRAPER_DEBUG
      ? [
          ...payload.classes.map((c) => c.extraction),
          ...payload.assignments.map((a) => a.extraction),
        ]
      : [],
  });

  if (isFinal) {
    syncLogger.info(
      { event: SYNC_EVENTS.complete, status, ...counters, rejected: rejected.length },
      'sync complete',
    );
  }

  const totals = await countTotals(userId);

  return {
    syncId: payload.syncId,
    status,
    classesCreated: counters.classesCreated,
    classesUpdated: counters.classesUpdated,
    assignmentsCreated: counters.assignmentsCreated,
    assignmentsUpdated: counters.assignmentsUpdated,
    assignmentsUnchanged: counters.assignmentsUnchanged,
    rejected,
    totals,
  };
}

// ---------------------------------------------------------------------------
// Upserts
// ---------------------------------------------------------------------------

type UpsertOutcome = 'created' | 'updated' | 'unchanged';

/**
 * Upsert a class.
 *
 * Read-then-write rather than a single findOneAndUpdate, because we need to
 * compare content hashes to report created/updated/unchanged honestly. The
 * unique index is the real safety net: a concurrent insert surfaces as a
 * duplicate-key error, which we handle by re-reading and updating.
 */
async function upsertClass(params: {
  userId: Types.ObjectId;
  dedupeKey: string;
  normalized: NormalizedClass;
  now: Date;
}): Promise<UpsertOutcome> {
  const { userId, dedupeKey, normalized, now } = params;
  const filter = {
    userId,
    source: 'google_classroom_browser' as const,
    dedupeKey,
  };

  const existing = await ClassroomClass.findOne(filter).exec();

  if (!existing) {
    try {
      await ClassroomClass.create({
        ...filter,
        sourceId: normalized.sourceId,
        canonicalUrl: normalized.canonicalUrl,
        name: normalized.name,
        section: normalized.section,
        teacherName: normalized.teacherName,
        room: normalized.room,
        description: normalized.description,
        contentHash: normalized.contentHash,
        firstSeenAt: now,
        lastSeenAt: now,
        lastSyncedAt: now,
      });
      return 'created';
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      // Lost a race with a concurrent batch; fall through to the update path.
    }
  }

  const changed =
    !existing || existing.contentHash !== normalized.contentHash;

  await ClassroomClass.updateOne(filter, {
    $set: {
      ...(changed
        ? {
            sourceId: normalized.sourceId,
            canonicalUrl: normalized.canonicalUrl,
            name: normalized.name,
            section: normalized.section,
            teacherName: normalized.teacherName,
            room: normalized.room,
            description: normalized.description,
            contentHash: normalized.contentHash,
          }
        : {}),
      lastSeenAt: now,
      lastSyncedAt: now,
    },
  }).exec();

  return changed ? 'updated' : 'unchanged';
}

async function upsertAssignment(params: {
  userId: Types.ObjectId;
  classId: Types.ObjectId;
  dedupeKey: string;
  normalized: NormalizedAssignment;
  now: Date;
}): Promise<UpsertOutcome> {
  const { userId, classId, dedupeKey, normalized, now } = params;
  const filter = {
    userId,
    source: 'google_classroom_browser' as const,
    dedupeKey,
  };

  const existing = await Assignment.findOne(filter).exec();

  if (!existing) {
    try {
      await Assignment.create({
        ...filter,
        classId,
        sourceId: normalized.sourceId,
        canonicalUrl: normalized.canonicalUrl,
        title: normalized.title,
        instructions: normalized.instructions,
        assignmentType: normalized.assignmentType,
        topic: normalized.topic,
        dueAt: normalized.dueAt,
        dueLabel: normalized.dueLabel,
        pointsPossible: normalized.pointsPossible,
        status: normalized.status,
        grade: normalized.grade,
        attachments: normalized.attachments,
        contentHash: normalized.contentHash,
        firstSeenAt: now,
        lastSeenAt: now,
        lastSyncedAt: now,
      });
      return 'created';
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
  }

  // A class can legitimately change (an item re-filed under another class),
  // so classId is refreshed even when the content is otherwise identical.
  const classChanged = existing ? !existing.classId.equals(classId) : true;
  const contentChanged = !existing || existing.contentHash !== normalized.contentHash;

  await Assignment.updateOne(filter, {
    $set: {
      classId,
      ...(contentChanged
        ? {
            sourceId: normalized.sourceId,
            canonicalUrl: normalized.canonicalUrl,
            title: normalized.title,
            instructions: normalized.instructions,
            assignmentType: normalized.assignmentType,
            topic: normalized.topic,
            dueAt: normalized.dueAt,
            dueLabel: normalized.dueLabel,
            pointsPossible: normalized.pointsPossible,
            status: normalized.status,
            grade: normalized.grade,
            attachments: normalized.attachments,
            contentHash: normalized.contentHash,
          }
        : {}),
      lastSeenAt: now,
      lastSyncedAt: now,
    },
  }).exec();

  return contentChanged || classChanged ? 'updated' : 'unchanged';
}

async function findClass(params: {
  userId: Types.ObjectId;
  dedupeKey: string;
  cache: Map<string, ClassroomClassDoc | null>;
}): Promise<ClassroomClassDoc | null> {
  const cached = params.cache.get(params.dedupeKey);
  if (cached !== undefined) return cached;

  const found = await ClassroomClass.findOne({
    userId: params.userId,
    source: 'google_classroom_browser',
    dedupeKey: params.dedupeKey,
  }).exec();

  params.cache.set(params.dedupeKey, found);
  return found;
}

// ---------------------------------------------------------------------------
// Sync run bookkeeping
// ---------------------------------------------------------------------------

/** Opens the run if it does not exist. Returns true when it was just created. */
async function openSyncRun(params: {
  userId: Types.ObjectId;
  syncId: string;
  startedAt: Date;
  clientVersion: string | null;
}): Promise<boolean> {
  const result = await SyncRun.updateOne(
    { userId: params.userId, syncId: params.syncId },
    {
      $setOnInsert: {
        userId: params.userId,
        syncId: params.syncId,
        status: 'running' as SyncRunStatus,
        startedAt: params.startedAt,
        clientVersion: params.clientVersion,
      },
    },
    { upsert: true },
  ).exec();

  return result.upsertedCount > 0;
}

async function closeOrAdvanceSyncRun(params: {
  userId: Types.ObjectId;
  syncId: string;
  counters: Counters;
  warnings: Array<{ code: string; message: string; url: string | null }>;
  rejectedCount: number;
  isFinal: boolean;
  now: Date;
  extractionReports: unknown[];
}): Promise<SyncRunStatus> {
  const { userId, syncId, counters, warnings, rejectedCount, isFinal, now } = params;

  await SyncRun.updateOne(
    { userId, syncId },
    {
      $inc: {
        batchesReceived: 1,
        classesSeen: counters.classesSeen,
        assignmentsSeen: counters.assignmentsSeen,
        classesCreated: counters.classesCreated,
        classesUpdated: counters.classesUpdated,
        assignmentsCreated: counters.assignmentsCreated,
        assignmentsUpdated: counters.assignmentsUpdated,
        assignmentsUnchanged: counters.assignmentsUnchanged,
      },
      ...(warnings.length > 0 || params.extractionReports.length > 0
        ? {
            $push: {
              ...(warnings.length > 0
                ? { warnings: { $each: warnings, $slice: -MAX_STORED_WARNINGS } }
                : {}),
              ...(params.extractionReports.length > 0
                ? {
                    extractionReports: {
                      $each: params.extractionReports,
                      $slice: -MAX_STORED_WARNINGS,
                    },
                  }
                : {}),
            },
          }
        : {}),
    },
  ).exec();

  if (!isFinal) return 'running';

  // Read back the accumulated totals so the final status accounts for
  // warnings raised in earlier batches, not just this one.
  const run = await SyncRun.findOne({ userId, syncId }).lean().exec();
  const totalWarnings = (run?.warnings.length ?? 0) + rejectedCount;
  const status: SyncRunStatus =
    totalWarnings > 0 ? 'completed_with_warnings' : 'completed';

  await SyncRun.updateOne(
    { userId, syncId },
    { $set: { status, finishedAt: now } },
  ).exec();

  return status;
}

/** Mark a run failed. Called when a sync aborts, so the UI never shows a
 * run stuck at "running" forever. */
export async function failSyncRun(params: {
  userId: Types.ObjectId;
  syncId: string;
  code: string;
  message: string;
  now?: Date;
}): Promise<void> {
  await SyncRun.updateOne(
    { userId: params.userId, syncId: params.syncId },
    {
      $set: { status: 'failed' as SyncRunStatus, finishedAt: params.now ?? new Date() },
      $push: {
        warnings: {
          $each: [{ code: params.code, message: params.message, url: null }],
          $slice: -MAX_STORED_WARNINGS,
        },
      },
    },
  ).exec();
}

async function countTotals(
  userId: Types.ObjectId,
): Promise<{ classes: number; assignments: number }> {
  const [classes, assignments] = await Promise.all([
    ClassroomClass.countDocuments({ userId }).exec(),
    Assignment.countDocuments({ userId }).exec(),
  ]);
  return { classes, assignments };
}

/** MongoDB signals a unique-index violation with error code 11000. */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}

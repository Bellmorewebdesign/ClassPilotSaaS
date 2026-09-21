import type {
  AssignmentDto,
  ClassDto,
  SyncRunDto,
} from '@classpilot/shared';
import type { AssignmentAttrs, ClassroomClassAttrs, SyncRunAttrs } from '../models/index.js';
import type { Types } from 'mongoose';

/**
 * Mongoose documents -> wire DTOs.
 *
 * The web app never sees an ObjectId or a Date object; ids become hex strings
 * and timestamps become ISO-8601. Keeping this in one place means a field can
 * never be half-serialized in one route and not another.
 *
 * Note what is deliberately NOT serialized: `dedupeKey`, `contentHash` and
 * `userId`. They are internal bookkeeping, and `userId` in particular has no
 * business crossing the wire.
 */

type WithId<T> = T & { _id: Types.ObjectId };

function iso(value: Date | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

function requiredIso(value: Date): string {
  return new Date(value).toISOString();
}

export function serializeClass(
  doc: WithId<ClassroomClassAttrs>,
  assignmentCount = 0,
): ClassDto {
  return {
    id: doc._id.toString(),
    source: doc.source,
    sourceId: doc.sourceId ?? null,
    canonicalUrl: doc.canonicalUrl ?? null,
    name: doc.name,
    section: doc.section ?? null,
    teacherName: doc.teacherName ?? null,
    room: doc.room ?? null,
    description: doc.description ?? null,
    assignmentCount,
    lastSyncedAt: iso(doc.lastSyncedAt),
    createdAt: requiredIso(doc.createdAt),
    updatedAt: requiredIso(doc.updatedAt),
  };
}

export function serializeAssignment(
  doc: WithId<AssignmentAttrs>,
  className: string | null = null,
): AssignmentDto {
  return {
    id: doc._id.toString(),
    classId: doc.classId.toString(),
    className,
    source: doc.source,
    sourceId: doc.sourceId ?? null,
    canonicalUrl: doc.canonicalUrl ?? null,
    title: doc.title,
    instructions: doc.instructions ?? null,
    assignmentType: doc.assignmentType,
    topic: doc.topic ?? null,
    dueAt: iso(doc.dueAt),
    dueLabel: doc.dueLabel ?? null,
    pointsPossible: doc.pointsPossible ?? null,
    status: doc.status,
    grade: doc.grade
      ? {
          raw: doc.grade.raw ?? null,
          earned: doc.grade.earned ?? null,
          possible: doc.grade.possible ?? null,
        }
      : null,
    attachments: (doc.attachments ?? []).map((attachment) => ({
      name: attachment.name ?? null,
      url: attachment.url,
      mimeType: attachment.mimeType ?? null,
      provider: attachment.provider,
      attachmentType: attachment.attachmentType,
    })),
    firstSeenAt: requiredIso(doc.firstSeenAt),
    lastSeenAt: requiredIso(doc.lastSeenAt),
    lastSyncedAt: requiredIso(doc.lastSyncedAt),
    createdAt: requiredIso(doc.createdAt),
    updatedAt: requiredIso(doc.updatedAt),
  };
}

export function serializeSyncRun(doc: WithId<SyncRunAttrs>): SyncRunDto {
  return {
    id: doc._id.toString(),
    syncId: doc.syncId,
    status: doc.status,
    startedAt: requiredIso(doc.startedAt),
    finishedAt: iso(doc.finishedAt),
    classesSeen: doc.classesSeen,
    assignmentsSeen: doc.assignmentsSeen,
    classesCreated: doc.classesCreated,
    classesUpdated: doc.classesUpdated,
    assignmentsCreated: doc.assignmentsCreated,
    assignmentsUpdated: doc.assignmentsUpdated,
    assignmentsUnchanged: doc.assignmentsUnchanged,
    warnings: (doc.warnings ?? []).map((warning) => ({
      code: warning.code,
      message: warning.message,
      url: warning.url ?? null,
    })),
    clientVersion: doc.clientVersion ?? null,
  };
}

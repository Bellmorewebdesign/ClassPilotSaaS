import mongoose from 'mongoose';
import type { HydratedDocument, Model, Types } from 'mongoose';

/**
 * Mongoose ships as CommonJS, so ESM named value imports of its runtime
 * exports (`models` in particular) are not reliably available. The default
 * import is destructured instead; type-only names still import normally.
 */
const { Schema, model, models } = mongoose;
import {
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_TYPES,
  ATTACHMENT_PROVIDERS,
  ATTACHMENT_TYPES,
  SYNC_SOURCES,
  type AssignmentStatus,
  type AssignmentType,
  type AttachmentProvider,
  type AttachmentType,
  type SyncSource,
} from '@classpilot/shared';

/**
 * A Classwork item (assignment, quiz, question or material) observed in the
 * student's browser.
 *
 * We store normalized, extracted information only — never raw page HTML.
 *
 * Timestamps, and what each one means:
 *   firstSeenAt   the first sync in which this item ever appeared
 *   lastSeenAt    the most recent sync in which it appeared at all
 *   lastSyncedAt  the most recent sync that wrote to it
 *   updatedAt     Mongoose's own write timestamp
 *
 * `contentHash` covers only the meaningful fields (see shared/sync/hash.ts),
 * so "seen again, unchanged" is distinguishable from "actually changed".
 */

export interface AssignmentAttachmentAttrs {
  name: string | null;
  url: string;
  mimeType: string | null;
  provider: AttachmentProvider;
  attachmentType: AttachmentType;
}

export interface AssignmentGradeAttrs {
  raw: string | null;
  earned: number | null;
  possible: number | null;
}

export interface AssignmentAttrs {
  userId: Types.ObjectId;
  classId: Types.ObjectId;
  source: SyncSource;
  sourceId: string | null;
  /** Stable upsert key. See ClassroomClass for the derivation rules. */
  dedupeKey: string;
  canonicalUrl: string | null;

  title: string;
  instructions: string | null;
  assignmentType: AssignmentType;
  topic: string | null;

  dueAt: Date | null;
  /** The literal due text we read, kept so a human can audit the parser. */
  dueLabel: string | null;

  pointsPossible: number | null;
  status: AssignmentStatus;
  grade: AssignmentGradeAttrs | null;
  attachments: AssignmentAttachmentAttrs[];

  contentHash: string;

  firstSeenAt: Date;
  lastSeenAt: Date;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type AssignmentDoc = HydratedDocument<AssignmentAttrs>;

const attachmentSchema = new Schema<AssignmentAttachmentAttrs>(
  {
    name: { type: String, default: null, maxlength: 500 },
    url: { type: String, required: true, maxlength: 2048 },
    mimeType: { type: String, default: null, maxlength: 255 },
    provider: { type: String, enum: ATTACHMENT_PROVIDERS, default: 'unknown' },
    attachmentType: { type: String, enum: ATTACHMENT_TYPES, default: 'unknown' },
  },
  { _id: false },
);

const gradeSchema = new Schema<AssignmentGradeAttrs>(
  {
    raw: { type: String, default: null, maxlength: 64 },
    earned: { type: Number, default: null },
    possible: { type: Number, default: null },
  },
  { _id: false },
);

const assignmentSchema = new Schema<AssignmentAttrs>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'ClassroomClass', required: true },
    source: {
      type: String,
      required: true,
      enum: SYNC_SOURCES,
      default: 'google_classroom_browser',
    },
    sourceId: { type: String, default: null, maxlength: 128 },
    dedupeKey: { type: String, required: true, maxlength: 600 },
    canonicalUrl: { type: String, default: null, maxlength: 2048 },

    title: { type: String, required: true, maxlength: 500 },
    instructions: { type: String, default: null, maxlength: 20_000 },
    assignmentType: { type: String, enum: ASSIGNMENT_TYPES, default: 'unknown' },
    topic: { type: String, default: null, maxlength: 500 },

    dueAt: { type: Date, default: null },
    dueLabel: { type: String, default: null, maxlength: 500 },

    pointsPossible: { type: Number, default: null },
    status: { type: String, enum: ASSIGNMENT_STATUSES, default: 'unknown' },
    grade: { type: gradeSchema, default: null },
    attachments: { type: [attachmentSchema], default: [] },

    contentHash: { type: String, required: true, maxlength: 64 },

    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    lastSyncedAt: { type: Date, required: true },
  },
  { timestamps: true, collection: 'assignments' },
);

// The duplicate-prevention guarantee, enforced by the database.
assignmentSchema.index(
  { userId: 1, source: 1, dedupeKey: 1 },
  { unique: true, name: 'uniq_user_source_dedupe' },
);
// "Assignments for this class", the /classes/[id] page.
assignmentSchema.index({ userId: 1, classId: 1, dueAt: 1 });
// "Due soon" on the dashboard.
assignmentSchema.index({ userId: 1, dueAt: 1 });
// "Recently synced" on the dashboard.
assignmentSchema.index({ userId: 1, lastSyncedAt: -1 });

export const Assignment: Model<AssignmentAttrs> =
  (models.Assignment as Model<AssignmentAttrs>) ??
  model<AssignmentAttrs>('Assignment', assignmentSchema);

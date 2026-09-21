import mongoose from 'mongoose';
import type { HydratedDocument, Model, Types } from 'mongoose';

/**
 * Mongoose ships as CommonJS, so ESM named value imports of its runtime
 * exports (`models` in particular) are not reliably available. The default
 * import is destructured instead; type-only names still import normally.
 */
const { Schema, model, models } = mongoose;
import { SYNC_SOURCES, type SyncSource } from '@classpilot/shared';

/**
 * A Google Classroom class, as observed through the student's own browser.
 *
 * Idempotency
 * -----------
 * `dedupeKey` is the field that makes re-syncing safe. It is derived once, in
 * syncService, with this precedence:
 *
 *   1. the Classroom course id from the URL  (best - opaque but stable)
 *   2. the canonical class URL               (good)
 *   3. `name:<lowercased class name>`        (fallback, last resort)
 *
 * The unique index on (userId, source, dedupeKey) is what physically prevents
 * duplicate classes per user, rather than relying on application logic alone.
 */
export interface ClassroomClassAttrs {
  userId: Types.ObjectId;
  source: SyncSource;
  /** Opaque Classroom course id when we could determine one. */
  sourceId: string | null;
  /** Stable key used for upserts. Always present. */
  dedupeKey: string;
  canonicalUrl: string | null;

  name: string;
  section: string | null;
  teacherName: string | null;
  room: string | null;
  description: string | null;

  /** Hash of the meaningful fields, used to detect real changes. */
  contentHash: string;

  firstSeenAt: Date;
  lastSeenAt: Date;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ClassroomClassDoc = HydratedDocument<ClassroomClassAttrs>;

const classroomClassSchema = new Schema<ClassroomClassAttrs>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    source: {
      type: String,
      required: true,
      enum: SYNC_SOURCES,
      default: 'google_classroom_browser',
    },
    sourceId: { type: String, default: null, maxlength: 128 },
    dedupeKey: { type: String, required: true, maxlength: 600 },
    canonicalUrl: { type: String, default: null, maxlength: 2048 },

    name: { type: String, required: true, maxlength: 500 },
    section: { type: String, default: null, maxlength: 500 },
    teacherName: { type: String, default: null, maxlength: 500 },
    room: { type: String, default: null, maxlength: 500 },
    description: { type: String, default: null, maxlength: 20_000 },

    contentHash: { type: String, required: true, maxlength: 64 },

    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    lastSyncedAt: { type: Date, required: true },
  },
  { timestamps: true, collection: 'classroom_classes' },
);

// The duplicate-prevention guarantee, enforced by the database.
classroomClassSchema.index(
  { userId: 1, source: 1, dedupeKey: 1 },
  { unique: true, name: 'uniq_user_source_dedupe' },
);
// Dashboard ordering.
classroomClassSchema.index({ userId: 1, lastSyncedAt: -1 });
// Lookup by Classroom id when resolving an assignment's parent class.
classroomClassSchema.index({ userId: 1, sourceId: 1 });

export const ClassroomClass: Model<ClassroomClassAttrs> =
  (models.ClassroomClass as Model<ClassroomClassAttrs>) ??
  model<ClassroomClassAttrs>('ClassroomClass', classroomClassSchema);

import mongoose from 'mongoose';
import type { HydratedDocument, Model, Types } from 'mongoose';

/**
 * Mongoose ships as CommonJS, so ESM named value imports of its runtime
 * exports (`models` in particular) are not reliably available. The default
 * import is destructured instead; type-only names still import normally.
 */
const { Schema, model, models } = mongoose;
import { SYNC_RUN_STATUSES, type SyncRunStatus } from '@classpilot/shared';

/**
 * One "Sync Classroom" click.
 *
 * The extension mints a `syncId` per run and reuses it across every batch, so
 * a multi-batch sync collapses into a single row here. That is what powers
 * "Last sync: Sep 20, 7:32 PM" and the "synced with warnings" summary.
 *
 * `extractionReports` is only populated when SCRAPER_DEBUG is on. Reports
 * carry field names and strategy names — never schoolwork content.
 */
export interface SyncRunWarningAttrs {
  code: string;
  message: string;
  url: string | null;
}

export interface SyncRunAttrs {
  userId: Types.ObjectId;
  syncId: string;
  status: SyncRunStatus;

  startedAt: Date;
  finishedAt: Date | null;

  batchesReceived: number;
  classesSeen: number;
  assignmentsSeen: number;
  classesCreated: number;
  classesUpdated: number;
  assignmentsCreated: number;
  assignmentsUpdated: number;
  assignmentsUnchanged: number;

  warnings: SyncRunWarningAttrs[];
  clientVersion: string | null;

  /** Debug-only. Empty unless SCRAPER_DEBUG=true. */
  extractionReports: unknown[];

  createdAt: Date;
  updatedAt: Date;
}

export type SyncRunDocument = HydratedDocument<SyncRunAttrs>;

const warningSchema = new Schema<SyncRunWarningAttrs>(
  {
    code: { type: String, required: true, maxlength: 64 },
    message: { type: String, required: true, maxlength: 300 },
    url: { type: String, default: null, maxlength: 2048 },
  },
  { _id: false },
);

const syncRunSchema = new Schema<SyncRunAttrs>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    syncId: { type: String, required: true, maxlength: 64 },
    status: { type: String, enum: SYNC_RUN_STATUSES, required: true, default: 'running' },

    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },

    batchesReceived: { type: Number, default: 0 },
    classesSeen: { type: Number, default: 0 },
    assignmentsSeen: { type: Number, default: 0 },
    classesCreated: { type: Number, default: 0 },
    classesUpdated: { type: Number, default: 0 },
    assignmentsCreated: { type: Number, default: 0 },
    assignmentsUpdated: { type: Number, default: 0 },
    assignmentsUnchanged: { type: Number, default: 0 },

    warnings: { type: [warningSchema], default: [] },
    clientVersion: { type: String, default: null, maxlength: 32 },

    extractionReports: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: true, collection: 'sync_runs' },
);

// One row per (user, syncId) — batches of the same run land on the same doc.
syncRunSchema.index({ userId: 1, syncId: 1 }, { unique: true });
// "Last sync" lookup.
syncRunSchema.index({ userId: 1, startedAt: -1 });

export const SyncRun: Model<SyncRunAttrs> =
  (models.SyncRun as Model<SyncRunAttrs>) ??
  model<SyncRunAttrs>('SyncRun', syncRunSchema);

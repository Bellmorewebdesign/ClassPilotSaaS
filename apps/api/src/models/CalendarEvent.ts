import mongoose from 'mongoose';
import type { HydratedDocument, Model, Types } from 'mongoose';

/**
 * Mongoose ships as CommonJS, so ESM named value imports of its runtime
 * exports (`models` in particular) are not reliably available. The default
 * import is destructured instead; type-only names still import normally.
 */
const { Schema, model, models } = mongoose;
import {
  CALENDAR_ITEM_TYPES,
  CALENDAR_SOURCES,
  CALENDAR_SYNC_STATES,
  type CalendarItemType,
  type CalendarSource,
  type CalendarSyncState,
} from '@classpilot/shared';

/**
 * An event the student owns.
 *
 * WHAT IS AND IS NOT STORED HERE
 *
 * Only events Coursen owns: things the student created, and (later) things
 * imported from a connected external calendar.
 *
 * Assignment due dates are NOT stored here. Coursework already lives in the
 * assignments collection with its own sync lifecycle, and copying a due date
 * into a second collection creates two records that drift the moment a
 * teacher moves a deadline. The calendar route reads both and merges at query
 * time, so what a student sees is always what the last sync actually
 * observed. An assignment CAN be referenced by a user-created event -
 * "revise for the chemistry test" - through `assignmentId`.
 *
 * The external* and syncState fields carry no data today. They exist because
 * optional Google Calendar sync is a designed-for future, and adding
 * identity columns after rows exist means a migration. `not_linked` is the
 * only value any row currently holds.
 */

export interface CalendarEventAttrs {
  userId: Types.ObjectId;

  title: string;
  description: string | null;
  type: CalendarItemType;

  startAt: Date;
  endAt: Date;
  allDay: boolean;
  /** IANA zone the event was authored in, so a DST shift cannot move it. */
  timezone: string;

  classId: Types.ObjectId | null;
  assignmentId: Types.ObjectId | null;

  source: CalendarSource;
  /** Stable id within `source`. Null for user-created events. */
  sourceId: string | null;

  externalCalendarId: string | null;
  externalEventId: string | null;
  syncState: CalendarSyncState;

  createdAt: Date;
  updatedAt: Date;
}

export type CalendarEventDoc = HydratedDocument<CalendarEventAttrs>;

const calendarEventSchema = new Schema<CalendarEventAttrs>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    title: { type: String, required: true, maxlength: 300 },
    description: { type: String, default: null, maxlength: 5000 },
    type: { type: String, enum: CALENDAR_ITEM_TYPES, default: 'event' },

    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    allDay: { type: Boolean, default: false },
    timezone: { type: String, default: 'UTC', maxlength: 64 },

    classId: { type: Schema.Types.ObjectId, ref: 'ClassroomClass', default: null },
    assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', default: null },

    source: { type: String, enum: CALENDAR_SOURCES, default: 'coursen_user' },
    sourceId: { type: String, default: null, maxlength: 256 },

    externalCalendarId: { type: String, default: null, maxlength: 256 },
    externalEventId: { type: String, default: null, maxlength: 256 },
    syncState: { type: String, enum: CALENDAR_SYNC_STATES, default: 'not_linked' },
  },
  { timestamps: true, collection: 'calendarEvents' },
);

/**
 * The query the calendar page makes on every load: one user's events in a
 * window, in order.
 */
calendarEventSchema.index({ userId: 1, startAt: 1 });

/**
 * Deduplication for imported events.
 *
 * Partial, because user-created events have a null sourceId and several of
 * them may legitimately coexist. Only rows that carry an external identity
 * are constrained, which is what stops a future two-way sync creating a
 * duplicate every time it runs.
 */
calendarEventSchema.index(
  { userId: 1, source: 1, sourceId: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceId: { $type: 'string' } },
  },
);

export const CalendarEvent: Model<CalendarEventAttrs> =
  (models.CalendarEvent as Model<CalendarEventAttrs>) ??
  model<CalendarEventAttrs>('CalendarEvent', calendarEventSchema);

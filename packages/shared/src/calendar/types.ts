/**
 * The Coursen calendar.
 *
 * WHY THIS IS NOT A GOOGLE CALENDAR VIEW
 *
 * A student's schedule is not a Google Calendar. It is coursework with due
 * dates, a quiz a teacher mentioned in the stream, and the study blocks they
 * put aside for themselves. Google Calendar holds some of that; Coursen has
 * to hold all of it, and has to work for a student who never connects one.
 *
 * So this is a first-class model, and Google Calendar is designed for as an
 * OPTIONAL MIRROR of it - which is why the external fields exist here from
 * the start even though no sync is implemented yet. Adding them later would
 * mean migrating every row that already existed.
 */

/** What kind of thing is on the calendar. */
export const CALENDAR_ITEM_TYPES = [
  'assignment',
  'quiz',
  'test',
  'event',
  'study_block',
  'reminder',
] as const;
export type CalendarItemType = (typeof CALENDAR_ITEM_TYPES)[number];

/**
 * Where an item came from.
 *
 *   coursen_user   the student typed it in. Always authoritative.
 *   classroom      derived from a synced assignment's due date. Regenerated
 *                  by sync, so user edits to it are tracked separately.
 *   google_calendar  imported from a connected Google Calendar. Not yet
 *                  implemented; the value exists so stored rows never need
 *                  migrating when it is.
 */
export const CALENDAR_SOURCES = ['coursen_user', 'classroom', 'google_calendar'] as const;
export type CalendarSource = (typeof CALENDAR_SOURCES)[number];

/**
 * State of the optional mirror to an external calendar.
 *
 * `not_linked` is the only value any row has today, and the only one the
 * product claims. The rest describe the states a future sync would move
 * through, and exist so that sync can be added without a migration.
 */
export const CALENDAR_SYNC_STATES = [
  'not_linked',
  'pending_push',
  'synced',
  'push_failed',
  'remote_deleted',
] as const;
export type CalendarSyncState = (typeof CALENDAR_SYNC_STATES)[number];

export interface CalendarEventDto {
  id: string;
  title: string;
  description: string | null;
  type: CalendarItemType;
  /** ISO 8601. */
  startAt: string;
  /** ISO 8601. Equal to startAt for a point-in-time reminder. */
  endAt: string;
  allDay: boolean;
  /** IANA zone the event was created in, so a DST change cannot shift it. */
  timezone: string;

  /** Links back into the workspace, when the event came from coursework. */
  classId: string | null;
  className: string | null;
  assignmentId: string | null;

  source: CalendarSource;
  /** Stable id within `source`, used to deduplicate on re-sync. */
  sourceId: string | null;

  /**
   * Google Calendar linkage. Always null today - no OAuth is implemented and
   * the integration is presented as not connected.
   */
  externalCalendarId: string | null;
  externalEventId: string | null;
  syncState: CalendarSyncState;

  createdAt: string;
  updatedAt: string;
}

/** What a client may send when creating an event. */
export interface CalendarEventInput {
  title: string;
  description?: string | null;
  type?: CalendarItemType;
  startAt: string;
  endAt?: string | null;
  allDay?: boolean;
  timezone?: string;
  classId?: string | null;
  assignmentId?: string | null;
}

/**
 * A derived event, produced from an assignment's due date rather than stored.
 *
 * Assignment-derived events are NOT written into the calendar collection.
 * Coursework already lives in the assignments collection with its own sync
 * lifecycle; copying it would create two records that drift apart the moment
 * a teacher moves a deadline. The calendar reads both and merges at query
 * time, so a due date is always whatever the last sync actually saw.
 */
export function assignmentEventId(assignmentId: string): string {
  return `assignment:${assignmentId}`;
}

/** True for events the calendar renders but does not own. */
export function isDerivedEventId(id: string): boolean {
  return id.startsWith('assignment:');
}

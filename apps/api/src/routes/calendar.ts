import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import type { Types } from 'mongoose';

/**
 * Mongoose ships as CommonJS, so ESM named value imports of its runtime
 * exports are not reliably available. Runtime use goes through the default
 * import (`mongoose.Types.ObjectId`); `Types` is imported as a type only.
 */
import { z } from 'zod';
import {
  assignmentEventId,
  calendarEventCreateSchema,
  calendarEventUpdateSchema,
  calendarRangeSchema,
  type CalendarEventDto,
} from '@classpilot/shared';
import { ApiError } from '../lib/errors.js';
import { parseOrThrow } from '../lib/validate.js';
import { Assignment, CalendarEvent, ClassroomClass } from '../models/index.js';
import { currentUser, requireAuth } from '../plugins/auth.js';

/**
 * The Coursen calendar.
 *
 * Every query filters on `userId` taken from the authenticated request -
 * never from a parameter - so there is no request shape that reaches another
 * user's rows. Updates and deletes use a compound {_id, userId} filter for
 * the same reason: a guessed id matches nothing.
 *
 * THE MERGE
 *
 * A listing returns two things: the events the student owns, and events
 * DERIVED from assignments that have a due date. Derived events are computed
 * per request rather than stored, so a due date on the calendar is always
 * what the last sync actually saw. They carry a synthetic
 * `assignment:<id>` id and are read-only - editing one edits the assignment,
 * which is not this route's job.
 */

const idParamSchema = z.object({
  id: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), 'invalid id'),
});

export async function registerCalendarRoutes(app: FastifyInstance): Promise<void> {
  /** List events in a window, merged with assignment due dates. */
  app.get('/api/v1/calendar/events', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const range = parseOrThrow(calendarRangeSchema, request.query);
    const from = new Date(range.from);
    const to = new Date(range.to);

    const [owned, assignments, classes] = await Promise.all([
      CalendarEvent.find({
        userId: user.id,
        // An event overlaps the window if it starts before the end and ends
        // after the start - not merely if it starts inside it, which would
        // drop a multi-day event the window lands in the middle of.
        startAt: { $lt: to },
        endAt: { $gt: from },
      })
        .sort({ startAt: 1 })
        .limit(1000)
        .lean()
        .exec(),
      Assignment.find({
        userId: user.id,
        dueAt: { $gte: from, $lt: to },
      })
        .sort({ dueAt: 1 })
        .limit(1000)
        .lean()
        .exec(),
      ClassroomClass.find({ userId: user.id }).select({ name: 1 }).lean().exec(),
    ]);

    const classNames = new Map(classes.map((klass) => [String(klass._id), klass.name]));

    const events: CalendarEventDto[] = [
      ...owned.map((doc) => serializeEvent(doc, classNames)),
      ...assignments.map((assignment) => ({
        id: assignmentEventId(String(assignment._id)),
        title: assignment.title,
        description: null,
        // A quiz keeps its own shape on the calendar; everything else that
        // has a deadline reads as an assignment.
        type:
          assignment.assignmentType === 'quiz'
            ? ('quiz' as const)
            : ('assignment' as const),
        startAt: assignment.dueAt!.toISOString(),
        endAt: assignment.dueAt!.toISOString(),
        allDay: false,
        timezone: 'UTC',
        classId: String(assignment.classId),
        className: classNames.get(String(assignment.classId)) ?? null,
        assignmentId: String(assignment._id),
        source: 'classroom' as const,
        sourceId: assignment.sourceId,
        externalCalendarId: null,
        externalEventId: null,
        syncState: 'not_linked' as const,
        createdAt: assignment.createdAt.toISOString(),
        updatedAt: assignment.updatedAt.toISOString(),
      })),
    ].sort((a, b) => a.startAt.localeCompare(b.startAt));

    return { events, total: events.length };
  });

  /** Create an event. */
  app.post('/api/v1/calendar/events', { preHandler: requireAuth }, async (request, reply) => {
    const user = currentUser(request);
    const input = parseOrThrow(calendarEventCreateSchema, request.body);

    await assertOwnedReferences(user.id, input.classId, input.assignmentId);

    const startAt = new Date(input.startAt);
    const doc = await CalendarEvent.create({
      userId: user.id,
      title: input.title,
      description: input.description,
      type: input.type,
      startAt,
      // A point-in-time item (a reminder, a deadline) has no duration, so it
      // ends when it starts rather than acquiring an invented hour.
      endAt: input.endAt === null ? startAt : new Date(input.endAt),
      allDay: input.allDay,
      timezone: input.timezone,
      classId: input.classId === null ? null : toObjectId(input.classId),
      assignmentId: input.assignmentId === null ? null : toObjectId(input.assignmentId),
      source: 'coursen_user',
      sourceId: null,
      syncState: 'not_linked',
    });

    reply.code(201);
    return { event: serializeEvent(doc.toObject(), await classNameMap(user.id)) };
  });

  /** Update an event. */
  app.patch('/api/v1/calendar/events/:id', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const { id } = parseOrThrow(idParamSchema, request.params);
    const input = parseOrThrow(calendarEventUpdateSchema, request.body);

    await assertOwnedReferences(user.id, input.classId ?? null, input.assignmentId ?? null);

    const existing = await CalendarEvent.findOne({ _id: id, userId: user.id }).exec();
    if (!existing) throw new ApiError(404, 'not_found', 'That event does not exist.');

    if (input.title !== undefined) existing.title = input.title;
    if (input.description !== undefined) existing.description = input.description;
    if (input.type !== undefined) existing.type = input.type;
    if (input.startAt !== undefined) existing.startAt = new Date(input.startAt);
    if (input.endAt !== undefined) {
      existing.endAt = input.endAt === null ? existing.startAt : new Date(input.endAt);
    }
    if (input.allDay !== undefined) existing.allDay = input.allDay;
    if (input.timezone !== undefined) existing.timezone = input.timezone;
    if (input.classId !== undefined) {
      existing.classId = input.classId === null ? null : toObjectId(input.classId);
    }
    if (input.assignmentId !== undefined) {
      existing.assignmentId =
        input.assignmentId === null ? null : toObjectId(input.assignmentId);
    }

    // Moving the start past the end is a mistake, not an instruction.
    if (existing.endAt < existing.startAt) existing.endAt = existing.startAt;

    await existing.save();
    return { event: serializeEvent(existing.toObject(), await classNameMap(user.id)) };
  });

  /** Delete an event. */
  app.delete('/api/v1/calendar/events/:id', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const { id } = parseOrThrow(idParamSchema, request.params);

    const result = await CalendarEvent.deleteOne({ _id: id, userId: user.id }).exec();
    if (result.deletedCount === 0) {
      throw new ApiError(404, 'not_found', 'That event does not exist.');
    }
    return { deleted: true };
  });

  /**
   * A class or assignment referenced by an event has to belong to the same
   * user. Without this check a crafted id could link an event to another
   * student's coursework, and the class name would leak back in the listing.
   */
  async function assertOwnedReferences(
    userId: Types.ObjectId,
    classId: string | null,
    assignmentId: string | null,
  ): Promise<void> {
    if (classId) {
      const owned = await ClassroomClass.exists({ _id: classId, userId });
      if (!owned) throw new ApiError(404, 'not_found', 'That class does not exist.');
    }
    if (assignmentId) {
      const owned = await Assignment.exists({ _id: assignmentId, userId });
      if (!owned) throw new ApiError(404, 'not_found', 'That assignment does not exist.');
    }
  }

  async function classNameMap(userId: Types.ObjectId): Promise<Map<string, string>> {
    const classes = await ClassroomClass.find({ userId }).select({ name: 1 }).lean().exec();
    return new Map(classes.map((klass) => [String(klass._id), klass.name]));
  }
}

function toObjectId(value: string): Types.ObjectId {
  return new mongoose.Types.ObjectId(value);
}

/** Shape a stored event for the wire. */
function serializeEvent(
  doc: {
    _id: unknown;
    title: string;
    description: string | null;
    type: CalendarEventDto['type'];
    startAt: Date;
    endAt: Date;
    allDay: boolean;
    timezone: string;
    classId: unknown;
    assignmentId: unknown;
    source: CalendarEventDto['source'];
    sourceId: string | null;
    externalCalendarId: string | null;
    externalEventId: string | null;
    syncState: CalendarEventDto['syncState'];
    createdAt: Date;
    updatedAt: Date;
  },
  classNames: Map<string, string>,
): CalendarEventDto {
  const classId = doc.classId === null ? null : String(doc.classId);
  return {
    id: String(doc._id),
    title: doc.title,
    description: doc.description,
    type: doc.type,
    startAt: doc.startAt.toISOString(),
    endAt: doc.endAt.toISOString(),
    allDay: doc.allDay,
    timezone: doc.timezone,
    classId,
    className: classId === null ? null : (classNames.get(classId) ?? null),
    assignmentId: doc.assignmentId === null ? null : String(doc.assignmentId),
    source: doc.source,
    sourceId: doc.sourceId,
    externalCalendarId: doc.externalCalendarId,
    externalEventId: doc.externalEventId,
    syncState: doc.syncState,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

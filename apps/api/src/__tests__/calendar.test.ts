import type { FastifyInstance } from 'fastify';
import type { Types } from 'mongoose';

/**
 * Mongoose ships as CommonJS, so ESM named value imports of its runtime
 * exports are not reliably available. Only the `Types` type is needed here,
 * which imports normally.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv, type AppEnv } from '../config/env.js';
import { hashToken } from '../db/bootstrap.js';
import {
  Assignment,
  CalendarEvent,
  ClassroomClass,
  ExtensionToken,
  User,
} from '../models/index.js';
import { buildServer } from '../server.js';
import {
  clearTestDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
  silentLogger,
  syncTestIndexes,
} from './helpers/mongo.js';

/**
 * Calendar CRUD, assignment linkage, and cross-user isolation.
 *
 * The isolation tests matter most, as they do for every other collection:
 * they prove there is no request shape - by id, by filter, or by a crafted
 * reference to another student's class - that reaches someone else's rows.
 */

const dbAvailable = await connectTestDatabase();

const TOKEN_A = 'a'.repeat(64);
const TOKEN_B = 'b'.repeat(64);

const env: AppEnv = loadEnv({
  MONGODB_URI: 'mongodb://localhost:27017/ignored-in-tests',
  DEV_EXTENSION_TOKEN: TOKEN_A,
} as NodeJS.ProcessEnv);

let app: FastifyInstance;
let userAId: Types.ObjectId;
let userBId: Types.ObjectId;

function auth(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

async function createUser(email: string, token: string): Promise<Types.ObjectId> {
  const user = await User.create({ email, displayName: email, authMode: 'dev' });
  await ExtensionToken.create({
    userId: user._id,
    tokenHash: hashToken(token),
    label: 'test',
    lastFourChars: token.slice(-4),
    lastUsedAt: null,
    revokedAt: null,
  });
  return user._id;
}

const WINDOW = 'from=2026-09-01T00:00:00.000Z&to=2026-10-01T00:00:00.000Z';

async function createEvent(
  token: string,
  body: Record<string, unknown>,
): Promise<{ status: number; event: Record<string, unknown> }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/calendar/events',
    headers: auth(token),
    payload: body,
  });
  const parsed = response.statusCode === 201 ? response.json() : { event: {} };
  return { status: response.statusCode, event: parsed.event };
}

describe.skipIf(!dbAvailable)('calendar', () => {
  beforeAll(async () => {
    await syncTestIndexes();
    app = await buildServer(env, silentLogger());
    await app.ready();
  });

  beforeEach(async () => {
    await clearTestDatabase();
    userAId = await createUser('a@classpilot.local', TOKEN_A);
    userBId = await createUser('b@classpilot.local', TOKEN_B);
  });

  afterAll(async () => {
    await app.close();
    await disconnectTestDatabase();
  });

  // --- CRUD ---------------------------------------------------------------

  describe('create, read, update, delete', () => {
    it('creates an event and returns it', async () => {
      const { status, event } = await createEvent(TOKEN_A, {
        title: 'Revise for chemistry',
        startAt: '2026-09-22T15:00:00.000Z',
        type: 'study_block',
      });

      expect(status).toBe(201);
      expect(event).toMatchObject({
        title: 'Revise for chemistry',
        type: 'study_block',
        source: 'coursen_user',
        syncState: 'not_linked',
      });
    });

    it('gives a point-in-time event an end equal to its start', async () => {
      const { event } = await createEvent(TOKEN_A, {
        title: 'Reminder',
        startAt: '2026-09-22T15:00:00.000Z',
        type: 'reminder',
      });
      expect(event.endAt).toBe(event.startAt);
    });

    it('lists the event inside the window', async () => {
      await createEvent(TOKEN_A, {
        title: 'Revise',
        startAt: '2026-09-22T15:00:00.000Z',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/calendar/events?${WINDOW}`,
        headers: auth(TOKEN_A),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().events).toHaveLength(1);
    });

    it('excludes an event outside the window', async () => {
      await createEvent(TOKEN_A, {
        title: 'Next year',
        startAt: '2027-05-01T15:00:00.000Z',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/calendar/events?${WINDOW}`,
        headers: auth(TOKEN_A),
      });
      expect(response.json().events).toHaveLength(0);
    });

    it('includes a multi-day event the window lands in the middle of', async () => {
      await createEvent(TOKEN_A, {
        title: 'Exam week',
        startAt: '2026-08-28T00:00:00.000Z',
        endAt: '2026-09-05T00:00:00.000Z',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/calendar/events?${WINDOW}`,
        headers: auth(TOKEN_A),
      });
      // Overlap, not containment. Containment would drop it entirely.
      expect(response.json().events).toHaveLength(1);
    });

    it('updates a single field and leaves the rest alone', async () => {
      const { event } = await createEvent(TOKEN_A, {
        title: 'Old title',
        startAt: '2026-09-22T15:00:00.000Z',
        type: 'quiz',
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/calendar/events/${String(event.id)}`,
        headers: auth(TOKEN_A),
        payload: { title: 'New title' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().event).toMatchObject({
        title: 'New title',
        type: 'quiz',
        startAt: '2026-09-22T15:00:00.000Z',
      });
    });

    it('never leaves an end before its start after a move', async () => {
      const { event } = await createEvent(TOKEN_A, {
        title: 'Study',
        startAt: '2026-09-22T09:00:00.000Z',
        endAt: '2026-09-22T10:00:00.000Z',
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/calendar/events/${String(event.id)}`,
        headers: auth(TOKEN_A),
        payload: { startAt: '2026-09-22T18:00:00.000Z' },
      });

      const updated = response.json().event;
      expect(Date.parse(updated.endAt)).toBeGreaterThanOrEqual(Date.parse(updated.startAt));
    });

    it('deletes an event', async () => {
      const { event } = await createEvent(TOKEN_A, {
        title: 'Temporary',
        startAt: '2026-09-22T15:00:00.000Z',
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/calendar/events/${String(event.id)}`,
        headers: auth(TOKEN_A),
      });
      expect(response.statusCode).toBe(200);
      expect(await CalendarEvent.countDocuments({ userId: userAId })).toBe(0);
    });

    it('rejects an invalid payload rather than storing it', async () => {
      const { status } = await createEvent(TOKEN_A, { title: '', startAt: 'whenever' });
      expect(status).toBe(400);
      expect(await CalendarEvent.countDocuments({})).toBe(0);
    });
  });

  // --- Assignment linkage -------------------------------------------------

  describe('assignments appear automatically', () => {
    async function seedAssignment(userId: Types.ObjectId, dueAt: string) {
      const klass = await ClassroomClass.create({
        userId,
        source: 'google_classroom_browser',
        sourceId: 'course-1',
        dedupeKey: `${String(userId)}:course-1`,
        canonicalUrl: 'https://classroom.google.com/c/course-1',
        name: 'AP Chemistry',
        contentHash: 'h',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        lastSyncedAt: new Date(),
      });
      const assignment = await Assignment.create({
        userId,
        classId: klass._id,
        source: 'google_classroom_browser',
        sourceId: 'work-1',
        dedupeKey: `${String(userId)}:work-1`,
        canonicalUrl: 'https://classroom.google.com/c/course-1/a/work-1/details',
        title: 'Titration Lab',
        assignmentType: 'assignment',
        dueAt: new Date(dueAt),
        status: 'assigned',
        contentHash: 'h',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        lastSyncedAt: new Date(),
      });
      return { klass, assignment };
    }

    it('renders a due assignment as a calendar item', async () => {
      const { assignment } = await seedAssignment(userAId, '2026-09-23T23:59:00.000Z');

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/calendar/events?${WINDOW}`,
        headers: auth(TOKEN_A),
      });

      const events = response.json().events;
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        id: `assignment:${String(assignment._id)}`,
        title: 'Titration Lab',
        source: 'classroom',
        className: 'AP Chemistry',
        assignmentId: String(assignment._id),
      });
    });

    it('does not copy the assignment into the calendar collection', async () => {
      await seedAssignment(userAId, '2026-09-23T23:59:00.000Z');
      await app.inject({
        method: 'GET',
        url: `/api/v1/calendar/events?${WINDOW}`,
        headers: auth(TOKEN_A),
      });
      // Derived at query time, so a moved deadline can never go stale here.
      expect(await CalendarEvent.countDocuments({})).toBe(0);
    });

    it('ignores an assignment with no due date', async () => {
      const klass = await ClassroomClass.create({
        userId: userAId,
        source: 'google_classroom_browser',
        sourceId: 'course-2',
        dedupeKey: `${String(userAId)}:course-2`,
        canonicalUrl: 'https://classroom.google.com/c/course-2',
        name: 'English',
        contentHash: 'h',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        lastSyncedAt: new Date(),
      });
      await Assignment.create({
        userId: userAId,
        classId: klass._id,
        source: 'google_classroom_browser',
        sourceId: 'work-2',
        dedupeKey: `${String(userAId)}:work-2`,
        title: 'Reading',
        assignmentType: 'assignment',
        dueAt: null,
        status: 'assigned',
        contentHash: 'h',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        lastSyncedAt: new Date(),
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/calendar/events?${WINDOW}`,
        headers: auth(TOKEN_A),
      });
      expect(response.json().events).toHaveLength(0);
    });

    it('merges user events and assignments in time order', async () => {
      await seedAssignment(userAId, '2026-09-23T23:59:00.000Z');
      await createEvent(TOKEN_A, {
        title: 'Revise first',
        startAt: '2026-09-22T15:00:00.000Z',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/calendar/events?${WINDOW}`,
        headers: auth(TOKEN_A),
      });
      const events = response.json().events;
      expect(events.map((e: { title: string }) => e.title)).toEqual([
        'Revise first',
        'Titration Lab',
      ]);
    });

    it('lets a user event reference one of their own assignments', async () => {
      const { assignment, klass } = await seedAssignment(userAId, '2026-09-23T23:59:00Z');
      const { status, event } = await createEvent(TOKEN_A, {
        title: 'Revise for the lab',
        startAt: '2026-09-22T15:00:00.000Z',
        assignmentId: String(assignment._id),
        classId: String(klass._id),
      });

      expect(status).toBe(201);
      expect(event).toMatchObject({
        assignmentId: String(assignment._id),
        className: 'AP Chemistry',
      });
    });
  });

  // --- Isolation ----------------------------------------------------------

  describe('one student cannot reach another’s calendar', () => {
    it('does not list another user’s events', async () => {
      await createEvent(TOKEN_A, {
        title: 'Private',
        startAt: '2026-09-22T15:00:00.000Z',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/calendar/events?${WINDOW}`,
        headers: auth(TOKEN_B),
      });
      expect(response.json().events).toHaveLength(0);
    });

    it('cannot update another user’s event by id', async () => {
      const { event } = await createEvent(TOKEN_A, {
        title: 'Private',
        startAt: '2026-09-22T15:00:00.000Z',
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/calendar/events/${String(event.id)}`,
        headers: auth(TOKEN_B),
        payload: { title: 'Hijacked' },
      });

      expect(response.statusCode).toBe(404);
      const stored = await CalendarEvent.findById(String(event.id)).lean().exec();
      expect(stored?.title).toBe('Private');
    });

    it('cannot delete another user’s event by id', async () => {
      const { event } = await createEvent(TOKEN_A, {
        title: 'Private',
        startAt: '2026-09-22T15:00:00.000Z',
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/calendar/events/${String(event.id)}`,
        headers: auth(TOKEN_B),
      });

      expect(response.statusCode).toBe(404);
      expect(await CalendarEvent.countDocuments({ userId: userAId })).toBe(1);
    });

    it('cannot link an event to another user’s class', async () => {
      const klass = await ClassroomClass.create({
        userId: userAId,
        source: 'google_classroom_browser',
        sourceId: 'course-a',
        dedupeKey: `${String(userAId)}:course-a`,
        name: 'A private class name',
        contentHash: 'h',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        lastSyncedAt: new Date(),
      });

      const { status } = await createEvent(TOKEN_B, {
        title: 'Probe',
        startAt: '2026-09-22T15:00:00.000Z',
        classId: String(klass._id),
      });

      // Without this check the class NAME would come back in the listing.
      expect(status).toBe(404);
      expect(await CalendarEvent.countDocuments({ userId: userBId })).toBe(0);
    });
  });

  // --- Auth ---------------------------------------------------------------

  describe('authentication', () => {
    const routes: Array<[string, string]> = [
      ['GET', `/api/v1/calendar/events?${WINDOW}`],
      ['POST', '/api/v1/calendar/events'],
      ['PATCH', '/api/v1/calendar/events/64b7f3c2a1d4e5f601234567'],
      ['DELETE', '/api/v1/calendar/events/64b7f3c2a1d4e5f601234567'],
    ];

    it.each(routes)('%s %s requires a token', async (method, url) => {
      const response = await app.inject({ method: method as 'GET', url });
      expect(response.statusCode).toBe(401);
    });
  });
});

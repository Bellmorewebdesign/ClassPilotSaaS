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
import { Assignment, ClassroomClass, ExtensionToken, User } from '../models/index.js';
import { buildServer } from '../server.js';
import { assignmentCandidate, classCandidate, syncPayload } from './helpers/fixtures.js';
import {
  clearTestDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
  silentLogger,
  syncTestIndexes,
} from './helpers/mongo.js';

/**
 * HTTP-level behaviour: authentication, validation and cross-user isolation.
 *
 * The isolation tests here matter most. They prove that user B cannot read
 * user A's rows through any route, by id or by filter — the property that
 * makes this architecture multi-tenant rather than merely multi-user-shaped.
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

/** Create a user with a registered extension token. */
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

describe.skipIf(!dbAvailable)('HTTP routes', () => {
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

  // --- Authentication -----------------------------------------------------

  describe('authentication', () => {
    const protectedRoutes: Array<[string, string]> = [
      ['GET', '/api/v1/me'],
      ['GET', '/api/v1/classes'],
      ['GET', '/api/v1/assignments'],
      ['GET', '/api/v1/sync/status'],
      ['POST', '/api/v1/sync/classroom'],
      ['POST', '/api/v1/sync/classroom/batch'],
    ];

    it.each(protectedRoutes)('rejects %s %s without a token', async (method, url) => {
      const response = await app.inject({ method: method as 'GET', url, payload: {} });
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('unauthorized');
    });

    it('rejects a malformed Authorization header', async () => {
      for (const header of ['Bearer', 'Basic abc', TOKEN_A, 'Bearer ']) {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/me',
          headers: { authorization: header },
        });
        expect(response.statusCode).toBe(401);
      }
    });

    it('rejects an unknown token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: auth('z'.repeat(64)),
      });
      expect(response.statusCode).toBe(401);
    });

    it('rejects a revoked token', async () => {
      await ExtensionToken.updateOne(
        { tokenHash: hashToken(TOKEN_A) },
        { $set: { revokedAt: new Date() } },
      );
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: auth(TOKEN_A),
      });
      expect(response.statusCode).toBe(401);
    });

    it('gives the same response for a missing and an unknown token', async () => {
      const missing = await app.inject({ method: 'GET', url: '/api/v1/me' });
      const unknown = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: auth('z'.repeat(64)),
      });
      expect(missing.json()).toEqual(unknown.json());
    });

    it('accepts a valid token and identifies the user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: auth(TOKEN_A),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        id: userAId.toString(),
        email: 'a@classpilot.local',
        authMode: 'dev',
      });
    });

    it('never echoes the token back in any response', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: auth(TOKEN_A),
      });
      expect(response.body).not.toContain(TOKEN_A);
    });
  });

  // --- Validation ---------------------------------------------------------

  describe('validation', () => {
    it('rejects a sync payload with no syncId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sync/classroom',
        headers: auth(TOKEN_A),
        payload: { classes: [], assignments: [] },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: 'syncId' })]),
      );
    });

    it('rejects an attachment URL that is not http(s)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sync/classroom',
        headers: auth(TOKEN_A),
        payload: syncPayload({
          assignments: [
            assignmentCandidate({
              attachments: [
                {
                  name: 'Evil',
                  url: 'javascript:alert(document.cookie)',
                  mimeType: null,
                  provider: 'unknown',
                  attachmentType: 'unknown',
                },
              ],
            }),
          ],
        }),
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects more classes than the per-request cap allows', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/sync/classroom',
        headers: auth(TOKEN_A),
        payload: syncPayload({
          classes: Array.from({ length: 201 }, (_, i) =>
            classCandidate({ sourceId: `CLASS${i}`, canonicalUrl: null }),
          ),
        }),
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects an invalid ObjectId in a path parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/classes/not-an-object-id',
        headers: auth(TOKEN_A),
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects an out-of-vocabulary status filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/assignments?status=hacked',
        headers: auth(TOKEN_A),
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects a limit above the maximum', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/assignments?limit=99999',
        headers: auth(TOKEN_A),
      });
      expect(response.statusCode).toBe(400);
    });
  });

  // --- End-to-end sync ----------------------------------------------------

  describe('sync', () => {
    it('stores a sync and exposes it through the read endpoints', async () => {
      const sync = await app.inject({
        method: 'POST',
        url: '/api/v1/sync/classroom',
        headers: auth(TOKEN_A),
        payload: syncPayload(),
      });
      expect(sync.statusCode).toBe(200);
      expect(sync.json()).toMatchObject({ classesCreated: 1, assignmentsCreated: 1 });

      const classes = await app.inject({
        method: 'GET',
        url: '/api/v1/classes',
        headers: auth(TOKEN_A),
      });
      expect(classes.json().items).toHaveLength(1);
      expect(classes.json().items[0]).toMatchObject({
        name: 'AP Calculus AB',
        teacherName: 'Mr. Rivera',
        assignmentCount: 1,
      });

      const classId = classes.json().items[0].id;
      const assignments = await app.inject({
        method: 'GET',
        url: `/api/v1/assignments?classId=${classId}`,
        headers: auth(TOKEN_A),
      });
      expect(assignments.json().items[0]).toMatchObject({
        title: 'Limits Worksheet',
        className: 'AP Calculus AB',
        pointsPossible: 100,
      });
    });

    it('never leaks internal bookkeeping fields to the client', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/sync/classroom',
        headers: auth(TOKEN_A),
        payload: syncPayload(),
      });
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/classes',
        headers: auth(TOKEN_A),
      });
      expect(response.body).not.toContain('dedupeKey');
      expect(response.body).not.toContain('contentHash');
      expect(response.body).not.toContain('userId');
    });

    it('reports sync status after a run', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/sync/classroom',
        headers: auth(TOKEN_A),
        payload: syncPayload(),
      });
      const status = await app.inject({
        method: 'GET',
        url: '/api/v1/sync/status',
        headers: auth(TOKEN_A),
      });
      expect(status.json()).toMatchObject({
        lastSync: expect.objectContaining({ status: 'completed' }),
        activeSync: null,
        totals: { classes: 1, assignments: 1 },
      });
    });
  });

  // --- User isolation -----------------------------------------------------

  describe('user isolation', () => {
    beforeEach(async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/sync/classroom',
        headers: auth(TOKEN_A),
        payload: syncPayload(),
      });
    });

    it("user B's list endpoints do not show user A's data", async () => {
      const classes = await app.inject({
        method: 'GET',
        url: '/api/v1/classes',
        headers: auth(TOKEN_B),
      });
      expect(classes.json()).toMatchObject({ items: [], total: 0 });

      const assignments = await app.inject({
        method: 'GET',
        url: '/api/v1/assignments',
        headers: auth(TOKEN_B),
      });
      expect(assignments.json()).toMatchObject({ items: [], total: 0 });
    });

    it("user B gets 404 (not 403) fetching user A's class by id", async () => {
      const klass = await ClassroomClass.findOne({ userId: userAId }).lean();
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/classes/${klass!._id.toString()}`,
        headers: auth(TOKEN_B),
      });
      // 404 rather than 403: the response must not confirm the id exists.
      expect(response.statusCode).toBe(404);
    });

    it("user B gets 404 fetching user A's assignment by id", async () => {
      const assignment = await Assignment.findOne({ userId: userAId }).lean();
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/assignments/${assignment!._id.toString()}`,
        headers: auth(TOKEN_B),
      });
      expect(response.statusCode).toBe(404);
    });

    it("user B cannot filter into user A's class", async () => {
      const klass = await ClassroomClass.findOne({ userId: userAId }).lean();
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/assignments?classId=${klass!._id.toString()}`,
        headers: auth(TOKEN_B),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().items).toEqual([]);
    });

    it("user B's sync status does not reflect user A's run", async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/sync/status',
        headers: auth(TOKEN_B),
      });
      expect(response.json()).toMatchObject({
        lastSync: null,
        totals: { classes: 0, assignments: 0 },
      });
      expect(userBId).toBeDefined();
    });
  });

  // --- Dev connection info -----------------------------------------------

  describe('GET /api/v1/dev/connection', () => {
    it('never returns the token itself', async () => {
      await User.create({
        email: env.DEV_USER_EMAIL.toLowerCase(),
        displayName: 'Dev',
        authMode: 'dev',
      });
      const devUser = await User.findOne({ email: env.DEV_USER_EMAIL.toLowerCase() }).lean();
      await ExtensionToken.create({
        userId: devUser!._id,
        tokenHash: hashToken(TOKEN_A),
        label: 'dev',
        lastFourChars: TOKEN_A.slice(-4),
        lastUsedAt: null,
        revokedAt: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/dev/connection',
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).not.toContain(TOKEN_A);
      expect(response.json().token).toMatchObject({
        configured: true,
        lastFourChars: TOKEN_A.slice(-4),
      });
    });
  });
});

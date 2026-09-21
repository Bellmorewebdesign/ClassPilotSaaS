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
  ASSIGNMENT_STATUSES,
  type AssignmentDto,
  type PaginatedDto,
} from '@classpilot/shared';
import { ApiError } from '../lib/errors.js';
import { parseOrThrow } from '../lib/validate.js';
import { Assignment, ClassroomClass } from '../models/index.js';
import { currentUser, requireAuth } from '../plugins/auth.js';
import { serializeAssignment } from '../services/serialize.js';

const objectId = z
  .string()
  .refine((value) => mongoose.Types.ObjectId.isValid(value), 'invalid id');

const listQuerySchema = z.object({
  classId: objectId.optional(),
  status: z.enum(ASSIGNMENT_STATUSES).optional(),
  /** Only items due at or after this instant. Powers "due soon". */
  dueAfter: z.iso.datetime({ offset: true }).optional(),
  dueBefore: z.iso.datetime({ offset: true }).optional(),
  sort: z.enum(['dueAt', 'lastSyncedAt', 'title']).default('dueAt'),
  order: z.enum(['asc', 'desc']).default('asc'),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const idParamSchema = z.object({ id: objectId });

/**
 * Assignments.
 *
 * As with classes, `userId` always comes from the authenticated request. A
 * `classId` filter is an additional narrowing, never a way around the scope.
 */
export async function registerAssignmentRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/assignments', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const query = parseOrThrow(listQuerySchema, request.query);

    const filter: Record<string, unknown> = { userId: user.id };
    if (query.classId) filter.classId = new mongoose.Types.ObjectId(query.classId);
    if (query.status) filter.status = query.status;
    if (query.dueAfter || query.dueBefore) {
      filter.dueAt = {
        ...(query.dueAfter ? { $gte: new Date(query.dueAfter) } : {}),
        ...(query.dueBefore ? { $lte: new Date(query.dueBefore) } : {}),
      };
    }

    const direction = query.order === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [query.sort]: direction };
    // Tie-break on _id so pagination is stable when many rows share a value
    // (very common: a whole class of assignments with no due date).
    sort._id = 1;

    const [docs, total] = await Promise.all([
      Assignment.find(filter).sort(sort).skip(query.offset).limit(query.limit).lean().exec(),
      Assignment.countDocuments(filter).exec(),
    ]);

    const names = await classNames(
      user.id,
      docs.map((doc) => doc.classId),
    );

    const body: PaginatedDto<AssignmentDto> = {
      items: docs.map((doc) =>
        serializeAssignment(doc, names.get(doc.classId.toString()) ?? null),
      ),
      total,
      limit: query.limit,
      offset: query.offset,
    };
    return body;
  });

  app.get('/api/v1/assignments/:id', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const { id } = parseOrThrow(idParamSchema, request.params);

    const doc = await Assignment.findOne({
      _id: new mongoose.Types.ObjectId(id),
      userId: user.id,
    })
      .lean()
      .exec();

    if (!doc) throw ApiError.notFound('Assignment not found.');

    const names = await classNames(user.id, [doc.classId]);
    return serializeAssignment(doc, names.get(doc.classId.toString()) ?? null);
  });
}

/** Resolve class names for a page of assignments in one query. */
async function classNames(
  userId: Types.ObjectId,
  classIds: Types.ObjectId[],
): Promise<Map<string, string>> {
  if (classIds.length === 0) return new Map();
  const unique = [...new Set(classIds.map((id) => id.toString()))].map(
    (id) => new mongoose.Types.ObjectId(id),
  );

  const docs = await ClassroomClass.find({ userId, _id: { $in: unique } })
    .select({ name: 1 })
    .lean()
    .exec();

  return new Map(docs.map((doc) => [doc._id.toString(), doc.name]));
}

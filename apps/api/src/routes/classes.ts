import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import type { Types } from 'mongoose';

/**
 * Mongoose ships as CommonJS, so ESM named value imports of its runtime
 * exports are not reliably available. Runtime use goes through the default
 * import (`mongoose.Types.ObjectId`); `Types` is imported as a type only.
 */
import { z } from 'zod';
import type { ClassDto, PaginatedDto } from '@classpilot/shared';
import { ApiError } from '../lib/errors.js';
import { parseOrThrow } from '../lib/validate.js';
import { Assignment, ClassroomClass } from '../models/index.js';
import { currentUser, requireAuth } from '../plugins/auth.js';
import { serializeClass } from '../services/serialize.js';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const idParamSchema = z.object({
  id: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), 'invalid id'),
});

/**
 * Classes.
 *
 * Every query below filters on `userId` taken from the authenticated request
 * — never from a parameter — so there is no request shape that can reach
 * another user's rows.
 */
export async function registerClassRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/classes', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const query = parseOrThrow(listQuerySchema, request.query);

    const [docs, total] = await Promise.all([
      ClassroomClass.find({ userId: user.id })
        .sort({ name: 1 })
        .skip(query.offset)
        .limit(query.limit)
        .lean()
        .exec(),
      ClassroomClass.countDocuments({ userId: user.id }).exec(),
    ]);

    const counts = await assignmentCountsByClass(
      user.id,
      docs.map((doc) => doc._id),
    );

    const body: PaginatedDto<ClassDto> = {
      items: docs.map((doc) => serializeClass(doc, counts.get(doc._id.toString()) ?? 0)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
    return body;
  });

  app.get('/api/v1/classes/:id', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const { id } = parseOrThrow(idParamSchema, request.params);

    const doc = await ClassroomClass.findOne({
      _id: new mongoose.Types.ObjectId(id),
      userId: user.id,
    })
      .lean()
      .exec();

    // A class belonging to someone else is reported as 404, not 403: the
    // response must not confirm that the id exists.
    if (!doc) throw ApiError.notFound('Class not found.');

    const counts = await assignmentCountsByClass(user.id, [doc._id]);
    return serializeClass(doc, counts.get(doc._id.toString()) ?? 0);
  });
}

/** One aggregation instead of one count per class. */
async function assignmentCountsByClass(
  userId: Types.ObjectId,
  classIds: Types.ObjectId[],
): Promise<Map<string, number>> {
  if (classIds.length === 0) return new Map();

  const rows = await Assignment.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { userId, classId: { $in: classIds } } },
    { $group: { _id: '$classId', count: { $sum: 1 } } },
  ]).exec();

  return new Map(rows.map((row) => [row._id.toString(), row.count]));
}

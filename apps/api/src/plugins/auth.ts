import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { Types } from 'mongoose';

/**
 * Mongoose ships as CommonJS, so ESM named value imports of its runtime
 * exports are not reliably available. Only the `Types` type is needed here,
 * which imports normally.
 */
import { hashToken } from '../db/bootstrap.js';
import { ApiError } from '../lib/errors.js';
import { ExtensionToken, User } from '../models/index.js';

/**
 * Bearer-token authentication.
 *
 * V1 resolves a token to the single development user. The important property
 * is not the mechanism but the shape: every authenticated request ends up
 * carrying a `userId`, and every query in this API filters by it. Swapping in
 * sessions, JWTs or an identity provider later means rewriting only
 * `resolveToken` below.
 *
 * The raw token never leaves this function: we hash it immediately and match
 * on the hash.
 */

export interface AuthenticatedUser {
  id: Types.ObjectId;
  email: string;
  displayName: string | null;
  authMode: 'dev' | 'production';
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by requireAuth. Absent on unauthenticated routes. */
    currentUser?: AuthenticatedUser;
  }
}

/** Pull the bearer token out of the Authorization header. */
function readBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

async function resolveToken(rawToken: string): Promise<AuthenticatedUser | null> {
  const tokenRecord = await ExtensionToken.findOne({
    tokenHash: hashToken(rawToken),
    revokedAt: null,
  })
    .lean()
    .exec();

  if (!tokenRecord) return null;

  const user = await User.findById(tokenRecord.userId).lean().exec();
  if (!user) return null;

  // Best-effort usage tracking; never block the request on it.
  void ExtensionToken.updateOne(
    { _id: tokenRecord._id },
    { $set: { lastUsedAt: new Date() } },
  ).exec();

  return {
    id: user._id,
    email: user.email,
    displayName: user.displayName ?? null,
    authMode: user.authMode,
  };
}

/**
 * preHandler that rejects the request unless it carries a valid token.
 *
 * Responses are deliberately identical for "no header", "malformed header"
 * and "unknown token" so the endpoint cannot be used to probe which tokens
 * exist.
 */
export const requireAuth: preHandlerHookHandler = async (
  request: FastifyRequest,
  _reply: FastifyReply,
) => {
  const rawToken = readBearerToken(request);
  if (!rawToken) throw ApiError.unauthorized();

  const user = await resolveToken(rawToken);
  if (!user) throw ApiError.unauthorized();

  request.currentUser = user;
};

/**
 * Read the authenticated user, or throw.
 * Route handlers call this instead of reaching for `request.currentUser`
 * directly, so a route that forgets `requireAuth` fails loudly.
 */
export function currentUser(request: FastifyRequest): AuthenticatedUser {
  if (!request.currentUser) {
    throw ApiError.unauthorized('This route requires authentication.');
  }
  return request.currentUser;
}

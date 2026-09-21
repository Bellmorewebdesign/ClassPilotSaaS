import type { z } from 'zod';
import { ApiError } from './errors.js';

/**
 * Validate untrusted input with a Zod schema, turning any failure into a 400
 * with per-field detail.
 *
 * Every route uses this. There is no code path in the API that reads a
 * request body, query or param without passing it through a schema first.
 */
export function parseOrThrow<T extends z.ZodType>(
  schema: T,
  value: unknown,
  message = 'Invalid request.',
): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw ApiError.badRequest(
      message,
      result.error.issues.map((issue) => ({
        path: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    );
  }
  return result.data;
}

import type { ApiErrorDto } from '@classpilot/shared';

/**
 * A failure the client is allowed to see.
 *
 * Anything thrown that is NOT an ApiError is treated as a bug: it is logged
 * with its stack and returned to the client as a bare 500 with no internals.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Array<{ path: string; message: string }>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    if (details) this.details = details;
  }

  toResponse(): ApiErrorDto {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }

  static badRequest(
    message: string,
    details?: Array<{ path: string; message: string }>,
  ): ApiError {
    return new ApiError(400, 'bad_request', message, details);
  }

  static unauthorized(message = 'Missing or invalid API token.'): ApiError {
    return new ApiError(401, 'unauthorized', message);
  }

  static notFound(message = 'Not found.'): ApiError {
    return new ApiError(404, 'not_found', message);
  }

  static serviceUnavailable(message: string): ApiError {
    return new ApiError(503, 'service_unavailable', message);
  }
}

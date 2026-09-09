import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { ErrorCode } from '@tp/shared'

export type { ErrorCode }

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: ContentfulStatusCode,
    message: string,
    readonly details?: unknown,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = new.target.name
  }
}

export class UnauthorizedError extends AppError {
  constructor(
    message = 'Authentication required',
    details?: unknown,
    options?: { cause?: unknown },
  ) {
    super('unauthorized', 401, message, details, options)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Not allowed', details?: unknown, options?: { cause?: unknown }) {
    super('forbidden', 403, message, details, options)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found', details?: unknown, options?: { cause?: unknown }) {
    super('not_found', 404, message, details, options)
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown, options?: { cause?: unknown }) {
    super('conflict', 409, message, details, options)
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request', details?: unknown) {
    super('validation_failed', 422, message, details)
  }
}

/** Too much, too fast, from one place. Try again in a moment. */
export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests', details?: unknown) {
    super('too_many_requests', 429, message, details)
  }
}

/** The request was well-formed but asks for something the domain does not allow. */
export class RuleViolationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('rule_violation', 422, message, details)
  }
}

export class UpstreamUnavailableError extends AppError {
  constructor(message = 'A dependency is unavailable', options?: { cause?: unknown }) {
    super('upstream_unavailable', 503, message, undefined, options)
  }
}

export class InternalError extends AppError {
  constructor(message = 'Something went wrong', options?: { cause?: unknown }) {
    super('internal', 500, message, undefined, options)
  }
}

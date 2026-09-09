import type { ErrorHandler, NotFoundHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { z, ZodError } from 'zod'
import { logger } from '../lib/logger'
import type { AppEnv } from './context'
import { AppError, type ErrorCode } from './errors'

function envelope(code: ErrorCode, message: string, requestId: string, details?: unknown) {
  return { error: { code, message, requestId, details: details ?? null } }
}

const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  400: 'validation_failed',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  // A body over the limit is a request that is wrong, not a server that is broken.
  413: 'validation_failed',
  422: 'validation_failed',
  429: 'too_many_requests',
  503: 'upstream_unavailable',
}

/**
 * Every failure leaves through here, so responses have one shape whatever went wrong.
 *
 * Handlers throw rather than returning an error response, and that is not a style
 * preference: returning `c.json({ error }, 409)` would put the error shape into the
 * route's response union, forcing every caller of the typed client to narrow before
 * touching the data it actually wanted.
 */
export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get('requestId') ?? 'unknown'
  const log = c.get('log') ?? logger

  if (err instanceof AppError) {
    // A 5xx is our fault and deserves attention; a 4xx is the caller being wrong.
    log[err.status >= 500 ? 'error' : 'warn']({ err, code: err.code }, err.message)

    return c.json(envelope(err.code, err.message, requestId, err.details), err.status)
  }

  if (err instanceof HTTPException) {
    log.warn({ err }, err.message)
    const status = err.status as ContentfulStatusCode

    return c.json(envelope(CODE_BY_STATUS[status] ?? 'internal', err.message, requestId), status)
  }

  if (err instanceof ZodError) {
    // validate() normally converts these first; one reaching here is a wiring mistake.
    log.warn({ err }, 'Validation error escaped its middleware')

    return c.json(
      envelope('validation_failed', 'Invalid request', requestId, z.treeifyError(err)),
      422,
    )
  }

  // Nothing recognised: log everything, tell the caller nothing.
  log.error({ err }, 'Unhandled error')

  return c.json(envelope('internal', 'Something went wrong', requestId), 500)
}

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) =>
  c.json(envelope('not_found', 'No such route', c.get('requestId') ?? 'unknown'), 404)

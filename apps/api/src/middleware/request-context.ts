import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../http/context'
import { logger as rootLogger } from '../lib/logger'

/**
 * Gives every request an id-carrying logger and writes one completion line.
 *
 * Runs after Hono's own `requestId()`, which both fills the variable and sets the
 * X-Request-Id response header — so a user reporting "it failed" can hand over an id
 * that finds the exact request in the logs.
 */
export const requestContext = createMiddleware<AppEnv>(async (c, next) => {
  const requestId = c.get('requestId')
  const log = rootLogger.child({ requestId })

  c.set('log', log)

  const startedAt = performance.now()
  await next()

  log.info(
    {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Math.round(performance.now() - startedAt),
      userId: c.get('auth')?.userId,
    },
    'request completed',
  )
})

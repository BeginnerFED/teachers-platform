import { createMiddleware } from 'hono/factory'
import type { Enums } from '@tp/shared'
import { getAuth, type AppEnv } from '../http/context'
import { ForbiddenError } from '../http/errors'

/**
 * Must be mounted after requireAuth. getAuth throws rather than returning undefined, so
 * forgetting that ordering fails the request instead of quietly letting everyone through.
 */
export function requireRole(...allowed: Enums<'user_role'>[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const auth = getAuth(c)

    if (!allowed.includes(auth.role)) {
      throw new ForbiddenError(`This route is restricted to: ${allowed.join(', ')}`)
    }

    await next()
  })
}

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { env } from './env'
import type { AppEnv } from './http/context'
import { errorHandler, notFoundHandler } from './http/error-handler'
import { requestContext } from './middleware/request-context'
import { healthRoutes } from './modules/health/health.routes'
import { meRoutes } from './modules/identity/me.routes'
import { teachersRoutes } from './modules/teachers/teachers.routes'

const base = new Hono<AppEnv>()

base.use('*', requestId())
base.use('*', requestContext)
base.use('*', secureHeaders())

// No `credentials: true` here on purpose: this API authenticates with a bearer token,
// not cookies, and advertising cookie support would mislead the next person reading it.
base.use(
  '*',
  cors({
    origin: env.WEB_ORIGIN,
    allowHeaders: ['authorization', 'content-type'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
)

base.onError(errorHandler)
base.notFound(notFoundHandler)

/**
 * Routes are chained in one expression; middleware, onError and notFound are registered
 * on `base` above. That split is load-bearing: only the chained calls accumulate into
 * `AppType`, which is what gives the web app a typed client. Breaking the chain silently
 * degrades those types to `any`.
 */
export const app = base
  .get('/', (c) => c.json({ data: { name: 'teachers-platform api', status: 'ok' as const } }))
  .route('/v1/health', healthRoutes)
  .route('/v1/me', meRoutes)
  .route('/v1/admin/teachers', teachersRoutes)

export type AppType = typeof app

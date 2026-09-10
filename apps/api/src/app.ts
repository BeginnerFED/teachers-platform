import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { env } from './env'
import type { AppEnv } from './http/context'
import { errorHandler, notFoundHandler } from './http/error-handler'
import { requestContext } from './middleware/request-context'
import { accountsRoutes } from './modules/accounts/accounts.routes'
import { adminsRoutes } from './modules/admins/admins.routes'
import { assetsRoutes } from './modules/assets/assets.routes'
import { assignmentsRoutes } from './modules/assignments/assignments.routes'
import { healthRoutes } from './modules/health/health.routes'
import { meRoutes } from './modules/identity/me.routes'
import { liveRoutes } from './modules/live/live.routes'
import { lessonsRoutes } from './modules/lessons/lessons.routes'
import { materialsRoutes } from './modules/materials/materials.routes'
import { conversationsRoutes } from './modules/messaging/messaging.routes'
import { searchRoutes } from './modules/search/search.routes'
import { adminSettingsRoutes, settingsRoutes } from './modules/settings/settings.routes'
import { studentsRoutes } from './modules/students/students.routes'
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
  .route('/v1/settings', settingsRoutes)
  .route('/v1/conversations', conversationsRoutes)
  .route('/v1/search', searchRoutes)
  .route('/v1/materials', materialsRoutes)
  .route('/v1/assignments', assignmentsRoutes)
  .route('/v1/assets', assetsRoutes)
  .route('/v1/live', liveRoutes)
  .route('/v1/admin/settings', adminSettingsRoutes)
  .route('/v1/admin/teachers', teachersRoutes)
  .route('/v1/admin/students', studentsRoutes)
  .route('/v1/admin/lessons', lessonsRoutes)
  .route('/v1/admin/admins', adminsRoutes)
  .route('/v1/admin/accounts', accountsRoutes)

export type AppType = typeof app

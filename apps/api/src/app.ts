import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { env } from './env'
import { health } from './routes/health'

const base = new Hono()

base.use('*', logger())
base.use('*', cors({ origin: env.WEB_ORIGIN, credentials: true }))

/**
 * Routes are chained rather than registered one statement at a time — that is what
 * lets `AppType` carry every route's shape across to the web app's typed client.
 */
export const app = base
  .get('/', (c) => c.json({ name: 'teachers-platform api', status: 'ok' as const }))
  .route('/health', health)

export type AppType = typeof app

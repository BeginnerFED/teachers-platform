import { Hono } from 'hono'
import type { AppEnv } from '../../http/context'
import { liveness, readiness } from './health.controller'

export const healthRoutes = new Hono<AppEnv>()
  .get('/', ...liveness)
  .get('/ready', ...readiness)

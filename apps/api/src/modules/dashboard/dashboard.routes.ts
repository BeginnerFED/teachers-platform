import { Hono } from 'hono'
import type { AppEnv } from '../../http/context'
import { getDashboard, getDashboardActivity } from './dashboard.controller'

export const dashboardRoutes = new Hono<AppEnv>()
  .get('/', ...getDashboard)
  .get('/activity', ...getDashboardActivity)

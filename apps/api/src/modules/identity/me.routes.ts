import { Hono } from 'hono'
import type { AppEnv } from '../../http/context'
import { getMe } from './me.controller'

export const meRoutes = new Hono<AppEnv>().get('/', ...getMe)

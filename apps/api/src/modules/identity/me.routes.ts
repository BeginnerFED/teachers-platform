import { Hono } from 'hono'
import type { AppEnv } from '../../http/context'
import { getMe, updateMe } from './me.controller'

export const meRoutes = new Hono<AppEnv>().get('/', ...getMe).patch('/', ...updateMe)

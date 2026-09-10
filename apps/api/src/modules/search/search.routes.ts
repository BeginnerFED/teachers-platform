import { Hono } from 'hono'
import type { AppEnv } from '../../http/context'
import { search } from './search.controller'

export const searchRoutes = new Hono<AppEnv>().get('/', ...search)

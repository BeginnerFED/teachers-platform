import { Hono } from 'hono'
import type { AppEnv } from '../../http/context'
import { listLessons } from './lessons.controller'

/**
 * Mounted at /v1/admin/lessons. A window rather than a page: a calendar asks for the week
 * it is drawing, not for the first fifty lessons in it.
 */
export const lessonsRoutes = new Hono<AppEnv>().get('/', ...listLessons)

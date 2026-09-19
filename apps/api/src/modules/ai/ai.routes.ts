import { Hono } from 'hono'
import type { AppEnv } from '../../http/context'
import { generateLessonDraft, getAiUsage } from './ai.controller'

export const aiRoutes = new Hono<AppEnv>()
  .get('/usage', ...getAiUsage)
  .post('/lesson-drafts', ...generateLessonDraft)

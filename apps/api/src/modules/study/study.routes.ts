import { Hono } from 'hono'
import { readStudyUpdatesBody, studyLessonsQuery } from '@tp/shared'
import { getAuth, type AppEnv } from '../../http/context'
import { validate } from '../../http/validate'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/require-role'
import { studyRepository } from './study.repository'

export const studyRoutes = new Hono<AppEnv>()
  .use('*', requireAuth, requireRole('student'))
  .use('*', async (c, next) => {
    c.header('Cache-Control', 'private, no-store')
    await next()
  })
  .get('/lessons', validate('query', studyLessonsQuery), async (c) =>
    c.json({ data: await studyRepository.lessons(getAuth(c).userId, c.req.valid('query')) }),
  )
  .get('/upcoming', async (c) =>
    c.json({ data: await studyRepository.upcoming(getAuth(c).userId) }),
  )
  .get('/teachers', async (c) =>
    c.json({ data: await studyRepository.teachers(getAuth(c).userId) }),
  )
  .get('/notifications', async (c) =>
    c.json({ data: await studyRepository.notifications(getAuth(c).userId) }),
  )
  .post('/notifications/read', validate('json', readStudyUpdatesBody), async (c) =>
    c.json({
      data: await studyRepository.readNotifications(getAuth(c).userId, c.req.valid('json').items),
    }),
  )

import { Hono } from 'hono'
import { readStudyUpdatesBody, updateNotificationPreferencesBody } from '@tp/shared'
import { getAuth, type AppEnv } from '../../http/context'
import { validate } from '../../http/validate'
import { requireAuth } from '../../middleware/auth'
import { remindersRepository } from './reminders.repository'
import { studyRepository } from '../study/study.repository'
import { preferencesRepository } from './preferences.repository'

export const remindersRoutes = new Hono<AppEnv>()
  .use('*', requireAuth)
  .use('*', async (c, next) => {
    c.header('Cache-Control', 'private, no-store')
    await next()
  })
  .get('/', async (c) => {
    const { userId, role } = getAuth(c)
    return c.json({
      data:
        role === 'student'
          ? await studyRepository.notifications(userId)
          : await remindersRepository.list(userId),
    })
  })
  .get('/preferences', async (c) => {
    return c.json({ data: await preferencesRepository.get(getAuth(c).userId) })
  })
  .patch('/preferences', validate('json', updateNotificationPreferencesBody), async (c) => {
    const data = await preferencesRepository.update(getAuth(c).userId, c.req.valid('json'))
    return c.json({ data })
  })
  .post('/read', validate('json', readStudyUpdatesBody), async (c) => {
    const { userId, role } = getAuth(c)
    const { items } = c.req.valid('json')
    if (role === 'student') await studyRepository.readNotifications(userId, items)
    else await remindersRepository.markRead(userId, items)
    return c.json({ data: { read: true } })
  })

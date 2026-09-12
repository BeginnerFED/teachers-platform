import {
  lessonIdParam,
  listLessonsQuery,
  listMyLessonsQuery,
  scheduleLessonBody,
  updateLessonBody,
} from '@tp/shared'
import { getAuth } from '../../http/context'
import { factory } from '../../http/factory'
import { validate } from '../../http/validate'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/require-role'
import { lessonsService } from './lessons.service'

const adminOnly = [requireAuth, requireRole('admin')] as const

export const updateMyLesson = factory.createHandlers(
  requireAuth,
  requireRole('teacher'),
  validate('param', lessonIdParam),
  validate('json', updateLessonBody),
  async (c) => {
    const data = await lessonsService.update(
      getAuth(c).userId,
      c.req.valid('param').lessonId,
      c.req.valid('json'),
    )
    c.header('Cache-Control', 'private, no-store')
    return c.json({ data })
  },
)

export const scheduleMyLesson = factory.createHandlers(
  requireAuth,
  requireRole('teacher'),
  validate('json', scheduleLessonBody),
  async (c) => {
    const data = await lessonsService.schedule(getAuth(c).userId, c.req.valid('json'))
    c.header('Cache-Control', 'private, no-store')
    return c.json({ data }, 201)
  },
)

export const listLessons = factory.createHandlers(
  ...adminOnly,
  validate('query', listLessonsQuery),
  async (c) => {
    const data = await lessonsService.listForRange(c.req.valid('query'))

    return c.json({ data })
  },
)

export const listMyLessons = factory.createHandlers(
  requireAuth,
  requireRole('teacher'),
  validate('query', listMyLessonsQuery),
  async (c) => {
    const data = await lessonsService.listForTeacher(getAuth(c).userId, c.req.valid('query'))

    c.header('Cache-Control', 'private, no-store')
    return c.json({ data })
  },
)

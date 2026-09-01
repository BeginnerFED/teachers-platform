import { listLessonsQuery } from '@tp/shared'
import { factory } from '../../http/factory'
import { validate } from '../../http/validate'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/require-role'
import { lessonsService } from './lessons.service'

const adminOnly = [requireAuth, requireRole('admin')] as const

export const listLessons = factory.createHandlers(
  ...adminOnly,
  validate('query', listLessonsQuery),
  async (c) => {
    const data = await lessonsService.listForRange(c.req.valid('query'))

    return c.json({ data })
  },
)

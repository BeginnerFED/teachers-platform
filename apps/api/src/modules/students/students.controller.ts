import { listStudentsQuery, studentIdParam } from '@tp/shared'
import { factory } from '../../http/factory'
import { validate } from '../../http/validate'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/require-role'
import { studentsService } from './students.service'

const adminOnly = [requireAuth, requireRole('admin')] as const

export const listStudents = factory.createHandlers(
  ...adminOnly,
  validate('query', listStudentsQuery),
  async (c) => {
    const { items, meta } = await studentsService.list(c.req.valid('query'))

    return c.json({ data: items, meta })
  },
)

export const getStudent = factory.createHandlers(
  ...adminOnly,
  validate('param', studentIdParam),
  async (c) => {
    const data = await studentsService.getDetail(c.req.valid('param').studentId)

    return c.json({ data })
  },
)

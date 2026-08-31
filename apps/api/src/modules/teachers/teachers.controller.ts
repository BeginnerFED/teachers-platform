import {
  extendSubscriptionBody,
  listTeachersQuery,
  suspendSubscriptionBody,
  teacherIdParam,
} from '@tp/shared'
import { getAuth } from '../../http/context'
import { factory } from '../../http/factory'
import { validate } from '../../http/validate'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/require-role'
import { teachersService } from './teachers.service'

const adminOnly = [requireAuth, requireRole('admin')] as const

export const listTeachers = factory.createHandlers(
  ...adminOnly,
  validate('query', listTeachersQuery),
  async (c) => {
    const { items, meta } = await teachersService.list(c.req.valid('query'))

    return c.json({ data: items, meta })
  },
)

export const getTeacher = factory.createHandlers(
  ...adminOnly,
  validate('param', teacherIdParam),
  async (c) => {
    const data = await teachersService.getDetail(c.req.valid('param').teacherId)

    return c.json({ data })
  },
)

export const extendSubscription = factory.createHandlers(
  ...adminOnly,
  validate('param', teacherIdParam),
  validate('json', extendSubscriptionBody),
  async (c) => {
    const { teacherId } = c.req.valid('param')
    const { months } = c.req.valid('json')

    const data = await teachersService.extendSubscription({
      teacherId,
      months,
      actorId: getAuth(c).userId,
    })

    return c.json({ data })
  },
)

export const suspendSubscription = factory.createHandlers(
  ...adminOnly,
  validate('param', teacherIdParam),
  validate('json', suspendSubscriptionBody),
  async (c) => {
    const { teacherId } = c.req.valid('param')
    const { reason } = c.req.valid('json')

    const data = await teachersService.suspendSubscription({
      teacherId,
      reason,
      actorId: getAuth(c).userId,
    })

    return c.json({ data })
  },
)

export const reactivateSubscription = factory.createHandlers(
  ...adminOnly,
  validate('param', teacherIdParam),
  async (c) => {
    const { teacherId } = c.req.valid('param')

    const data = await teachersService.reactivateSubscription({
      teacherId,
      actorId: getAuth(c).userId,
    })

    return c.json({ data })
  },
)

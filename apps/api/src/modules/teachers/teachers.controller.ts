import {
  createAccountBody,
  extendSubscriptionBody,
  linkStudentBody,
  listTeachersQuery,
  suspendSubscriptionBody,
  teacherIdParam,
  teacherStudentParam,
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

export const createTeacher = factory.createHandlers(
  ...adminOnly,
  validate('json', createAccountBody),
  async (c) => {
    const data = await teachersService.create(c.req.valid('json'))

    return c.json({ data }, 201)
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

/** Puts a student with this teacher. Answers with the roster as it now stands. */
export const linkStudent = factory.createHandlers(
  ...adminOnly,
  validate('param', teacherIdParam),
  validate('json', linkStudentBody),
  async (c) => {
    const { teacherId } = c.req.valid('param')
    const { studentId } = c.req.valid('json')

    await teachersService.linkStudent({ teacherId, studentId })

    return c.json({ data: await teachersService.getDetail(teacherId) }, 201)
  },
)

export const unlinkStudent = factory.createHandlers(
  ...adminOnly,
  validate('param', teacherStudentParam),
  async (c) => {
    const { teacherId, studentId } = c.req.valid('param')

    await teachersService.unlinkStudent({ teacherId, studentId })

    return c.json({ data: await teachersService.getDetail(teacherId) })
  },
)

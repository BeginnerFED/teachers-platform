import {
  cancelLessonSeriesBody,
  creditGrantParam,
  reverseLessonCreditsBody,
  grantLessonCreditsBody,
  lessonIdParam,
  lessonStudentParam,
  recordAttendanceBody,
} from '@tp/shared'
import { getAuth } from '../../http/context'
import { factory } from '../../http/factory'
import { validate } from '../../http/validate'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/require-role'
import { attendanceService } from './attendance.service'

const teacherOnly = [requireAuth, requireRole('teacher')] as const
export const previewMyLessonCancellation = factory.createHandlers(
  ...teacherOnly,
  validate('param', lessonIdParam),
  async (c) => {
    const data = await attendanceService.previewCancellation(
      getAuth(c).userId,
      c.req.valid('param').lessonId,
    )
    c.header('Cache-Control', 'private, no-store')
    return c.json({ data })
  },
)
export const cancelMyFollowingLessons = factory.createHandlers(
  ...teacherOnly,
  validate('param', lessonIdParam),
  validate('json', cancelLessonSeriesBody),
  async (c) => {
    const data = await attendanceService.cancelFollowing(
      getAuth(c).userId,
      c.req.valid('param').lessonId,
      c.req.valid('json'),
    )
    c.header('Cache-Control', 'private, no-store')
    return c.json({ data })
  },
)
export const reverseMyStudentCredits = factory.createHandlers(
  ...teacherOnly,
  validate('param', creditGrantParam),
  validate('json', reverseLessonCreditsBody),
  async (c) => {
    const { studentId, grantId } = c.req.valid('param')
    const data = await attendanceService.reverse(
      getAuth(c).userId,
      studentId,
      grantId,
      c.req.valid('json'),
    )
    c.header('Cache-Control', 'private, no-store')
    return c.json({ data })
  },
)
export const listMyStudentOverview = factory.createHandlers(...teacherOnly, async (c) => {
  const data = await attendanceService.overview(getAuth(c).userId)
  c.header('Cache-Control', 'private, no-store')
  return c.json({ data })
})
export const recordMyAttendance = factory.createHandlers(
  ...teacherOnly,
  validate('param', lessonIdParam),
  validate('json', recordAttendanceBody),
  async (c) => {
    const data = await attendanceService.record(
      getAuth(c).userId,
      c.req.valid('param').lessonId,
      c.req.valid('json'),
    )
    c.header('Cache-Control', 'private, no-store')
    return c.json({ data })
  },
)
export const getMyStudentCredits = factory.createHandlers(
  ...teacherOnly,
  validate('param', lessonStudentParam),
  async (c) => {
    const data = await attendanceService.summary(getAuth(c).userId, c.req.valid('param').studentId)
    c.header('Cache-Control', 'private, no-store')
    return c.json({ data })
  },
)
export const grantMyStudentCredits = factory.createHandlers(
  ...teacherOnly,
  validate('param', lessonStudentParam),
  validate('json', grantLessonCreditsBody),
  async (c) => {
    const data = await attendanceService.grant(
      getAuth(c).userId,
      c.req.valid('param').studentId,
      c.req.valid('json'),
    )
    c.header('Cache-Control', 'private, no-store')
    return c.json({ data }, 201)
  },
)
export const listMyPendingLessons = factory.createHandlers(...teacherOnly, async (c) => {
  const data = await attendanceService.pending(getAuth(c).userId)
  c.header('Cache-Control', 'private, no-store')
  return c.json({ data })
})

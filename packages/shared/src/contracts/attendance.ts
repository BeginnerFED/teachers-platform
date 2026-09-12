import { z } from 'zod'
import { ATTENDANCE_STATUSES, LESSON_STATUSES, type CalendarLesson } from './lessons'
import type { MaterialOwner } from './materials'

export const creditGrantParam = z.object({ studentId: z.uuid(), grantId: z.uuid() })
export const reverseLessonCreditsBody = z.strictObject({
  reason: z.string().trim().min(3).max(200),
})
export type ReverseLessonCreditsBody = z.infer<typeof reverseLessonCreditsBody>
export const teacherStudentBalances = z.array(
  z.object({ studentId: z.uuid(), granted: z.number(), used: z.number(), remaining: z.number() }),
)
export type TeacherStudentOverview = MaterialOwner & {
  granted: number
  used: number
  remaining: number
}

export const recordAttendanceBody = z
  .strictObject({
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    status: z.enum(['held', 'canceled', 'scheduled']),
    students: z
      .array(
        z.strictObject({
          studentId: z.uuid(),
          attendance: z.enum(['present', 'absent', 'excused']),
          deductCredit: z.boolean(),
        }),
      )
      .max(50),
  })
  .refine((body) =>
    body.status === 'held' ? body.students.length > 0 : body.students.length === 0,
  )
  .refine(
    (body) =>
      new Set(body.students.map((student) => student.studentId)).size === body.students.length,
  )

export type RecordAttendanceBody = z.infer<typeof recordAttendanceBody>
export const cancelLessonSeriesBody = z.strictObject({
  requestId: z.uuid(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  expectedSeriesUpdatedAt: z.iso.datetime({ offset: true }),
})
export type CancelLessonSeriesBody = z.infer<typeof cancelLessonSeriesBody>
export const lessonSeriesCancellationPreview = z.object({
  expectedUpdatedAt: z.string(),
  expectedSeriesUpdatedAt: z.string(),
  count: z.number().int().positive(),
  from: z.string(),
  to: z.string(),
  hasActiveLesson: z.boolean(),
})
export type LessonSeriesCancellationPreview = z.infer<typeof lessonSeriesCancellationPreview>
export const lessonSeriesCancellationResult = z.object({ count: z.number().int().positive() })
export const lessonStudentParam = z.object({ studentId: z.uuid() })
export const grantLessonCreditsBody = z.strictObject({
  id: z.uuid(),
  units: z.number().int().min(1).max(1000),
  note: z.string().trim().max(200).default(''),
})
export type GrantLessonCreditsBody = z.infer<typeof grantLessonCreditsBody>

export const lessonCreditSummary = z.object({
  granted: z.number(),
  used: z.number(),
  remaining: z.number(),
  canGrant: z.boolean(),
  history: z.array(
    z.object({
      id: z.uuid(),
      scheduledAt: z.string(),
      topic: z.string().nullable(),
      status: z.enum(LESSON_STATUSES),
      attendance: z.enum(ATTENDANCE_STATUSES),
      deducted: z.boolean(),
    }),
  ),
  grants: z.array(
    z.object({
      id: z.uuid(),
      units: z.number(),
      note: z.string().nullable(),
      createdAt: z.string(),
      reversedAt: z.string().nullable(),
      reversalReason: z.string().nullable(),
    }),
  ),
})
export type LessonCreditSummary = z.infer<typeof lessonCreditSummary>
export const pendingLessonIds = z.object({ ids: z.array(z.uuid()), total: z.number() })
export type PendingLessons = { items: CalendarLesson[]; total: number }

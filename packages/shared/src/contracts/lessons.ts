import { z } from 'zod'
import { Constants } from '../database.types'

/**
 * Taken from the generated database enums rather than typed out again, so adding a status
 * in a migration cannot leave the API validating against a stale list.
 */
export const LESSON_STATUSES = Constants.public.Enums.lesson_status
export type LessonStatus = (typeof LESSON_STATUSES)[number]

export const ATTENDANCE_STATUSES = Constants.public.Enums.attendance_status
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

export type LessonTeacher = {
  id: string
  fullName: string | null
  email: string
}

/** One session, as it appears in the history of one of the people who were in it. */
export type StudentLesson = {
  id: string
  scheduledAt: string
  durationMinutes: number
  /** Whether the session happened at all. */
  status: LessonStatus
  topic: string | null
  /** Whether this particular student was in it, which a cancelled lesson leaves open. */
  attendance: AttendanceStatus
  /** Null only if the teacher's profile went missing, which the foreign key prevents. */
  teacher: LessonTeacher | null
  /** How many were in the room, so a group lesson is recognisable as one. */
  attendeeCount: number
}

/**
 * Counted over the student's whole history rather than over the page of it being shown,
 * so the numbers at the top of the panel do not quietly describe a subset of the list
 * underneath them.
 */
export type LessonTally = {
  /** Sessions that took place, whether or not this student turned up to them. */
  held: number
  attended: number
  missed: number
  excused: number
  canceled: number
  /** Still marked as not yet taught. */
  upcoming: number
}

export type StudentLessons = {
  tally: LessonTally
  /** Most recent first, capped; `tally` is what describes the whole of it. */
  items: StudentLesson[]
}

/**
 * Half-open: a lesson at exactly `to` belongs to the next window, which is what keeps a
 * week boundary from showing the same lesson twice.
 */
const rangeFields = {
  from: z.iso.datetime({ offset: true }),
  to: z.iso.datetime({ offset: true }),
}

const isForwardRange = (query: { from: string; to: string }) =>
  Date.parse(query.from) < Date.parse(query.to)

export const listLessonsQuery = z
  .object({
    ...rangeFields,
    teacherId: z.uuid().optional(),
  })
  .refine(isForwardRange, { message: 'from must come before to' })

export type ListLessonsQuery = z.infer<typeof listLessonsQuery>

/** The caller is taken from the session; this endpoint accepts no person selector. */
export const listMyLessonsQuery = z
  .strictObject(rangeFields)
  .refine(isForwardRange, { message: 'from must come before to' })

export type ListMyLessonsQuery = z.infer<typeof listMyLessonsQuery>

export const scheduleLessonBody = z.strictObject({
  // Retained across retries, so a lost response cannot create a second lesson.
  id: z.uuid(),
  scheduledAt: z.iso.datetime({ offset: true }),
  durationMinutes: z.number().int().min(15).max(240),
  studentIds: z.array(z.uuid()).min(1).max(50),
  topic: z.string().trim().max(200).default(''),
  notes: z.string().trim().max(2000).default(''),
})

export type ScheduleLessonBody = z.infer<typeof scheduleLessonBody>

export const lessonIdParam = z.object({ lessonId: z.uuid() })
export const updateLessonBody = scheduleLessonBody.omit({ id: true }).extend({
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
})
export type UpdateLessonBody = z.infer<typeof updateLessonBody>

export type LessonStudent = {
  id: string
  fullName: string | null
  email: string
  attendance: AttendanceStatus
  deductCredit: boolean
}

/** A lesson as a calendar draws it: when, how long, who is teaching, who is in it. */
export type CalendarLesson = {
  liveSession: { id: string; status: 'active' | 'ended' } | null
  id: string
  updatedAt: string
  attendancePending: boolean
  scheduledAt: string
  durationMinutes: number
  status: LessonStatus
  topic: string | null
  /** The teacher's own note. Admins see it; the student never does. */
  notes: string | null
  teacher: LessonTeacher | null
  students: LessonStudent[]
}

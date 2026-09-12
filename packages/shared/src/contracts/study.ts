import { z } from 'zod'
import { listMyLessonsQuery, type StudentLesson } from './lessons'

/** A student's own attendance; no private notes or classmate identities. */
export type StudyLesson = StudentLesson & { deducted: boolean }

export const studyLessonsQuery = listMyLessonsQuery.refine(
  ({ from, to }) => Date.parse(to) - Date.parse(from) <= 32 * 86_400_000,
  { message: 'Choose a window of at most 32 days' },
)

export const studyTeachers = z.array(
  z.object({
    id: z.uuid(),
    fullName: z.string().nullable(),
    email: z.string(),
    active: z.boolean(),
    granted: z.number(),
    used: z.number(),
    remaining: z.number(),
  }),
)
export type StudyTeacher = z.infer<typeof studyTeachers>[number]

export const studyUpdateKinds = [
  'lesson_reminder',
  'homework_due',
  'lesson_scheduled',
  'lesson_changed',
  'lesson_canceled',
  'lesson_removed',
  'homework_assigned',
  'homework_graded',
  'homework_removed',
] as const
export type StudyUpdate = {
  id: string
  kind: (typeof studyUpdateKinds)[number]
  entityId: string
  title: string | null
  scheduledAt: string | null
  updatedAt: string
  readAt: string | null
  expiresAt?: string
}
export const readStudyUpdatesBody = z.strictObject({
  items: z
    .array(z.strictObject({ id: z.uuid(), updatedAt: z.iso.datetime({ offset: true }) }))
    .min(1)
    .max(30),
})

import { z } from 'zod'
import { createAccountBody } from './accounts'
import type { StudentLessons } from './lessons'
import { paginationQuery } from './pagination'

/**
 * The one axis a student can usefully be filtered on. They have no subscription of their
 * own — what matters about a student account is whether anybody is actually teaching it.
 */
export const STUDENT_LINKS = ['linked', 'unlinked'] as const
export type StudentLink = (typeof STUDENT_LINKS)[number]

export const listStudentsQuery = paginationQuery.extend({
  link: z.enum(STUDENT_LINKS).optional(),
  /** Matched against name and email. */
  query: z.string().trim().min(1).max(120).optional(),
})

export type ListStudentsQuery = z.infer<typeof listStudentsQuery>

export const studentIdParam = z.object({
  studentId: z.uuid(),
})

/**
 * A student, and optionally who they will study with — most are made because a teacher
 * already has them, and asking for that in a second step was a step nobody wanted.
 */
export const createStudentBody = createAccountBody.extend({
  teacherId: z.uuid().optional(),
})

export type CreateStudentBody = z.infer<typeof createStudentBody>

export type LinkedTeacher = {
  id: string
  fullName: string | null
  email: string
  /** When this teacher started working with them. */
  since: string
}

export type PastTeacher = LinkedTeacher & {
  /** When it ended. Null if the link was closed without a date being recorded. */
  until: string | null
}

export type StudentListItem = {
  id: string
  email: string
  fullName: string | null
  createdAt: string
  /**
   * Current teachers only. Usually one, sometimes none — a student who signed up and was
   * never claimed — and occasionally more than one, which the join table allows.
   */
  teachers: LinkedTeacher[]
  /** Sessions they were actually in. The rest of the picture is in the detail panel. */
  lessonsAttended: number
}

export type StudentDetail = StudentListItem & {
  /** Relationships that have ended, most recently ended first. */
  pastTeachers: PastTeacher[]
  lessons: StudentLessons
}

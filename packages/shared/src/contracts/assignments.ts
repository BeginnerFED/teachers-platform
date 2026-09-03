import { z } from 'zod'
import type { Enums } from '../database.types'
import type { MaterialOwner, StepCheckResult, StudentMaterial } from './materials'
import { paginationQuery } from './pagination'
import type { Level } from '../constants'

/**
 * Homework. A teacher hands a lesson from the library to one or more of their students;
 * each student gets their own row, so the answers, the marks and the feedback of one never
 * touch another's. A group lesson is N rows, not one row with N students in it.
 *
 * A lesson reaches a student only this way. There is no URL a student can hold that plays
 * a lesson nobody gave them.
 */

/** Given, handed in, and read by the teacher — in that order, never backwards. */
export const ASSIGNMENT_STATUSES = ['assigned', 'submitted', 'graded'] as const
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number]

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never

/** The same tripwire the material enums have: the Postgres enum and this list must agree. */
export const assignmentStatusesMatchDatabase: Exact<
  AssignmentStatus,
  Enums<'assignment_status'>
> = true

export const assignmentIdParam = z.object({ assignmentId: z.uuid() })

export const listAssignmentsQuery = paginationQuery.extend({
  status: z.enum(ASSIGNMENT_STATUSES).optional(),
  /** A teacher narrowing to one student, or to one lesson. Ignored for a student. */
  studentId: z.uuid().optional(),
  materialId: z.uuid().optional(),
})

export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuery>

export const createAssignmentsBody = z.object({
  materialId: z.uuid(),
  /** Each gets their own assignment. Fifty is a class, not a limit anyone will meet. */
  studentIds: z.array(z.uuid()).min(1).max(50),
  dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
  /** A line from the teacher shown above the lesson: "Do steps 1–3 before Thursday." */
  note: z.string().trim().max(500).optional(),
})

export type CreateAssignmentsBody = z.infer<typeof createAssignmentsBody>

/**
 * A student's answers to one step, saved as they go. `checked` records that the step was
 * marked — the marks themselves are never stored, they are recomputed from the answers by
 * the same pure function every time, so a corrected answer key corrects old marks too.
 */
export const saveProgressBody = z.object({
  stepId: z.uuid(),
  answers: z.record(z.string(), z.unknown()),
  checked: z.boolean().default(false),
})

export type SaveProgressBody = z.infer<typeof saveProgressBody>

export const gradeAssignmentBody = z.object({
  /** Points the teacher awards for what the machine could not mark: the writing. */
  manualScore: z.number().int().min(0).max(1000).nullable().optional(),
  feedback: z.string().trim().max(2000).nullable().optional(),
})

export type GradeAssignmentBody = z.infer<typeof gradeAssignmentBody>

/* ----------------------------------------------------------------- responses --- */

export type AssignmentMaterial = {
  id: string
  title: string
  level: Level
  stepCount: number
  durationMinutes: number | null
}

export type AssignmentListItem = {
  id: string
  status: AssignmentStatus
  material: AssignmentMaterial
  student: MaterialOwner
  teacher: MaterialOwner
  dueAt: string | null
  note: string | null
  /** How many steps have been marked so far, out of the lesson's total. */
  progress: { checked: number; total: number }
  /** Machine-marked points, over the whole lesson. Null until handed in. */
  autoScore: number | null
  autoMax: number | null
  /** Points the machine could not award and a teacher must. */
  manualMax: number
  manualScore: number | null
  feedback: string | null
  submittedAt: string | null
  gradedAt: string | null
  createdAt: string
  updatedAt: string
}

export type StepProgress = {
  answers: Record<string, unknown>
  checked: boolean
}

/**
 * The whole thing, for the student doing it and for the teacher reading it: the lesson as
 * a student sees it, what they answered so far, and the marks for every step that has been
 * checked (every step, once handed in).
 */
export type AssignmentDetail = AssignmentListItem & {
  lesson: StudentMaterial
  steps: Record<string, StepProgress>
  results: Record<string, StepCheckResult>
}

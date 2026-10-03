import { z } from 'zod'
import type {
  AssignmentDetail,
  AssignmentListItem,
  Json,
  MaterialOwner,
  StepCheckResult,
  StepProgress,
  StudentMaterial,
} from '@tp/shared'
import { parseBlocks } from '../materials/materials.mapper'
import type { MaterialStepRow } from '../materials/materials.repository'
import type { Viewer } from '../materials/materials.service'
import { markStep } from '../materials/marking'
import type { AssignmentRow, PersonRow } from './assignments.repository'

/**
 * What a student has done so far, by step. Read defensively: a row written by an older
 * version of the app, or by hand, must degrade to "nothing yet" rather than to a 500.
 */
const progressSchema = z.record(
  z.string(),
  z.object({
    answers: z.record(z.string(), z.unknown()).default({}),
    checked: z.boolean().default(false),
  }),
)

export function parseProgress(json: Json): Record<string, StepProgress> {
  const parsed = progressSchema.safeParse(json)

  return parsed.success ? parsed.data : {}
}

const person = (row: PersonRow | null, id: string): MaterialOwner =>
  row
    ? { id: row.id, fullName: row.full_name, email: row.email }
    : { id, fullName: null, email: '' }

export function toAssignmentListItem(row: AssignmentRow): AssignmentListItem {
  const progress = parseProgress(row.progress)
  const material = row.snapshot?.material ?? row.material
  const total = row.snapshot?.step_count ?? row.material?.material_steps[0]?.count ?? 0

  return {
    id: row.id,
    status: row.status,
    material: {
      id: material?.id ?? row.material_id ?? row.id,
      title: material?.title ?? '',
      level: material?.level ?? 'A1',
      stepCount: total,
      durationMinutes: material?.duration_minutes ?? null,
    },
    student: person(row.student, row.student_id),
    teacher: person(row.teacher, row.teacher_id),
    dueAt: row.due_at,
    note: row.note,
    progress: {
      checked: Object.values(progress).filter((step) => step.checked).length,
      total,
    },
    feedback: row.feedback,
    revisionRequestedAt: row.revision_requested_at,
    revisionNote: row.revision_note,
    submittedAt: row.submitted_at,
    gradedAt: row.graded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Marks are computed against the immutable version given to this student.
 *
 * Only steps the student checked are marked while the work is still open — a step they have
 * not finished is not wrong yet. Once handed in, every step is (`everything`).
 *
 * For the student, the explanations of the questions left unanswered wait longer, until the
 * review is complete (`reveal`): handed-in work can still be returned to be redone, and those
 * questions with it, and an explanation gives the answer away — for "spot the mistake" it is
 * the answer.
 */
export function markProgress(
  steps: MaterialStepRow[],
  progress: Record<string, StepProgress>,
  everything: boolean,
  reveal: boolean,
): Record<string, StepCheckResult> {
  return Object.fromEntries(
    steps
      .filter((step) => everything || progress[step.id]?.checked)
      .map((step) => [
        step.id,
        markStep(parseBlocks(step.blocks), progress[step.id]?.answers ?? {}, reveal),
      ]),
  )
}

/**
 * The homework as the one reading it sees it. Only the student waits for the review to read
 * every explanation: the teacher reviewing handed-in work, or the administrator, cannot redo
 * a question, and what a skipped one asked for is part of what they review.
 */
export function toAssignmentDetail(
  row: AssignmentRow,
  lesson: StudentMaterial,
  steps: MaterialStepRow[],
  viewer: Pick<Viewer, 'role'>,
): AssignmentDetail {
  const progress = parseProgress(row.progress)
  const reveal = row.status === 'graded' || viewer.role !== 'student'

  return {
    ...toAssignmentListItem(row),
    lesson,
    steps: progress,
    results: markProgress(steps, progress, row.status !== 'assigned', reveal),
  }
}

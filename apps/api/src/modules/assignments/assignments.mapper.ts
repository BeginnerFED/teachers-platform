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
  const total = row.material?.material_steps[0]?.count ?? 0

  return {
    id: row.id,
    status: row.status,
    material: {
      id: row.material?.id ?? row.material_id,
      title: row.material?.title ?? '',
      level: row.material?.level ?? 'A1',
      stepCount: total,
      durationMinutes: row.material?.duration_minutes ?? null,
    },
    student: person(row.student, row.student_id),
    teacher: person(row.teacher, row.teacher_id),
    dueAt: row.due_at,
    note: row.note,
    progress: {
      checked: Object.values(progress).filter((step) => step.checked).length,
      total,
    },
    autoScore: row.auto_score,
    autoMax: row.auto_max,
    manualMax: row.manual_max,
    manualScore: row.manual_score,
    feedback: row.feedback,
    submittedAt: row.submitted_at,
    gradedAt: row.graded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Marks from answers, every time. Nothing stored means nothing to go stale: a teacher who
 * fixes a wrong answer key fixes every mark that depended on it.
 *
 * Only steps the student checked are marked while the work is still open — a step they have
 * not finished is not wrong yet. Once handed in, every step is.
 */
export function markProgress(
  steps: MaterialStepRow[],
  progress: Record<string, StepProgress>,
  everything: boolean,
): Record<string, StepCheckResult> {
  return Object.fromEntries(
    steps
      .filter((step) => everything || progress[step.id]?.checked)
      .map((step) => [
        step.id,
        markStep(parseBlocks(step.blocks), progress[step.id]?.answers ?? {}),
      ]),
  )
}

export function toAssignmentDetail(
  row: AssignmentRow,
  lesson: StudentMaterial,
  steps: MaterialStepRow[],
): AssignmentDetail {
  const progress = parseProgress(row.progress)

  return {
    ...toAssignmentListItem(row),
    lesson,
    steps: progress,
    results: markProgress(steps, progress, row.status !== 'assigned'),
  }
}

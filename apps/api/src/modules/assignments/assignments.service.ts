import type {
  AssignmentDetail,
  AssignmentListItem,
  CreateAssignmentsBody,
  GradeAssignmentBody,
  Json,
  ListAssignmentsQuery,
  MaterialOwner,
  PageMeta,
  SaveProgressBody,
  StepCheckResult,
} from '@tp/shared'
import { ConflictError, ForbiddenError, NotFoundError, RuleViolationError } from '../../http/errors'
import { parseBlocks, toStudentMaterial } from '../materials/materials.mapper'
import { materialsRepository, type MaterialsRepository } from '../materials/materials.repository'
import { canRead, type Viewer } from '../materials/materials.service'
import { markStep } from '../materials/marking'
import {
  markProgress,
  parseProgress,
  toAssignmentDetail,
  toAssignmentListItem,
} from './assignments.mapper'
import {
  assignmentsRepository,
  type AssignmentRow,
  type AssignmentsRepository,
} from './assignments.repository'

export type AssignmentsServiceDeps = {
  assignments: AssignmentsRepository
  materials: MaterialsRepository
}

export function createAssignmentsService({ assignments, materials }: AssignmentsServiceDeps) {
  /**
   * Homework is between two people. Anyone else asking is told it does not exist — the
   * same rule the library follows, for the same reason: "forbidden" confirms it is there.
   */
  async function involved(assignmentId: string, viewer: Viewer): Promise<AssignmentRow> {
    const row = await assignments.findById(assignmentId)

    if (!row || (row.teacher_id !== viewer.id && row.student_id !== viewer.id)) {
      throw new NotFoundError('No such assignment')
    }

    return row
  }

  async function asTeacher(assignmentId: string, viewer: Viewer): Promise<AssignmentRow> {
    const row = await involved(assignmentId, viewer)

    if (row.teacher_id !== viewer.id) {
      throw new ForbiddenError('Only the teacher who set this homework can do that')
    }

    return row
  }

  async function asStudent(assignmentId: string, viewer: Viewer): Promise<AssignmentRow> {
    const row = await involved(assignmentId, viewer)

    if (row.student_id !== viewer.id) {
      throw new ForbiddenError('Only the student this homework was set for can do that')
    }

    return row
  }

  async function detail(row: AssignmentRow): Promise<AssignmentDetail> {
    const material = await materials.findById(row.material_id)
    if (!material) throw new NotFoundError('The lesson behind this homework is gone')

    const steps = await materials.stepsFor(row.material_id)

    return toAssignmentDetail(row, toStudentMaterial(material, steps), steps)
  }

  /** Who a teacher may set homework for: their own students; for the admin, anyone. */
  async function reach(viewer: Viewer): Promise<MaterialOwner[]> {
    const rows =
      viewer.role === 'admin'
        ? await assignments.allStudents()
        : await assignments.activeStudentsOf(viewer.id)

    return rows.map((row) => ({ id: row.id, fullName: row.full_name, email: row.email }))
  }

  return {
    recipients: reach,

    /**
     * One row per student. Those who already hold this lesson, unmarked, are left as they
     * are rather than given it twice — reported back so the teacher knows.
     */
    async create(
      body: CreateAssignmentsBody,
      viewer: Viewer,
    ): Promise<{ created: AssignmentListItem[]; skipped: string[] }> {
      const material = await materials.findById(body.materialId)

      if (!material || material.deleted_at || !canRead(material, viewer)) {
        throw new NotFoundError('No such material')
      }

      const allowed = new Set((await reach(viewer)).map((student) => student.id))
      const strangers = body.studentIds.filter((id) => !allowed.has(id))

      if (strangers.length > 0) {
        throw new RuleViolationError('Homework can only be set for your own students')
      }

      const open = new Set(await assignments.openFor(body.materialId, body.studentIds))
      const fresh = [...new Set(body.studentIds)].filter((id) => !open.has(id))

      const rows = await assignments.insertMany(
        fresh.map((studentId) => ({
          material_id: body.materialId,
          teacher_id: viewer.id,
          student_id: studentId,
          due_at: body.dueAt ?? null,
          note: body.note || null,
        })),
      )

      return { created: rows.map(toAssignmentListItem), skipped: [...open] }
    },

    /** A teacher's set homework, or a student's own. Never anybody else's. */
    async list(
      query: ListAssignmentsQuery,
      viewer: Viewer,
    ): Promise<{ items: AssignmentListItem[]; meta: PageMeta }> {
      const who =
        viewer.role === 'student'
          ? { studentId: viewer.id }
          : { teacherId: viewer.id, studentId: query.studentId }

      const { rows, total } = await assignments.list({
        page: query.page,
        perPage: query.perPage,
        status: query.status,
        materialId: query.materialId,
        ...who,
      })

      return {
        items: rows.map(toAssignmentListItem),
        meta: { page: query.page, perPage: query.perPage, total },
      }
    },

    async get(assignmentId: string, viewer: Viewer): Promise<AssignmentDetail> {
      return detail(await involved(assignmentId, viewer))
    },

    /**
     * A student's answers to one step, saved as they go. Marked on the spot when asked —
     * the marks come back but are not stored; the step is only remembered as checked.
     */
    async saveProgress(
      assignmentId: string,
      body: SaveProgressBody,
      viewer: Viewer,
    ): Promise<{ result: StepCheckResult | null }> {
      const row = await asStudent(assignmentId, viewer)

      if (row.status !== 'assigned') {
        throw new ConflictError('This homework has already been handed in')
      }

      const step = await materials.findStep(row.material_id, body.stepId)
      if (!step) throw new NotFoundError('No such step')

      const current = parseProgress(row.progress)
      // Once checked, a step stays checked: the answers are locked on the page, and a
      // save that arrives late from the previous step must not reopen it.
      const checked = body.checked || Boolean(current[body.stepId]?.checked)
      const progress = { ...current, [body.stepId]: { answers: body.answers, checked } }

      await assignments.update(row.id, { progress: progress as Json })

      return {
        result: checked ? markStep(parseBlocks(step.blocks), body.answers) : null,
      }
    },

    /** Hands the work in. Every step is marked from here on, answered or not. */
    async submit(assignmentId: string, viewer: Viewer): Promise<AssignmentDetail> {
      const row = await asStudent(assignmentId, viewer)

      if (row.status !== 'assigned') {
        throw new ConflictError('This homework has already been handed in')
      }

      const steps = await materials.stepsFor(row.material_id)
      const progress = parseProgress(row.progress)
      const results = Object.values(markProgress(steps, progress, true))

      const updated = await assignments.update(row.id, {
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        auto_score: results.reduce((sum, result) => sum + result.autoScore, 0),
        auto_max: results.reduce((sum, result) => sum + result.autoMax, 0),
        manual_max: results.reduce((sum, result) => sum + result.manualMax, 0),
        progress: Object.fromEntries(
          steps.map((step) => [
            step.id,
            { answers: progress[step.id]?.answers ?? {}, checked: true },
          ]),
        ) as Json,
      })

      if (!updated) throw new NotFoundError('No such assignment')

      return detail(updated)
    },

    /**
     * The teacher's word on what the machine could not mark, and a line to the student.
     * Marking is repeatable — a second read can change the points — but it cannot happen
     * before the work is handed in.
     */
    async grade(
      assignmentId: string,
      body: GradeAssignmentBody,
      viewer: Viewer,
    ): Promise<AssignmentDetail> {
      const row = await asTeacher(assignmentId, viewer)

      if (row.status === 'assigned') {
        throw new ConflictError('This homework has not been handed in yet')
      }

      if (body.manualScore != null && body.manualScore > row.manual_max) {
        throw new RuleViolationError(`At most ${row.manual_max} points can be given here`)
      }

      const updated = await assignments.update(row.id, {
        status: 'graded',
        graded_at: new Date().toISOString(),
        ...(body.manualScore !== undefined && { manual_score: body.manualScore }),
        ...(body.feedback !== undefined && { feedback: body.feedback }),
      })

      if (!updated) throw new NotFoundError('No such assignment')

      return detail(updated)
    },

    /** Taking homework back. Only while it is still open — handed-in work is a record. */
    async remove(assignmentId: string, viewer: Viewer): Promise<void> {
      const row = await asTeacher(assignmentId, viewer)

      if (row.status !== 'assigned') {
        throw new ConflictError('Homework that has been handed in cannot be withdrawn')
      }

      await assignments.remove(row.id)
    },
  }
}

export type AssignmentsService = ReturnType<typeof createAssignmentsService>

export const assignmentsService = createAssignmentsService({
  assignments: assignmentsRepository,
  materials: materialsRepository,
})

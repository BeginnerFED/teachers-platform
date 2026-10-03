import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestAssignmentRevisionBody, type Json, type Tables } from '@tp/shared'
import type { AiQuotaService } from '../ai/ai-quota.service'
import type { AiProvider } from '../ai/ai.provider'
import type { MaterialStepRow, MaterialsRepository } from '../materials/materials.repository'
import { assignmentSnapshots } from './assignment-snapshots.repository'
import {
  throwFromAssignmentWrite,
  type AssignmentRow,
  type AssignmentsRepository,
} from './assignments.repository'
import { createAssignmentsService } from './assignments.service'

const material = {
  id: 'material',
  title: 'Interview practice',
  description: null,
  level: 'B1',
  duration_minutes: 20,
} as Tables<'materials'>

const steps = [
  {
    id: 'step-one',
    material_id: 'material',
    position: 0,
    title: 'Introduce yourself',
    blocks: [],
    created_at: '2026-09-19T10:00:00.000Z',
    updated_at: '2026-09-19T10:00:00.000Z',
  },
  {
    id: 'step-two',
    material_id: 'material',
    position: 1,
    title: 'Your experience',
    blocks: [],
    created_at: '2026-09-19T10:00:00.000Z',
    updated_at: '2026-09-19T10:00:00.000Z',
  },
] as MaterialStepRow[]

function row(status: AssignmentRow['status'] = 'submitted'): AssignmentRow {
  return {
    id: 'assignment',
    material_id: 'material',
    teacher_id: 'teacher',
    student_id: 'student',
    due_at: null,
    note: 'Answer every prompt.',
    progress: {
      'step-one': { answers: { writing: 'My first answer' }, checked: true },
    } as Json,
    status,
    auto_score: 2,
    auto_max: 3,
    manual_max: 1,
    manual_score: null,
    feedback: null,
    revision_requested_at: null,
    revision_note: null,
    submitted_at: '2026-09-19T11:00:00.000Z',
    graded_at: null,
    created_at: '2026-09-19T10:00:00.000Z',
    updated_at: '2026-09-19T11:00:00.000Z',
    snapshot: { material, step_count: steps.length },
    material: null,
    student: { id: 'student', full_name: 'Student', email: 'student@example.com' },
    teacher: { id: 'teacher', full_name: 'Teacher', email: 'teacher@example.com' },
  }
}

function service(assignments: AssignmentsRepository) {
  return createAssignmentsService({
    assignments,
    materials: {} as MaterialsRepository,
    ai: {} as AiProvider,
    quota: {} as AiQuotaService,
  })
}

afterEach(() => vi.restoreAllMocks())

describe('homework revision requests', () => {
  it('requires one nonblank note and rejects unknown request fields', () => {
    expect(requestAssignmentRevisionBody.safeParse({ note: '  ' }).success).toBe(false)
    expect(
      requestAssignmentRevisionBody.safeParse({ note: 'Please add an example.', score: 5 }).success,
    ).toBe(false)
  })

  it('reopens submitted work, preserves answers, and hides previous check results', async () => {
    const current = row()
    const assignments = {
      findById: vi.fn().mockResolvedValue(current),
      teaches: vi.fn().mockResolvedValue(true),
      updateSubmitted: vi.fn(async (_id, _updatedAt, patch) => ({
        ...current,
        ...patch,
        updated_at: '2026-09-19T11:05:00.000Z',
      })),
    } as unknown as AssignmentsRepository
    vi.spyOn(assignmentSnapshots, 'get').mockResolvedValue({ material, steps })

    const result = await service(assignments).requestRevision(
      current.id,
      { note: 'Add one concrete example to the second answer.' },
      { id: 'teacher', role: 'teacher' },
    )

    expect(assignments.updateSubmitted).toHaveBeenCalledWith(
      current.id,
      current.updated_at,
      expect.objectContaining({
        status: 'assigned',
        revision_note: 'Add one concrete example to the second answer.',
        feedback: null,
        graded_at: null,
        manual_score: null,
        progress: {
          'step-one': { answers: { writing: 'My first answer' }, checked: false },
          'step-two': { answers: {}, checked: false },
        },
      }),
    )
    // Marks are recomputed from the answers; the whole-number legacy columns are left alone.
    for (const legacy of ['auto_score', 'auto_max', 'manual_max']) {
      expect(vi.mocked(assignments.updateSubmitted).mock.calls[0]?.[2]).not.toHaveProperty(legacy)
    }
    expect(result.status).toBe('assigned')
    expect(result.revisionNote).toBe('Add one concrete example to the second answer.')
    expect(result.steps['step-one']).toEqual({
      answers: { writing: 'My first answer' },
      checked: false,
    })
    expect(result.results).toEqual({})
  })

  it.each(['assigned', 'graded'] as const)(
    'does not request changes from %s work',
    async (status) => {
      const assignments = {
        findById: vi.fn().mockResolvedValue(row(status)),
        updateSubmitted: vi.fn(),
      } as unknown as AssignmentsRepository

      await expect(
        service(assignments).requestRevision(
          'assignment',
          { note: 'Please revise this.' },
          { id: 'teacher', role: 'teacher' },
        ),
      ).rejects.toMatchObject({ code: 'conflict' })
      expect(assignments.updateSubmitted).not.toHaveBeenCalled()
    },
  )

  it('does not overwrite a submission that changed during review', async () => {
    const assignments = {
      findById: vi.fn().mockResolvedValue(row()),
      teaches: vi.fn().mockResolvedValue(true),
      updateSubmitted: vi.fn().mockResolvedValue(null),
    } as unknown as AssignmentsRepository
    vi.spyOn(assignmentSnapshots, 'get').mockResolvedValue({ material, steps })

    await expect(
      service(assignments).requestRevision(
        'assignment',
        { note: 'Please revise this.' },
        { id: 'teacher', role: 'teacher' },
      ),
    ).rejects.toMatchObject({ code: 'conflict' })
  })

  it('does not reopen work for a teacher the student no longer studies with', async () => {
    // Ending the link withdrew the open homework; returning this would open it again.
    const assignments = {
      findById: vi.fn().mockResolvedValue(row()),
      teaches: vi.fn().mockResolvedValue(false),
      updateSubmitted: vi.fn(),
    } as unknown as AssignmentsRepository

    await expect(
      service(assignments).requestRevision(
        'assignment',
        { note: 'Please revise this.' },
        { id: 'teacher', role: 'teacher' },
      ),
    ).rejects.toMatchObject({
      code: 'rule_violation',
      status: 422,
      details: { reason: 'not_your_student' },
    })
    expect(assignments.teaches).toHaveBeenCalledWith('teacher', 'student')
    expect(assignments.updateSubmitted).not.toHaveBeenCalled()
  })

  it('lets the administrator return work they set, whoever the student studies with', async () => {
    const current = { ...row(), teacher_id: 'admin' }
    const assignments = {
      findById: vi.fn().mockResolvedValue(current),
      teaches: vi.fn().mockResolvedValue(false),
      updateSubmitted: vi.fn(async (_id, _updatedAt, patch) => ({ ...current, ...patch })),
    } as unknown as AssignmentsRepository
    vi.spyOn(assignmentSnapshots, 'get').mockResolvedValue({ material, steps })

    const result = await service(assignments).requestRevision(
      current.id,
      { note: 'Please revise this.' },
      { id: 'admin', role: 'admin' },
    )

    expect(result.status).toBe('assigned')
    expect(assignments.teaches).not.toHaveBeenCalled()
  })

  it('answers the database refusing the same thing with the same reason', async () => {
    // A link ended between the check and the write: the database guard has the last word.
    const assignments = {
      findById: vi.fn().mockResolvedValue(row()),
      teaches: vi.fn().mockResolvedValue(true),
      updateSubmitted: vi.fn(() =>
        throwFromAssignmentWrite(
          { code: 'TP409', message: 'student_not_linked', details: '', hint: '' } as Parameters<
            typeof throwFromAssignmentWrite
          >[0],
          'update submitted assignment',
        ),
      ),
    } as unknown as AssignmentsRepository
    vi.spyOn(assignmentSnapshots, 'get').mockResolvedValue({ material, steps })

    await expect(
      service(assignments).requestRevision(
        'assignment',
        { note: 'Please revise this.' },
        { id: 'teacher', role: 'teacher' },
      ),
    ).rejects.toMatchObject({ code: 'rule_violation', details: { reason: 'not_your_student' } })
  })
})

describe('withdrawing homework', () => {
  it('does not delete work submitted after the teacher loaded it', async () => {
    const current = row('assigned')
    const assignments = {
      findById: vi.fn().mockResolvedValue(current),
      removeOpen: vi.fn().mockResolvedValue(false),
    } as unknown as AssignmentsRepository

    await expect(
      service(assignments).remove(current.id, { id: 'teacher', role: 'teacher' }),
    ).rejects.toMatchObject({ code: 'conflict' })
    expect(assignments.removeOpen).toHaveBeenCalledWith(
      current.id,
      current.teacher_id,
      current.updated_at,
    )
  })
})

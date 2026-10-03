import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  answerFingerprint,
  saveProgressBody,
  type Json,
  type SaveProgressBody,
  type Tables,
} from '@tp/shared'
import type { AiQuotaService } from '../ai/ai-quota.service'
import type { AiProvider } from '../ai/ai.provider'
import type {
  MaterialRow,
  MaterialStepRow,
  MaterialsRepository,
} from '../materials/materials.repository'
import { assignmentSnapshots } from './assignment-snapshots.repository'
import type { AssignmentRow, AssignmentsRepository } from './assignments.repository'
import { createAssignmentsService } from './assignments.service'

const material = {
  id: 'material',
  title: 'Past simple',
  description: null,
  level: 'A2',
  duration_minutes: 10,
} as Tables<'materials'>

const step = {
  id: 'step',
  material_id: 'material',
  position: 0,
  title: 'Yesterday',
  blocks: [
    {
      id: 'gap',
      type: 'gap_fill',
      segments: [
        { kind: 'text', text: 'Yesterday I ' },
        { kind: 'gap', id: 'g1', answers: ['went'] },
      ],
    },
    { id: 'essay', type: 'free_writing', prompt: 'Describe your weekend.' },
  ],
  created_at: '2026-09-30T10:00:00.000Z',
  updated_at: '2026-09-30T10:00:00.000Z',
} as MaterialStepRow

function row(progress: Json, status: AssignmentRow['status'] = 'assigned'): AssignmentRow {
  return {
    id: 'assignment',
    material_id: 'material',
    teacher_id: 'teacher',
    student_id: 'student',
    due_at: null,
    note: null,
    progress,
    status,
    auto_score: null,
    auto_max: null,
    manual_max: 0,
    manual_score: null,
    feedback: null,
    revision_requested_at: null,
    revision_note: null,
    submitted_at: null,
    graded_at: null,
    created_at: '2026-09-30T10:00:00.000Z',
    updated_at: '2026-09-30T11:00:00.000Z',
    snapshot: { material, step_count: 1 },
    material: null,
    student: { id: 'student', full_name: 'Student', email: 'student@example.com' },
    teacher: { id: 'teacher', full_name: 'Teacher', email: 'teacher@example.com' },
  }
}

function setup(current: AssignmentRow, steps: MaterialStepRow[] = [step]) {
  const assignments = {
    findById: vi.fn().mockResolvedValue(current),
    updateOpen: vi.fn(async (_id: string, _updatedAt: string, patch: Partial<AssignmentRow>) => ({
      ...current,
      ...patch,
      updated_at: '2026-09-30T11:05:00.000Z',
    })),
  } as unknown as AssignmentsRepository
  vi.spyOn(assignmentSnapshots, 'get').mockResolvedValue({ material, steps })
  const service = createAssignmentsService({
    assignments,
    materials: {} as MaterialsRepository,
    ai: {} as AiProvider,
    quota: {} as AiQuotaService,
  })

  return { service, assignments }
}

const student = { id: 'student', role: 'student' } as const

/** The progress the service last wrote, as the database would hold it. */
function written(assignments: AssignmentsRepository) {
  return vi.mocked(assignments.updateOpen).mock.calls.at(-1)?.[2]
}

afterEach(() => vi.restoreAllMocks())

describe('saving homework progress from two tabs or devices', () => {
  it('keeps the blocks another tab saved instead of replacing the whole step', async () => {
    // The laptop filled the gap; the phone, opened before that, sends only the essay.
    const { service, assignments } = setup(
      row({ step: { answers: { gap: { g1: 'went' } }, checked: false } }),
    )

    const saved = await service.saveProgress(
      'assignment',
      { stepId: 'step', answers: { essay: 'My weekend was quiet.' }, checked: false },
      student,
    )

    const both = { gap: { g1: 'went' }, essay: 'My weekend was quiet.' }
    expect(written(assignments)).toEqual({ progress: { step: { answers: both, checked: false } } })
    expect(saved).toEqual({
      result: null,
      answers: both,
      updatedAt: '2026-09-30T11:05:00.000Z',
      kept: [],
    })
  })

  it('takes only the blocks a browser says it changed from its copy of the step', async () => {
    // The laptop still shows the essay as it was before the phone finished it.
    const { service, assignments } = setup(
      row({
        step: {
          answers: { gap: { g1: 'went' }, essay: 'Finished on the phone.' },
          checked: false,
        },
      }),
    )
    const body: SaveProgressBody = {
      stepId: 'step',
      answers: { gap: { g1: 'goes' }, essay: 'Started on the laptop' },
      checked: false,
      changed: ['gap'],
    }

    await service.saveProgress('assignment', body, student)

    expect(written(assignments)).toEqual({
      progress: {
        step: { answers: { gap: { g1: 'goes' }, essay: 'Finished on the phone.' }, checked: false },
      },
    })
  })

  it('still clears an answer, which arrives as an empty value', async () => {
    const { service, assignments } = setup(
      row({ step: { answers: { gap: { g1: 'went' }, essay: 'Draft' }, checked: false } }),
    )

    await service.saveProgress(
      'assignment',
      { stepId: 'step', answers: { gap: {} }, checked: false },
      student,
    )

    expect(written(assignments)).toEqual({
      progress: { step: { answers: { gap: {}, essay: 'Draft' }, checked: false } },
    })
  })

  it('marks the step as it was saved, not only the blocks this browser sent', async () => {
    const { service } = setup(row({ step: { answers: { gap: { g1: 'went' } }, checked: false } }))

    const saved = await service.saveProgress(
      'assignment',
      { stepId: 'step', answers: { essay: 'Done.' }, checked: true, changed: ['essay'] },
      student,
    )

    expect(saved.result).toMatchObject({ autoScore: 1, autoMax: 1, manualMax: 1 })
    expect(saved.answers).toEqual({ gap: { g1: 'went' }, essay: 'Done.' })
  })

  it('stores only the blocks of the step, whatever else a save or an older row holds', async () => {
    // Merged save after save, a key that is not a block would never be dropped again.
    const { service, assignments } = setup(
      row({
        step: { answers: { gap: { g1: 'went' }, 'left-over': 'x'.repeat(1000) }, checked: false },
      }),
    )

    const saved = await service.saveProgress(
      'assignment',
      {
        stepId: 'step',
        answers: { essay: 'Quiet.', 'not-a-block': 'y'.repeat(80_000) },
        checked: false,
        changed: ['essay', 'not-a-block'],
      },
      student,
    )

    const kept = { gap: { g1: 'went' }, essay: 'Quiet.' }
    expect(written(assignments)).toEqual({ progress: { step: { answers: kept, checked: false } } })
    expect(saved.answers).toEqual(kept)
  })

  it('answers a late save for a checked step with the locked answers and leaves them be', async () => {
    const locked = { gap: { g1: 'went' } }
    const { service, assignments } = setup(row({ step: { answers: locked, checked: true } }))

    const saved = await service.saveProgress(
      'assignment',
      { stepId: 'step', answers: { gap: { g1: 'goes' } }, checked: false },
      student,
    )

    expect(assignments.updateOpen).not.toHaveBeenCalled()
    expect(saved).toMatchObject({
      answers: locked,
      updatedAt: '2026-09-30T11:00:00.000Z',
      kept: ['gap'],
    })
  })

  it('names what a late save carried into a checked step, which it lets go', async () => {
    // The laptop checked the step; the phone, behind, typed the essay over its older copy.
    const locked = { gap: { g1: 'went' }, essay: 'Checked on the laptop.' }
    const { service, assignments } = setup(row({ step: { answers: locked, checked: true } }))

    const saved = await service.saveProgress(
      'assignment',
      {
        stepId: 'step',
        answers: { gap: { g1: 'goes' }, essay: 'Typed on the phone.' },
        checked: false,
        changed: ['essay'],
        bases: { essay: answerFingerprint(undefined) },
      },
      student,
    )

    expect(assignments.updateOpen).not.toHaveBeenCalled()
    expect(saved).toMatchObject({ answers: locked, kept: ['essay'] })
  })

  it('names nothing for a retry of the check that locked the step', async () => {
    // The check landed and its answer was lost on the way back: the retry carries the same.
    const { service } = setup(
      row({ step: { answers: { gap: { g2: 'b', g1: 'went' } }, checked: true } }),
    )

    const saved = await service.saveProgress(
      'assignment',
      {
        stepId: 'step',
        answers: { gap: { g1: 'went', g2: 'b' } },
        checked: true,
        changed: ['gap'],
        bases: { gap: answerFingerprint(undefined) },
      },
      student,
    )

    expect(saved.kept).toEqual([])
    expect(saved.result).toMatchObject({ autoScore: 1, autoMax: 1 })
  })

  it('names nothing for an emptied block the locked step never held', async () => {
    // Typed in here and cleared again: nothing on either side, so nothing was lost.
    const { service } = setup(row({ step: { answers: { essay: 'Checked.' }, checked: true } }))

    const saved = await service.saveProgress(
      'assignment',
      {
        stepId: 'step',
        answers: { gap: { g1: '' } },
        checked: false,
        changed: ['gap'],
        bases: { gap: answerFingerprint(undefined) },
      },
      student,
    )

    expect(saved.kept).toEqual([])
  })
})

describe('a block changed on two devices', () => {
  it('keeps what another device saved since this one began, and names the block', async () => {
    // The phone began the essay empty and went offline; the laptop has saved one since.
    const { service, assignments } = setup(
      row({ step: { answers: { essay: 'Newer, from the laptop.' }, checked: false } }),
    )

    const saved = await service.saveProgress(
      'assignment',
      {
        stepId: 'step',
        answers: { gap: { g1: 'went' }, essay: 'Older, typed offline on the phone.' },
        checked: false,
        changed: ['gap', 'essay'],
        bases: { gap: answerFingerprint(undefined), essay: answerFingerprint(undefined) },
      },
      student,
    )

    const kept = { gap: { g1: 'went' }, essay: 'Newer, from the laptop.' }
    expect(written(assignments)).toEqual({ progress: { step: { answers: kept, checked: false } } })
    expect(saved).toMatchObject({ answers: kept, kept: ['essay'] })
  })

  it('takes a block that still holds what this device began from, in any key order', async () => {
    const { service, assignments } = setup(
      row({ step: { answers: { gap: { g2: 'b', g1: 'went' } }, checked: false } }),
    )

    const saved = await service.saveProgress(
      'assignment',
      {
        stepId: 'step',
        answers: { gap: { g1: 'goes', g2: 'b' } },
        checked: false,
        changed: ['gap'],
        bases: { gap: answerFingerprint({ g1: 'went', g2: 'b' }) },
      },
      student,
    )

    expect(written(assignments)).toEqual({
      progress: { step: { answers: { gap: { g1: 'goes', g2: 'b' } }, checked: false } },
    })
    expect(saved.kept).toEqual([])
  })

  it('finds no conflict where the block already holds what arrives', async () => {
    // This device's own save landed once already, and its answer was lost on the way back.
    const { service } = setup(row({ step: { answers: { essay: 'Sent twice.' }, checked: false } }))

    const saved = await service.saveProgress(
      'assignment',
      {
        stepId: 'step',
        answers: { essay: 'Sent twice.' },
        checked: false,
        changed: ['essay'],
        bases: { essay: answerFingerprint(undefined) },
      },
      student,
    )

    expect(saved).toMatchObject({ answers: { essay: 'Sent twice.' }, kept: [] })
  })

  it('takes a block it has no base for as before, so an older browser still saves', async () => {
    const { service, assignments } = setup(
      row({ step: { answers: { essay: 'From the laptop.' }, checked: false } }),
    )

    const saved = await service.saveProgress(
      'assignment',
      { stepId: 'step', answers: { essay: 'From an older page.' }, checked: false },
      student,
    )

    expect(written(assignments)).toEqual({
      progress: { step: { answers: { essay: 'From an older page.' }, checked: false } },
    })
    expect(saved.kept).toEqual([])
  })

  it('saves a check that lost a block unchecked, so the student sees what stands first', async () => {
    // The phone checks its own gap; the laptop has saved another since the phone began on it.
    const { service, assignments } = setup(
      row({ step: { answers: { gap: { g1: 'went' } }, checked: false } }),
    )

    const saved = await service.saveProgress(
      'assignment',
      {
        stepId: 'step',
        answers: { gap: { g1: 'goes' }, essay: 'Mine.' },
        checked: true,
        changed: ['gap', 'essay'],
        bases: { gap: answerFingerprint({ g1: 'go' }), essay: answerFingerprint(undefined) },
      },
      student,
    )

    const stands = { gap: { g1: 'went' }, essay: 'Mine.' }
    expect(written(assignments)).toEqual({
      progress: { step: { answers: stands, checked: false } },
    })
    expect(saved).toMatchObject({ result: null, answers: stands, kept: ['gap'] })
  })

  it('checks the step when every block it carried was taken', async () => {
    const { service, assignments } = setup(
      row({ step: { answers: { gap: { g1: 'went' } }, checked: false } }),
    )

    const saved = await service.saveProgress(
      'assignment',
      {
        stepId: 'step',
        answers: { gap: { g1: 'goes' } },
        checked: true,
        changed: ['gap'],
        bases: { gap: answerFingerprint({ g1: 'went' }) },
      },
      student,
    )

    expect(written(assignments)).toEqual({
      progress: { step: { answers: { gap: { g1: 'goes' } }, checked: true } },
    })
    expect(saved).toMatchObject({ kept: [], result: { autoScore: 0, autoMax: 1 } })
  })
})

describe('the blocks a save names as changed', () => {
  const body = (changed: string[]) =>
    saveProgressBody.safeParse({
      stepId: '00000000-0000-4000-8000-000000000001',
      answers: {},
      changed,
    })

  it('are refused past anything a step could name', () => {
    expect(body(Array.from({ length: 201 }, (_, index) => `block-${index}`)).success).toBe(false)
    expect(body(['b'.repeat(81)]).success).toBe(false)
    expect(body(['']).success).toBe(false)
  })

  it('are taken up to that bound', () => {
    expect(
      body(Array.from({ length: 200 }, (_, index) => `${index}`.padEnd(80, 'b'))).success,
    ).toBe(true)
  })
})

describe('the bases a save names', () => {
  const body = (bases: Record<string, string>) =>
    saveProgressBody.safeParse({
      stepId: '00000000-0000-4000-8000-000000000001',
      answers: {},
      bases,
    })
  const many = (count: number) =>
    Object.fromEntries(
      Array.from({ length: count }, (_, index) => [
        `${index}`.padEnd(80, 'b'),
        answerFingerprint(index),
      ]),
    )

  it('are bounded as the blocks named as changed are', () => {
    expect(body(many(200)).success).toBe(true)
    expect(body(many(201)).success).toBe(false)
    expect(body({ ['b'.repeat(81)]: answerFingerprint('x') }).success).toBe(false)
  })

  it('are fingerprints, not answers', () => {
    expect(body({ essay: 'A whole essay sent again in place of its name.' }).success).toBe(false)
    expect(body({ essay: '' }).success).toBe(false)
  })
})

describe('handing homework in', () => {
  it('hands in work whose weighted score is a fraction, and stores no score', async () => {
    // Two points over three gaps: one right is worth 0.67, which a whole-number column refuses.
    const weighted = {
      ...step,
      blocks: [
        {
          id: 'three',
          type: 'gap_fill',
          points: 2,
          segments: [
            { kind: 'gap', id: 'a', answers: ['x'] },
            { kind: 'gap', id: 'b', answers: ['y'] },
            { kind: 'gap', id: 'c', answers: ['z'] },
          ],
        },
      ],
    } as MaterialStepRow
    const { service, assignments } = setup(
      row({ step: { answers: { three: { a: 'x', b: 'no', c: 'no' } }, checked: false } }),
      [weighted],
    )

    const handedIn = await service.submit('assignment', student)

    const patch = written(assignments)
    expect(patch).toMatchObject({ status: 'submitted' })
    for (const legacy of ['auto_score', 'auto_max', 'manual_max', 'manual_score']) {
      expect(patch).not.toHaveProperty(legacy)
    }
    expect(handedIn.status).toBe('submitted')
    expect(handedIn.results.step).toMatchObject({ autoScore: 0.67, autoMax: 2 })
  })
})

describe('giving homework', () => {
  function giving(stepCount: number) {
    const lesson = {
      id: 'material',
      owner_id: 'teacher',
      deleted_at: null,
      visibility: 'private',
      status: 'draft',
      material_steps: [{ count: stepCount }],
    } as MaterialRow
    const assignments = {
      activeStudentsOf: vi
        .fn()
        .mockResolvedValue([{ id: 'student', full_name: 'Student', email: 'student@example.com' }]),
      openFor: vi.fn().mockResolvedValue([]),
      insertMany: vi.fn().mockResolvedValue([]),
    } as unknown as AssignmentsRepository
    const service = createAssignmentsService({
      assignments,
      materials: { findById: vi.fn().mockResolvedValue(lesson) } as unknown as MaterialsRepository,
      ai: {} as AiProvider,
      quota: {} as AiQuotaService,
    })

    return { service, assignments }
  }

  const teacher = { id: 'teacher', role: 'teacher' } as const
  const body = { materialId: 'material', studentIds: ['student'] }

  it('refuses a lesson with no steps, which the student could never hand in', async () => {
    const { service, assignments } = giving(0)

    await expect(service.create(body, teacher)).rejects.toMatchObject({
      code: 'rule_violation',
      status: 422,
      details: { reason: 'empty_lesson' },
    })
    expect(assignments.insertMany).not.toHaveBeenCalled()
  })

  it('gives a lesson that has steps', async () => {
    const { service, assignments } = giving(1)

    await expect(service.create(body, teacher)).resolves.toEqual({ created: [], skipped: [] })
    expect(assignments.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ material_id: 'material', student_id: 'student' }),
    ])
  })
})

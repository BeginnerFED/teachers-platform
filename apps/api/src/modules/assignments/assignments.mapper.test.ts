import { describe, expect, it } from 'vitest'
import type { StepProgress, StudentMaterial } from '@tp/shared'
import type { MaterialStepRow } from '../materials/materials.repository'
import type { Viewer } from '../materials/materials.service'
import { markProgress, toAssignmentDetail, toAssignmentListItem } from './assignments.mapper'
import type { AssignmentRow } from './assignments.repository'

const student: Viewer = { id: 'student', role: 'student' }
const teacher: Viewer = { id: 'teacher', role: 'teacher' }

/** The marks of one step as the homework reads, in the given state, to the given person. */
function marksOf(
  step: MaterialStepRow,
  progress: Record<string, StepProgress>,
  status: AssignmentRow['status'],
  viewer: Viewer,
) {
  return toAssignmentDetail(
    {
      id: 'assignment',
      status,
      material_id: 'material',
      teacher_id: 'teacher',
      student_id: 'student',
      progress,
      snapshot: null,
      material: null,
      student: null,
      teacher: null,
    } as unknown as AssignmentRow,
    {} as StudentMaterial,
    [step],
    viewer,
  ).results[step.id]
}

describe('assignment response mapping', () => {
  it('does not expose legacy aggregate score columns', () => {
    const row = {
      id: 'assignment',
      status: 'graded',
      material_id: 'material',
      teacher_id: 'teacher',
      student_id: 'student',
      snapshot: {
        material: {
          id: 'material',
          title: 'Writing practice',
          level: 'A2',
          duration_minutes: 20,
        },
        step_count: 1,
      },
      material: null,
      student: { id: 'student', full_name: 'Student', email: 'student@example.com' },
      teacher: { id: 'teacher', full_name: 'Teacher', email: 'teacher@example.com' },
      due_at: null,
      note: null,
      progress: {},
      auto_score: 4,
      auto_max: 5,
      manual_max: 2,
      manual_score: 1,
      feedback: 'A clear answer with one useful next step.',
      revision_requested_at: null,
      revision_note: null,
      submitted_at: '2026-09-19T12:00:00.000Z',
      graded_at: '2026-09-19T12:05:00.000Z',
      created_at: '2026-09-19T11:00:00.000Z',
      updated_at: '2026-09-19T12:05:00.000Z',
    } as unknown as AssignmentRow

    const response = toAssignmentListItem(row)

    expect(response).not.toHaveProperty('autoScore')
    expect(response).not.toHaveProperty('autoMax')
    expect(response).not.toHaveProperty('manualMax')
    expect(response).not.toHaveProperty('manualScore')
    expect(response.feedback).toBe('A clear answer with one useful next step.')
    expect(response.revisionRequestedAt).toBeNull()
    expect(response.revisionNote).toBeNull()
  })
})

describe('marking homework', () => {
  const step = {
    id: 'step',
    material_id: 'material',
    position: 0,
    title: null,
    blocks: [
      {
        id: 'choice',
        type: 'multiple_choice',
        prompt: 'Choose the greeting.',
        options: [
          { id: 'hello', text: 'Hello' },
          { id: 'goodbye', text: 'Goodbye' },
        ],
        correctIds: ['hello'],
        explanation: 'Hello is a greeting.',
      },
      {
        id: 'mistake',
        type: 'spot_mistake',
        items: [{ id: 'i1', words: ['She', 'go', 'home'], wrongIndex: 1, correction: 'goes' }],
      },
    ],
    created_at: '2026-09-30T10:00:00.000Z',
    updated_at: '2026-09-30T10:00:00.000Z',
  } as MaterialStepRow
  // Checked with the choice made and the mistake left alone.
  const progress = { step: { answers: { choice: ['goodbye'] }, checked: true } }
  const marks = (status: AssignmentRow['status'], viewer: Viewer = student) =>
    marksOf(step, progress, status, viewer)

  it('keeps back the explanation of a question skipped while the work is open', () => {
    const marked = marks('assigned')

    expect(marked?.byBlock.choice).toMatchObject({ explanation: 'Hello is a greeting.' })
    expect(marked?.byBlock.mistake).not.toHaveProperty('explanation')
  })

  it('still keeps it back once handed in, while the work can be returned to be redone', () => {
    const marked = marks('submitted')

    expect(marked?.byBlock.choice).toMatchObject({ explanation: 'Hello is a greeting.' })
    expect(marked?.byBlock.mistake).toMatchObject({ score: 0 })
    expect(marked?.byBlock.mistake).not.toHaveProperty('explanation')
  })

  it('explains every question once the review is complete, the skipped ones too', () => {
    const marked = marks('graded')

    expect(marked?.byBlock.choice).toMatchObject({ explanation: 'Hello is a greeting.' })
    expect(marked?.byBlock.mistake).toMatchObject({ score: 0, explanation: 'go → goes' })
  })

  it.each(['teacher', 'admin'] as const)(
    'explains a skipped question to the %s reviewing handed-in work',
    (role) => {
      const marked = marks('submitted', { id: role, role })

      expect(marked?.byBlock.choice).toMatchObject({ explanation: 'Hello is a greeting.' })
      expect(marked?.byBlock.mistake).toMatchObject({ score: 0, explanation: 'go → goes' })
    },
  )

  it('marks only the checked steps while the work is open, and every step once handed in', () => {
    const unchecked = { ...step, id: 'later' }

    expect(Object.keys(markProgress([step, unchecked], progress, false, false))).toEqual(['step'])
    expect(Object.keys(markProgress([step, unchecked], progress, true, false))).toEqual([
      'step',
      'later',
    ])
  })
})

describe('marking a "spot the mistake" with one sentence of two tapped', () => {
  const step = {
    id: 'step',
    material_id: 'material',
    position: 0,
    title: null,
    blocks: [
      {
        id: 'mistake',
        type: 'spot_mistake',
        items: [
          { id: 'i1', words: ['She', 'go', 'home'], wrongIndex: 1, correction: 'goes' },
          { id: 'i2', words: ['They', 'is', 'late'], wrongIndex: 1, correction: 'are' },
        ],
      },
    ],
    created_at: '2026-09-30T10:00:00.000Z',
    updated_at: '2026-09-30T10:00:00.000Z',
  } as MaterialStepRow
  const progress = { step: { answers: { mistake: { i1: 1 } }, checked: true } }

  it('corrects only the tapped sentence for the student before the review is complete', () => {
    for (const status of ['assigned', 'submitted'] as const) {
      expect(marksOf(step, progress, status, student)?.byBlock.mistake).toMatchObject({
        parts: { i1: true, i2: false },
        explanation: 'go → goes',
      })
    }
  })

  it('corrects every sentence once the review is complete, or for the teacher', () => {
    const every = { explanation: 'go → goes · is → are' }

    expect(marksOf(step, progress, 'graded', student)?.byBlock.mistake).toMatchObject(every)
    expect(marksOf(step, progress, 'submitted', teacher)?.byBlock.mistake).toMatchObject(every)
  })
})

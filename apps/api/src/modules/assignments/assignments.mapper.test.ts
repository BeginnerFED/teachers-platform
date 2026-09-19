import { describe, expect, it } from 'vitest'
import { toAssignmentListItem } from './assignments.mapper'
import type { AssignmentRow } from './assignments.repository'

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

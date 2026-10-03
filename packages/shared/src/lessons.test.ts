import { describe, expect, it } from 'vitest'
import { changedLessonFields, updateLessonBody, type CalendarLesson } from './contracts/lessons'

const opened: CalendarLesson = {
  series: { id: '7f0c2c3e-3c55-4a43-8d4b-1d7b0f5f0a01', updatedAt: '2026-10-01T09:00:00.000Z' },
  liveSession: null,
  id: '5a7d1d58-8f11-4a4c-9a4f-3b2f9d6c2e10',
  updatedAt: '2026-10-01T09:00:00.000Z',
  attendancePending: false,
  scheduledAt: '2026-10-07T09:00:00.000Z',
  durationMinutes: 60,
  status: 'scheduled',
  topic: 'Series A',
  notes: null,
  teacher: null,
  students: [
    {
      id: 'c6b1f3a4-9a0e-4d0f-8a7e-2f1b3c4d5e62',
      fullName: 'Second',
      email: 'second@example.com',
      attendance: 'expected',
      deductCredit: false,
    },
    {
      id: '0b1f3a4c-9a0e-4d0f-8a7e-2f1b3c4d5e61',
      fullName: 'First',
      email: 'first@example.com',
      attendance: 'expected',
      deductCredit: false,
    },
  ],
}

/** The form as it opens on that lesson, before the teacher touches anything. */
const untouched = {
  scheduledAt: opened.scheduledAt,
  durationMinutes: 60,
  studentIds: opened.students.map((student) => student.id).sort(),
  topic: 'Series A',
  notes: '',
}

const seriesEdit = {
  scope: 'following' as const,
  expectedUpdatedAt: '2026-10-01T09:00:00.000Z',
  requestId: '9d3b8a52-1c4e-4f6a-9b7d-2e5f8c1a3b40',
}

describe('changedLessonFields', () => {
  it('sends only the time when nothing else was touched', () => {
    expect(
      changedLessonFields(opened, { ...untouched, scheduledAt: '2026-10-07T10:00:00.000Z' }),
    ).toEqual({ scheduledAt: '2026-10-07T10:00:00.000Z' })
  })

  it('sends a field the teacher changed, and clearing one counts as a change', () => {
    expect(
      changedLessonFields(opened, { ...untouched, topic: '', notes: 'Bring the test' }),
    ).toEqual({ scheduledAt: opened.scheduledAt, topic: '', notes: 'Bring the test' })
    expect(changedLessonFields(opened, { ...untouched, durationMinutes: 90 })).toEqual({
      scheduledAt: opened.scheduledAt,
      durationMinutes: 90,
    })
  })

  it('compares students as a set, whatever order the form lists them in', () => {
    expect(
      changedLessonFields(opened, {
        ...untouched,
        studentIds: [...untouched.studentIds].reverse(),
      }),
    ).toEqual({ scheduledAt: opened.scheduledAt })

    const added = [...untouched.studentIds, 'e0a1b2c3-d4e5-4f60-8172-839405a6b7c8']
    expect(changedLessonFields(opened, { ...untouched, studentIds: added })).toEqual({
      scheduledAt: opened.scheduledAt,
      studentIds: [...added].sort(),
    })
  })
})

describe('updateLessonBody', () => {
  const base = { scheduledAt: opened.scheduledAt, expectedUpdatedAt: opened.updatedAt }

  it('lets a series edit leave out what it does not change', () => {
    const parsed = updateLessonBody.parse({ ...base, seriesEdit })

    expect(parsed).toEqual({ ...base, seriesEdit })
    expect(parsed.topic).toBeUndefined()
    expect(parsed.studentIds).toBeUndefined()
  })

  it('still needs the duration and students for a single lesson', () => {
    expect(updateLessonBody.safeParse(base).success).toBe(false)
    expect(
      updateLessonBody.safeParse({ ...base, durationMinutes: 60, studentIds: untouched.studentIds })
        .success,
    ).toBe(true)
  })

  it('accepts the whole lesson from a client that sends every field', () => {
    expect(updateLessonBody.safeParse({ ...base, ...untouched, seriesEdit }).success).toBe(true)
  })
})

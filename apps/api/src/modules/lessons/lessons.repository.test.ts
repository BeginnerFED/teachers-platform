import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConflictError } from '../../http/errors'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../lib/supabase/admin', () => ({ supabaseAdmin: { rpc } }))

const { lessonsRepository } = await import('./lessons.repository')

const edit = {
  scheduledAt: '2026-10-07T10:00:00.000Z',
  expectedUpdatedAt: '2026-10-01T09:00:00.000Z',
}
const seriesEdit = {
  scope: 'following' as const,
  expectedUpdatedAt: '2026-10-01T09:00:00.000Z',
  requestId: '9d3b8a52-1c4e-4f6a-9b7d-2e5f8c1a3b40',
}

afterEach(() => rpc.mockReset())

describe('editing a lesson', () => {
  it('asks the series edit to keep whatever the teacher left out', async () => {
    rpc.mockResolvedValue({ data: 'lesson', error: null })

    await lessonsRepository.update('teacher', 'lesson', { ...edit, topic: 'New', seriesEdit })

    expect(rpc).toHaveBeenCalledWith('update_lesson_series', {
      p_id: 'lesson',
      p_teacher: 'teacher',
      p_expected_updated_at: edit.expectedUpdatedAt,
      p_scheduled_at: edit.scheduledAt,
      p_duration_minutes: null,
      p_students: null,
      p_topic: 'New',
      p_notes: null,
      p_scope: 'following',
      p_series_version: seriesEdit.expectedUpdatedAt,
      p_command: seriesEdit.requestId,
    })
  })

  it('passes an emptied topic on as a change, not as something to keep', async () => {
    rpc.mockResolvedValue({ data: 'lesson', error: null })

    await lessonsRepository.update('teacher', 'lesson', { ...edit, topic: '', seriesEdit })

    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_topic: '', p_notes: null })
  })

  it('still sends a single lesson whole, with a missing note as an empty one', async () => {
    rpc.mockResolvedValue({ data: 'lesson', error: null })

    await lessonsRepository.update('teacher', 'lesson', {
      ...edit,
      durationMinutes: 45,
      studentIds: ['student'],
    })

    expect(rpc).toHaveBeenCalledWith('update_scheduled_lesson', {
      p_id: 'lesson',
      p_teacher: 'teacher',
      p_expected_updated_at: edit.expectedUpdatedAt,
      p_scheduled_at: edit.scheduledAt,
      p_duration_minutes: 45,
      p_students: ['student'],
      p_topic: '',
      p_notes: '',
    })
  })

  it('reports a series changed since it was opened as a lesson conflict', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'Series changed' } })

    const failure = lessonsRepository.update('teacher', 'lesson', { ...edit, seriesEdit })

    await expect(failure).rejects.toBeInstanceOf(ConflictError)
    await expect(failure).rejects.toMatchObject({ details: { reason: 'lesson_changed' } })
  })
})

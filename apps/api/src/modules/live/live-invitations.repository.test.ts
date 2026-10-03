import { describe, expect, it, vi } from 'vitest'
import { ConflictError } from '../../http/errors'
import { liveInvitationsRepository } from './live-invitations.repository'

// The database is replaced by what start_live_lesson answers; the mapping is the subject.
const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../lib/supabase/admin', () => ({ supabaseAdmin: { rpc } }))

const start = () =>
  liveInvitationsRepository.start({
    teacherId: 'teacher',
    materialId: 'material',
    expectedId: null,
    checkExpected: true,
  })

const failing = (code: string) =>
  rpc.mockResolvedValueOnce({ data: null, error: { code, message: code, details: '', hint: '' } })

describe('starting a live lesson', () => {
  // TP409 is how start_live_lesson reports a stale room or calendar lesson; 40001 is how
  // it reported one before. Both must reach the browser as the conflict it explains.
  it.each(['TP409', '40001'])('answers %s as the active lesson having changed', async (code) => {
    failing(code)

    const failure = await start().catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ConflictError)
    expect(failure).toMatchObject({ status: 409, message: 'The active lesson changed' })
  })

  it('keeps an overlapping lesson a conflict of its own', async () => {
    failing('23P01')

    await expect(start()).rejects.toMatchObject({
      status: 409,
      details: { reason: 'lesson_time_conflict' },
    })
  })
})

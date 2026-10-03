import { describe, expect, it } from 'vitest'
import { lessonCreditSummary } from './contracts/attendance'

const lesson = {
  id: '5a7d1d58-8f11-4a4c-9a4f-3b2f9d6c2e10',
  scheduledAt: '2026-09-29T07:00:00+00:00',
  topic: null,
  status: 'scheduled',
  attendance: 'expected',
  deducted: false,
  pending: true,
}

const booked = { ...lesson, id: '0b1f3a4c-9a0e-4d0f-8a7e-2f1b3c4d5e61', pending: false }

const summary = {
  granted: 1,
  used: 1,
  remaining: 0,
  canGrant: true,
  history: [booked, lesson],
  begun: [lesson],
  upcoming: [booked],
  counts: { attended: 1, missed: 0, excused: 0, canceled: 1, planned: 32, pending: 1 },
  grants: [],
}

describe('lessonCreditSummary', () => {
  it('keeps the begun lessons, the booked ones and the full-history counts apart', () => {
    const parsed = lessonCreditSummary.parse(summary)

    expect(parsed.begun).toEqual([lesson])
    expect(parsed.upcoming).toEqual([booked])
    expect(parsed.history).toHaveLength(2)
    expect(parsed.counts).toEqual(summary.counts)
  })

  it('still reads what an API from before the split sends: the history alone', () => {
    const { begun: _begun, upcoming: _upcoming, counts: _counts, ...older } = summary
    const parsed = lessonCreditSummary.parse({
      ...older,
      history: older.history.map(({ pending: _pending, ...item }) => item),
    })

    expect(parsed.begun).toBeUndefined()
    expect(parsed.upcoming).toBeUndefined()
    expect(parsed.counts).toBeUndefined()
    expect(parsed.history[1]?.pending).toBeUndefined()
  })

  it('refuses counts with a total missing, rather than showing it as zero', () => {
    const { pending: _pending, ...partial } = summary.counts

    expect(lessonCreditSummary.safeParse({ ...summary, counts: partial }).success).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { aiLimitDetailsSchema, aiUsageStatusSchema } from './contracts/ai'

const counters = {
  kind: 'lesson_draft' as const,
  resetAt: '2026-09-17T00:00:00.000Z',
  retryAfterSeconds: 3_600,
  requestedUnits: 400,
  userCalls: 5,
  userCallLimit: 5,
  platformUnits: 1_482,
  platformUnitLimit: 9_000,
}

describe('AI usage contracts', () => {
  it('accepts each distinct kind of AI limit response', () => {
    expect(
      aiLimitDetailsSchema.safeParse({
        ...counters,
        scope: 'user',
        reason: 'user_daily_call_limit',
      }).success,
    ).toBe(true)
    expect(
      aiLimitDetailsSchema.safeParse({
        ...counters,
        scope: 'platform',
        reason: 'platform_daily_unit_limit',
      }).success,
    ).toBe(true)
    expect(
      aiLimitDetailsSchema.safeParse({
        scope: 'request',
        reason: 'rate_limit',
        retryAfterSeconds: 15,
      }).success,
    ).toBe(true)
    expect(
      aiLimitDetailsSchema.safeParse({
        scope: 'provider',
        reason: 'provider_rate_limit',
      }).success,
    ).toBe(true)
  })

  it('rejects a mismatched quota scope and reason', () => {
    expect(
      aiLimitDetailsSchema.safeParse({
        ...counters,
        scope: 'user',
        reason: 'platform_daily_unit_limit',
      }).success,
    ).toBe(false)
  })

  it('validates the complete usage status envelope', () => {
    const status = {
      usageDate: '2026-09-16',
      resetAt: '2026-09-17T00:00:00.000Z',
      lessonDraft: { used: 2, limit: 5, remaining: 3 },
      homeworkFeedback: { used: 7, limit: 30, remaining: 23 },
      platform: { usedUnits: 1_482, limitUnits: 9_000, remainingUnits: 7_518 },
    }

    expect(aiUsageStatusSchema.safeParse(status).success).toBe(true)
    expect(aiUsageStatusSchema.safeParse({ ...status, usageDate: '16.09.2026' }).success).toBe(
      false,
    )
  })
})

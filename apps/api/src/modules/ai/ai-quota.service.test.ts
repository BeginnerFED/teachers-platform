import { describe, expect, it, vi } from 'vitest'
import { aiQuotaExceededDetailsSchema } from '@tp/shared'
import { AppError } from '../../http/errors'
import type { AiQuotaDecision, AiQuotaRepository, AiQuotaUsage } from './ai-quota.repository'
import { createAiQuotaService } from './ai-quota.service'

const granted: AiQuotaDecision = {
  reservationId: 'reservation',
  granted: true,
  reason: null,
  usageDate: '2026-09-16',
  resetAt: '2026-09-17T00:00:00.000Z',
  requestedUnits: 300,
  userCalls: 1,
  userCallLimit: 5,
  platformUnits: 300,
  platformUnitLimit: 9_000,
}

const usage: AiQuotaUsage = {
  usageDate: '2026-09-16',
  resetAt: '2026-09-17T00:00:00.000Z',
  lessonDraftCalls: 2,
  lessonDraftCallLimit: 5,
  homeworkFeedbackCalls: 7,
  homeworkFeedbackCallLimit: 30,
  platformUnits: 1_250,
  platformUnitLimit: 9_000,
}

function repository(decision: AiQuotaDecision = granted): AiQuotaRepository {
  return {
    reserve: vi.fn().mockResolvedValue(decision),
    settle: vi.fn().mockResolvedValue(true),
    getStatus: vi.fn().mockResolvedValue(usage),
  }
}

describe('AI daily quota', () => {
  it('returns both per-feature call allowances and the shared platform capacity', async () => {
    const repo = repository()

    await expect(createAiQuotaService(repo).getStatus('profile')).resolves.toEqual({
      usageDate: '2026-09-16',
      resetAt: '2026-09-17T00:00:00.000Z',
      lessonDraft: { used: 2, limit: 5, remaining: 3 },
      homeworkFeedback: { used: 7, limit: 30, remaining: 23 },
      platform: { usedUnits: 1_250, limitUnits: 9_000, remainingUnits: 7_750 },
    })
    expect(repo.getStatus).toHaveBeenCalledWith('profile')
  })

  it('never exposes a negative remaining allowance when concurrent usage exceeds a cap', async () => {
    const repo = repository()
    vi.mocked(repo.getStatus).mockResolvedValue({
      ...usage,
      lessonDraftCalls: 6,
      platformUnits: 9_125,
    })

    await expect(createAiQuotaService(repo).getStatus('profile')).resolves.toMatchObject({
      lessonDraft: { remaining: 0 },
      platform: { remainingUnits: 0 },
    })
  })

  it('settles successful work without refunding it', async () => {
    const repo = repository()

    await expect(
      createAiQuotaService(repo).withReservation('profile', 'lesson_draft', async () => 'draft'),
    ).resolves.toBe('draft')
    expect(repo.settle).toHaveBeenCalledWith('reservation', 'profile', {
      refundCall: false,
      releaseUnits: false,
    })
  })

  it('reconciles provider usage upward to a whole neuron', async () => {
    const repo = repository()

    await createAiQuotaService(repo).withReservation('profile', 'lesson_draft', async (tracker) => {
      tracker.markProviderAttempted()
      tracker.reportUsage(12.25)
      return 'draft'
    })

    expect(repo.settle).toHaveBeenCalledWith('reservation', 'profile', {
      actualUnits: 13,
      refundCall: false,
      releaseUnits: false,
    })
  })

  it('distinguishes an explicit zero-usage report from missing usage', async () => {
    const repo = repository()

    await createAiQuotaService(repo).withReservation('profile', 'lesson_draft', async (tracker) => {
      tracker.reportUsage(0)
      return 'draft'
    })

    expect(repo.settle).toHaveBeenCalledWith('reservation', 'profile', {
      actualUnits: 0,
      refundCall: false,
      releaseUnits: false,
    })
  })

  it('refunds both the call and capacity when work fails before reaching the provider', async () => {
    const repo = repository()
    const failure = new Error('local validation failed')

    await expect(
      createAiQuotaService(repo).withReservation('profile', 'lesson_draft', async () => {
        throw failure
      }),
    ).rejects.toBe(failure)
    expect(repo.settle).toHaveBeenCalledWith('reservation', 'profile', {
      refundCall: true,
      releaseUnits: true,
    })
  })

  it('refunds both the call and capacity after an explicit provider rate limit', async () => {
    const repo = repository()
    const failure = new AppError('too_many_requests', 429, 'provider rate limit', {
      scope: 'provider',
      reason: 'provider_rate_limit',
    })

    await expect(
      createAiQuotaService(repo).withReservation(
        'profile',
        'homework_feedback',
        async (tracker) => {
          tracker.markProviderAttempted()
          throw failure
        },
      ),
    ).rejects.toBe(failure)
    expect(repo.settle).toHaveBeenCalledWith('reservation', 'profile', {
      refundCall: true,
      releaseUnits: true,
    })
  })

  it('refunds the personal call but preserves conservative capacity after a network timeout', async () => {
    const repo = repository()
    const failure = new Error('provider timeout')

    await expect(
      createAiQuotaService(repo).withReservation(
        'profile',
        'homework_feedback',
        async (tracker) => {
          tracker.markProviderAttempted()
          throw failure
        },
      ),
    ).rejects.toBe(failure)
    expect(repo.settle).toHaveBeenCalledWith('reservation', 'profile', {
      refundCall: true,
      releaseUnits: false,
    })
  })

  it('keeps exact provider usage but refunds the call when output validation fails', async () => {
    const repo = repository()
    const failure = new Error('malformed provider output')

    await expect(
      createAiQuotaService(repo).withReservation(
        'profile',
        'homework_feedback',
        async (tracker) => {
          tracker.markProviderAttempted()
          tracker.reportUsage(8.75)
          throw failure
        },
      ),
    ).rejects.toBe(failure)
    expect(repo.settle).toHaveBeenCalledWith('reservation', 'profile', {
      actualUnits: 9,
      refundCall: true,
      releaseUnits: false,
    })
  })

  it('preserves the operation error if settlement bookkeeping fails', async () => {
    const repo = repository()
    vi.mocked(repo.settle).mockRejectedValue(new Error('database unavailable'))
    const failure = new Error('provider timeout')

    await expect(
      createAiQuotaService(repo).withReservation('profile', 'lesson_draft', async (tracker) => {
        tracker.markProviderAttempted()
        throw failure
      }),
    ).rejects.toBe(failure)
  })

  it('rejects work before calling the provider when the user cap is reached', async () => {
    const repo = repository({
      ...granted,
      reservationId: null,
      granted: false,
      reason: 'user_daily_call_limit',
      userCalls: 5,
    })
    const operation = vi.fn()
    const error = await createAiQuotaService(repo)
      .withReservation('profile', 'lesson_draft', operation)
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).details).toMatchObject({
      scope: 'user',
      reason: 'user_daily_call_limit',
      kind: 'lesson_draft',
      userCalls: 5,
      userCallLimit: 5,
    })
    expect(aiQuotaExceededDetailsSchema.safeParse((error as AppError).details).success).toBe(true)
    expect(operation).not.toHaveBeenCalled()
  })

  it('returns structured platform-capacity details without calling the provider', async () => {
    const repo = repository({
      ...granted,
      reservationId: null,
      granted: false,
      reason: 'platform_daily_unit_limit',
      platformUnits: 8_800,
    })
    const operation = vi.fn()
    const error = await createAiQuotaService(repo)
      .withReservation('profile', 'homework_feedback', operation)
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).details).toMatchObject({
      scope: 'platform',
      reason: 'platform_daily_unit_limit',
      kind: 'homework_feedback',
      platformUnits: 8_800,
      platformUnitLimit: 9_000,
    })
    expect(operation).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'a granted decision without a reservation id',
      decision: { ...granted, reservationId: null },
    },
    {
      name: 'a rejected decision without a reason',
      decision: { ...granted, reservationId: null, granted: false, reason: null },
    },
    {
      name: 'a rejected decision that still has a reservation id',
      decision: { ...granted, granted: false, reason: 'user_daily_call_limit' as const },
    },
  ])('treats $name as a broken database contract', async ({ decision }) => {
    const repo = repository(decision)
    const operation = vi.fn()
    const error = await createAiQuotaService(repo)
      .withReservation('profile', 'lesson_draft', operation)
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).code).toBe('internal')
    expect(operation).not.toHaveBeenCalled()
    expect(repo.settle).not.toHaveBeenCalled()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { RuleViolationError } from '../../http/errors'
import type { SubscriptionEventsRepository } from './subscription-events.repository'
import type { SubscriptionRow, SubscriptionsRepository } from './subscriptions.repository'
import { createSubscriptionsService } from './subscriptions.service'

const NOW = new Date('2026-09-15T12:00:00.000Z')

function row(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    profile_id: 'teacher',
    status: 'suspended',
    trial_ends_at: null,
    current_period_end: null,
    access_ends_at: null,
    created_at: '2026-09-01T12:00:00.000Z',
    updated_at: '2026-09-10T12:00:00.000Z',
    ...overrides,
  }
}

/** Applies the patch the way the table would, so the test reads the row that results. */
function service(stored: SubscriptionRow) {
  const subscriptions: SubscriptionsRepository = {
    findByProfileId: vi.fn().mockResolvedValue(stored),
    create: vi.fn(),
    updateIfUnchanged: vi.fn(async ({ patch }) => ({ ...stored, ...patch })),
  }
  const events: SubscriptionEventsRepository = {
    record: vi.fn().mockResolvedValue(undefined),
    listByProfileId: vi.fn(),
  }

  return {
    subscriptions,
    events,
    service: createSubscriptionsService({ subscriptions, events, clock: { now: () => NOW } }),
  }
}

describe('reactivating a suspended subscription', () => {
  it('puts a teacher suspended during the trial back on the same trial', async () => {
    const { service: subscriptions, subscriptions: repository } = service(
      row({ trial_ends_at: '2026-09-18T12:00:00.000Z' }),
    )

    await expect(
      subscriptions.reactivate({ profileId: 'teacher', actorId: 'admin' }),
    ).resolves.toMatchObject({ status: 'trialing', trial_ends_at: '2026-09-18T12:00:00.000Z' })
    // Status only: the trial date is the teacher's, and no paid period is invented.
    expect(repository.updateIfUnchanged).toHaveBeenCalledWith({
      profileId: 'teacher',
      expectedUpdatedAt: '2026-09-10T12:00:00.000Z',
      patch: { status: 'trialing' },
    })
  })

  it('returns a trial that ran out while suspended as an expired trial', async () => {
    const { service: subscriptions, events } = service(
      row({ trial_ends_at: '2026-09-07T12:00:00.000Z' }),
    )

    await expect(
      subscriptions.reactivate({ profileId: 'teacher', actorId: 'admin' }),
    ).resolves.toMatchObject({ status: 'trialing', current_period_end: null })
    expect(events.record).toHaveBeenCalledWith({
      profileId: 'teacher',
      actorId: 'admin',
      type: 'reactivated',
      payload: { status: 'trialing' },
    })
  })

  it('brings a paid period back active', async () => {
    const { service: subscriptions } = service(
      row({
        trial_ends_at: '2026-09-07T12:00:00.000Z',
        current_period_end: '2026-10-01T12:00:00.000Z',
      }),
    )

    await expect(
      subscriptions.reactivate({ profileId: 'teacher', actorId: 'admin' }),
    ).resolves.toMatchObject({ status: 'active' })
  })

  it('refuses a subscription with no date to return to, without writing anything', async () => {
    const { service: subscriptions, subscriptions: repository, events } = service(row())

    await expect(
      subscriptions.reactivate({ profileId: 'teacher', actorId: 'admin' }),
    ).rejects.toBeInstanceOf(RuleViolationError)
    expect(repository.updateIfUnchanged).not.toHaveBeenCalled()
    expect(events.record).not.toHaveBeenCalled()
  })
})

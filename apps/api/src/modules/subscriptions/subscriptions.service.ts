import { ConflictError } from '../../http/errors'
import { systemClock, type Clock } from '../../lib/clock'
import {
  subscriptionEventsRepository,
  type SubscriptionEventsRepository,
} from './subscription-events.repository'
import {
  canReactivate,
  canSuspend,
  extendPeriod,
  statusAfterReactivate,
} from './subscription-policy'
import { toSubscriptionState } from './subscriptions.mapper'
import {
  subscriptionsRepository,
  type SubscriptionRow,
  type SubscriptionsRepository,
} from './subscriptions.repository'

export const TRIAL_DAYS = 7

export type SubscriptionsServiceDeps = {
  subscriptions: SubscriptionsRepository
  events: SubscriptionEventsRepository
  clock: Clock
}

/**
 * Built from its dependencies rather than importing them, so a test can hand it a fake
 * repository and a frozen clock instead of reaching for a mocking framework.
 */
export function createSubscriptionsService({ subscriptions, events, clock }: SubscriptionsServiceDeps) {
  /**
   * Every action starts here. A teacher should always have a subscription row (the
   * database trigger sees to that now), but rows created before that trigger was fixed
   * are missing one, and the admin should be able to act on those people rather than
   * being blocked by a gap they did not create.
   */
  async function ensure(profileId: string): Promise<SubscriptionRow> {
    const existing = await subscriptions.findByProfileId(profileId)
    if (existing) return existing

    const trialEndsAt = new Date(clock.now().getTime() + TRIAL_DAYS * 86_400_000)
    const created = await subscriptions.create({ profileId, trialEndsAt: trialEndsAt.toISOString() })

    await events.record({
      profileId,
      actorId: null,
      type: 'trial_started',
      payload: { days: TRIAL_DAYS, reason: 'backfilled on first admin action' },
    })

    return created
  }

  /** Somebody else changed the row between reading it and writing it. */
  function stale(): never {
    throw new ConflictError('This subscription changed while the action was being applied')
  }

  return {
    ensure,

    async extend({
      profileId,
      months,
      actorId,
    }: {
      profileId: string
      months: number
      actorId: string
    }): Promise<SubscriptionRow> {
      const row = await ensure(profileId)
      const endsAt = extendPeriod(toSubscriptionState(row), months, clock.now())

      const updated = await subscriptions.updateIfUnchanged({
        profileId,
        expectedUpdatedAt: row.updated_at,
        patch: { status: 'active', current_period_end: endsAt.toISOString() },
      })

      if (!updated) stale()

      await events.record({
        profileId,
        actorId,
        type: 'extended',
        payload: { months, from: row.status, until: endsAt.toISOString() },
      })

      return updated
    },

    async suspend({
      profileId,
      reason,
      actorId,
    }: {
      profileId: string
      reason?: string
      actorId: string
    }): Promise<SubscriptionRow> {
      const row = await ensure(profileId)

      if (!canSuspend(row.status)) {
        throw new ConflictError(`A ${row.status} subscription cannot be suspended`)
      }

      // Dates are deliberately untouched: suspending does not spend the time already
      // paid for, so reactivating gives back whatever was left.
      const updated = await subscriptions.updateIfUnchanged({
        profileId,
        expectedUpdatedAt: row.updated_at,
        patch: { status: 'suspended' },
      })

      if (!updated) stale()

      await events.record({
        profileId,
        actorId,
        type: 'suspended',
        payload: { from: row.status, reason: reason ?? null },
      })

      return updated
    },

    async reactivate({
      profileId,
      actorId,
    }: {
      profileId: string
      actorId: string
    }): Promise<SubscriptionRow> {
      const row = await ensure(profileId)

      if (!canReactivate(row.status)) {
        throw new ConflictError(`Only a suspended subscription can be reactivated`)
      }

      const status = statusAfterReactivate(toSubscriptionState(row), clock.now())

      const updated = await subscriptions.updateIfUnchanged({
        profileId,
        expectedUpdatedAt: row.updated_at,
        patch: { status },
      })

      if (!updated) stale()

      await events.record({ profileId, actorId, type: 'reactivated', payload: { status } })

      return updated
    },
  }
}

export type SubscriptionsService = ReturnType<typeof createSubscriptionsService>

export const subscriptionsService = createSubscriptionsService({
  subscriptions: subscriptionsRepository,
  events: subscriptionEventsRepository,
  clock: systemClock,
})

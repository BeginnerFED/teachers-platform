import type { SubscriptionEvent, TeacherSubscription } from '@tp/shared'
import { daysRemaining, hasAccess, type SubscriptionState } from './subscription-policy'
import type { SubscriptionEventRow } from './subscription-events.repository'
import type { SubscriptionRow } from './subscriptions.repository'

/** The one place a stored row becomes something the rules can reason about. */
export function toSubscriptionState(row: SubscriptionRow): SubscriptionState {
  return {
    status: row.status,
    trialEndsAt: row.trial_ends_at ? new Date(row.trial_ends_at) : null,
    currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : null,
  }
}

/**
 * The shape a client gets. daysRemaining and hasAccess are computed here rather than in
 * the browser: a mobile app must not have to reimplement the rule that a suspended
 * account with time left still cannot be used.
 */
export function toTeacherSubscription(row: SubscriptionRow, now: Date): TeacherSubscription {
  const state = toSubscriptionState(row)

  return {
    status: row.status,
    accessEndsAt: row.access_ends_at,
    daysRemaining: daysRemaining(row.access_ends_at ? new Date(row.access_ends_at) : null, now),
    hasAccess: hasAccess(state, now),
  }
}

export function toSubscriptionEvent(row: SubscriptionEventRow): SubscriptionEvent {
  return {
    id: row.id,
    type: row.type,
    createdAt: row.created_at,
    actor: row.actor
      ? { id: row.actor.id, fullName: row.actor.full_name, email: row.actor.email }
      : null,
    payload:
      row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {},
  }
}

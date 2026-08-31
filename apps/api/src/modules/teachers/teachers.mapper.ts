import type { TeacherDetail, TeacherListItem } from '@tp/shared'
import type { SubscriptionEventRow } from '../subscriptions/subscription-events.repository'
import { toSubscriptionEvent, toTeacherSubscription } from '../subscriptions/subscriptions.mapper'
import type { TeacherRow } from './teachers.repository'

/**
 * The seam between the database's snake_case and the camelCase every client sees.
 * Keeping it in one function means a column rename is a one-file change rather than a
 * search across the web app.
 */
export function toTeacherListItem(row: TeacherRow, now: Date): TeacherListItem {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    createdAt: row.created_at,
    subscription: row.subscriptions ? toTeacherSubscription(row.subscriptions, now) : null,
  }
}

/**
 * The detail view adds the dates a table has no room for, plus the history of who
 * changed what — which is the part that answers "why does this account end in March?".
 */
export function toTeacherDetail(
  row: TeacherRow,
  events: SubscriptionEventRow[],
  now: Date,
): TeacherDetail {
  const subscription = row.subscriptions

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    createdAt: row.created_at,
    subscription: subscription
      ? {
          ...toTeacherSubscription(subscription, now),
          trialEndsAt: subscription.trial_ends_at,
          currentPeriodEnd: subscription.current_period_end,
          startedAt: subscription.created_at,
        }
      : null,
    events: events.map(toSubscriptionEvent),
  }
}

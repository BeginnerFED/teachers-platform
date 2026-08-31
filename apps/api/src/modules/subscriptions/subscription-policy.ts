import type { SubscriptionStatus } from '@tp/shared'

/**
 * Every rule about what a subscription means, as pure functions over dates and statuses.
 *
 * Nothing here reads the clock, touches the database or knows what HTTP is. `now` is
 * always passed in, which is what makes "extend an account that expired last Tuesday"
 * something a test can state directly instead of something you have to wait for.
 */
export type SubscriptionState = {
  status: SubscriptionStatus
  trialEndsAt: Date | null
  currentPeriodEnd: Date | null
}

const DAY_MS = 86_400_000

/** A paid period always wins over the trial it replaced; the trial date stays as history. */
export function accessEndsAt(state: SubscriptionState): Date | null {
  return state.currentPeriodEnd ?? state.trialEndsAt
}

/**
 * Whole days left, rounded up, so "expires in 20 hours" reads as 1 rather than 0.
 * Zero or negative once it has passed. Null when no date governs access at all.
 */
export function daysRemaining(endsAt: Date | null, now: Date): number | null {
  if (!endsAt) return null

  return Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS)
}

/**
 * Status is checked before dates, and that order is the whole point: suspending an
 * account does not take its remaining time away, so a suspended teacher with three weeks
 * left must still be locked out.
 */
export function hasAccess(state: SubscriptionState, now: Date): boolean {
  if (state.status === 'suspended' || state.status === 'canceled') return false

  const endsAt = accessEndsAt(state)

  return endsAt !== null && endsAt.getTime() > now.getTime()
}

/**
 * Adds calendar months, clamping to the end of the target month. Plain date arithmetic
 * turns 31 January plus one month into 3 March; a subscription that behaves like that
 * loses somebody two days every time it renews.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime())
  const targetDay = result.getUTCDate()

  // Move to the first before shifting the month, so the shift itself cannot overflow.
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)

  const lastDayOfTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate()

  result.setUTCDate(Math.min(targetDay, lastDayOfTargetMonth))

  return result
}

/**
 * Extending adds to whatever is left rather than restarting from today, so a teacher who
 * pays a week early keeps that week. An account that already ran out extends from now —
 * time it spent expired is not refunded.
 */
export function extendPeriod(state: SubscriptionState, months: number, now: Date): Date {
  const endsAt = accessEndsAt(state)
  const startFrom = endsAt && endsAt.getTime() > now.getTime() ? endsAt : now

  return addMonths(startFrom, months)
}

/** Suspending something already stopped is a mistake worth reporting, not a no-op. */
export function canSuspend(status: SubscriptionStatus): boolean {
  return status !== 'suspended' && status !== 'canceled'
}

export function canReactivate(status: SubscriptionStatus): boolean {
  return status === 'suspended'
}

/**
 * Coming back from suspension does not invent time. If the period ran out while the
 * account was suspended it returns visibly expired, rather than falsely active.
 */
export function statusAfterReactivate(
  state: SubscriptionState,
  now: Date,
): Extract<SubscriptionStatus, 'active' | 'past_due'> {
  const endsAt = accessEndsAt(state)

  return endsAt && endsAt.getTime() > now.getTime() ? 'active' : 'past_due'
}

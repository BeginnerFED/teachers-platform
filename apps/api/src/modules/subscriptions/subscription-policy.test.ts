import { describe, expect, it } from 'vitest'
import {
  accessEndsAt,
  addMonths,
  canReactivate,
  canSuspend,
  daysRemaining,
  extendPeriod,
  hasAccess,
  statusAfterReactivate,
  type SubscriptionState,
} from './subscription-policy'

const NOW = new Date('2026-03-15T12:00:00.000Z')

function state(overrides: Partial<SubscriptionState> = {}): SubscriptionState {
  return { status: 'trialing', trialEndsAt: null, currentPeriodEnd: null, ...overrides }
}

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * 86_400_000)
}

describe('accessEndsAt', () => {
  it('prefers the paid period over the trial it replaced', () => {
    const paidUntil = daysFromNow(30)

    expect(
      accessEndsAt(state({ trialEndsAt: daysFromNow(2), currentPeriodEnd: paidUntil })),
    ).toEqual(paidUntil)
  })

  it('falls back to the trial while nothing has been paid', () => {
    const trialUntil = daysFromNow(5)

    expect(accessEndsAt(state({ trialEndsAt: trialUntil }))).toEqual(trialUntil)
  })

  it('is null when no date governs access at all', () => {
    expect(accessEndsAt(state())).toBeNull()
  })
})

describe('daysRemaining', () => {
  it('rounds up, so most of a day left still reads as a day', () => {
    expect(daysRemaining(new Date('2026-03-16T08:00:00.000Z'), NOW)).toBe(1)
  })

  it('counts a whole day exactly', () => {
    expect(daysRemaining(daysFromNow(12), NOW)).toBe(12)
  })

  it('goes negative once it has passed, rather than hiding it at zero', () => {
    expect(daysRemaining(daysFromNow(-3), NOW)).toBe(-3)
  })

  it('is null without an end date', () => {
    expect(daysRemaining(null, NOW)).toBeNull()
  })
})

describe('hasAccess', () => {
  it('lets a teacher work during the trial', () => {
    expect(hasAccess(state({ status: 'trialing', trialEndsAt: daysFromNow(3) }), NOW)).toBe(true)
  })

  it('lets a paid teacher work', () => {
    expect(hasAccess(state({ status: 'active', currentPeriodEnd: daysFromNow(20) }), NOW)).toBe(
      true,
    )
  })

  // The rule that a plain date comparison would get wrong.
  it('locks out a suspended account even with weeks left on it', () => {
    expect(hasAccess(state({ status: 'suspended', currentPeriodEnd: daysFromNow(21) }), NOW)).toBe(
      false,
    )
  })

  it('locks out a canceled account with time left', () => {
    expect(hasAccess(state({ status: 'canceled', currentPeriodEnd: daysFromNow(21) }), NOW)).toBe(
      false,
    )
  })

  it('locks out an expired period', () => {
    expect(hasAccess(state({ status: 'past_due', currentPeriodEnd: daysFromNow(-1) }), NOW)).toBe(
      false,
    )
  })

  it('locks out an expired trial', () => {
    expect(hasAccess(state({ status: 'trialing', trialEndsAt: daysFromNow(-1) }), NOW)).toBe(false)
  })

  it('locks out a subscription with no end date', () => {
    expect(hasAccess(state({ status: 'active' }), NOW)).toBe(false)
  })
})

describe('addMonths', () => {
  it('keeps the day of the month when it exists', () => {
    expect(addMonths(new Date('2026-03-15T12:00:00.000Z'), 1)).toEqual(
      new Date('2026-04-15T12:00:00.000Z'),
    )
  })

  // Naive arithmetic turns this into 3 March and quietly loses two days.
  it('clamps 31 January to the last day of February', () => {
    expect(addMonths(new Date('2026-01-31T00:00:00.000Z'), 1)).toEqual(
      new Date('2026-02-28T00:00:00.000Z'),
    )
  })

  it('clamps into a leap February', () => {
    expect(addMonths(new Date('2027-12-31T00:00:00.000Z'), 2)).toEqual(
      new Date('2028-02-29T00:00:00.000Z'),
    )
  })

  it('crosses the year boundary', () => {
    expect(addMonths(new Date('2026-11-30T00:00:00.000Z'), 3)).toEqual(
      new Date('2027-02-28T00:00:00.000Z'),
    )
  })
})

describe('extendPeriod', () => {
  // The decision: paying early must not burn the days already paid for.
  it('adds on top of the time that is left', () => {
    const twelveDaysLeft = state({ status: 'trialing', trialEndsAt: daysFromNow(12) })
    const result = extendPeriod(twelveDaysLeft, 1, NOW)

    expect(result).toEqual(addMonths(daysFromNow(12), 1))
    expect(daysRemaining(result, NOW)).toBe(43)
  })

  it('extends an expired account from today, without refunding the gap', () => {
    const expiredLastWeek = state({ status: 'past_due', currentPeriodEnd: daysFromNow(-7) })

    expect(extendPeriod(expiredLastWeek, 1, NOW)).toEqual(addMonths(NOW, 1))
  })

  it('starts from today when there is no end date at all', () => {
    expect(extendPeriod(state({ status: 'active' }), 1, NOW)).toEqual(addMonths(NOW, 1))
  })

  it('honours a multi-month extension', () => {
    expect(extendPeriod(state({ status: 'active' }), 3, NOW)).toEqual(addMonths(NOW, 3))
  })
})

describe('canSuspend', () => {
  it.each(['trialing', 'active', 'past_due'] as const)('allows suspending %s', (status) => {
    expect(canSuspend(status)).toBe(true)
  })

  it.each(['suspended', 'canceled'] as const)('refuses to suspend %s again', (status) => {
    expect(canSuspend(status)).toBe(false)
  })
})

describe('canReactivate', () => {
  it('allows it only from suspended', () => {
    expect(canReactivate('suspended')).toBe(true)
  })

  it.each(['trialing', 'active', 'past_due', 'canceled'] as const)('refuses %s', (status) => {
    expect(canReactivate(status)).toBe(false)
  })
})

describe('statusAfterReactivate', () => {
  it('comes back active when time is left', () => {
    expect(
      statusAfterReactivate(state({ status: 'suspended', currentPeriodEnd: daysFromNow(9) }), NOW),
    ).toBe('active')
  })

  it('comes back visibly expired when the period ran out while suspended', () => {
    expect(
      statusAfterReactivate(state({ status: 'suspended', currentPeriodEnd: daysFromNow(-2) }), NOW),
    ).toBe('past_due')
  })

  it('comes back expired when there is no end date', () => {
    expect(statusAfterReactivate(state({ status: 'suspended' }), NOW)).toBe('past_due')
  })
})

import type { SubscriptionStatus, TeacherSubscription } from '@tp/shared'
import type { Messages } from '@/messages'

/**
 * Ukrainian picks between three forms of a counted noun — 1 день, 2 дні, 5 днів — with an
 * exception around the teens. Intl knows the rule; writing it out by hand is how you end
 * up with "21 днів" on somebody's screen.
 */
const pluralRules = new Intl.PluralRules('uk')

function dayNoun(days: number, t: Messages): string {
  const form = pluralRules.select(days)

  if (form === 'one') return t.teachers.days.one
  if (form === 'few') return t.teachers.days.few

  return t.teachers.days.many
}

export function remainingLabel(subscription: TeacherSubscription | null, t: Messages): string {
  if (!subscription) return t.teachers.noSubscription
  if (subscription.daysRemaining === null) return t.teachers.noEndDate
  if (subscription.daysRemaining <= 0) return t.teachers.expired

  return `${subscription.daysRemaining} ${dayNoun(subscription.daysRemaining, t)}`
}

export function statusLabel(status: SubscriptionStatus, t: Messages): string {
  return t.teachers.statuses[status]
}

/**
 * past_due and suspended both read as destructive, deliberately: one means nobody paid
 * and the other means somebody switched it off, and in a list an admin scans quickly,
 * both mean "this person cannot work".
 */
export function statusVariant(
  status: SubscriptionStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default'
    case 'trialing':
      return 'secondary'
    case 'past_due':
    case 'suspended':
      return 'destructive'
    case 'canceled':
      return 'outline'
  }
}

export function formatJoinedAt(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso))
}

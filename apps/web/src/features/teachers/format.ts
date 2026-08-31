import type { SubscriptionStatus, TeacherSubscription } from '@tp/shared'
import type { Messages } from '@/messages'

/**
 * Ukrainian picks between three forms of a counted noun — 1 день, 2 дні, 5 днів — with an
 * exception around the teens. Intl knows the rule; writing it out by hand is how you end
 * up with "21 днів" on somebody's screen.
 */
const pluralRules = new Intl.PluralRules('uk')

export function dayNoun(days: number, t: Messages): string {
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
 * Outlined badges: border, text and background from one colour family, so a status reads
 * as a label rather than as a solid block competing with the brand colour used by
 * buttons. Text at the 700 step on a 50 background clears contrast comfortably.
 *
 * The hues are semantic rather than decorative — green is fine, amber is a warning, red
 * is stopped — which is what lets an admin scan a column without reading every word.
 */
/**
 * The outline is the text colour at half strength: softer than the label it frames, but
 * unmistakably the same hue. Written as an alpha on currentColor rather than a fixed
 * palette step, so it tracks the text automatically and needs no second set of values
 * for dark mode to fall out of step with.
 */
export const STATUS_BADGE_CLASS: Record<SubscriptionStatus, string> = {
  trialing: 'border-current/50 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  active:
    'border-current/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  past_due: 'border-current/50 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  suspended: 'border-current/50 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  canceled:
    'border-current/50 bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400',
}

export const NEUTRAL_BADGE_CLASS = STATUS_BADGE_CLASS.canceled

export function formatJoinedAt(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso))
}

/**
 * Date only. A subscription runs to the end of a day, so the time is noise — and in
 * Ukrainian it is the difference between a value that fits its row and one that wraps.
 */
export function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '—'

  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso))
}

export function formatDateTime(iso: string | null, locale: string): string {
  if (!iso) return '—'

  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400_000],
  ['month', 30 * 86_400_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
]

/** "3 days ago" in the viewer's language, so a timestamp reads as a fact about now. */
export function formatRelative(iso: string, locale: string): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const diff = new Date(iso).getTime() - Date.now()

  for (const [unit, size] of UNITS) {
    if (Math.abs(diff) >= size) return formatter.format(Math.round(diff / size), unit)
  }

  return formatter.format(0, 'minute')
}

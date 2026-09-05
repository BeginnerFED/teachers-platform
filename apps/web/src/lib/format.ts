/**
 * Dates, rendered the way the viewer's language renders them.
 *
 * Shared rather than owned by one feature: every list in the admin area shows when
 * something happened, and two copies of "how this product writes a date" is how one of
 * them ends up writing it differently.
 */

export function formatJoinedAt(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso))
}

/** Two letters for an avatar with no picture behind it. */
export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
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

/**
 * The right form of a noun for a count, in the viewer's language. Ukrainian has three
 * ("1 робота, 2 роботи, 5 робіт"); the dictionary writes them in one string, in that
 * order — one, few, many — separated by "|". A language with fewer forms repeats one.
 */
export function plural(count: number, forms: string, locale: string): string {
  const [one, few = one, many = few] = forms.split('|')
  const category = new Intl.PluralRules(locale).select(count)

  return category === 'one' ? one : category === 'few' ? few : many
}

/** A count and its noun together: "5 робіт". */
export function counted(count: number, forms: string, locale: string): string {
  return `${count} ${plural(count, forms, locale)}`
}

/** "3 days ago" in the viewer's language, so a timestamp reads as a fact about now. */
export function formatRelative(iso: string, locale: string): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const diff = new Date(iso).getTime() - Date.now()

  for (const [unit, size] of UNITS) {
    if (Math.abs(diff) >= size) return formatter.format(Math.round(diff / size), unit)
  }

  return formatter.format(0, 'minute')
}

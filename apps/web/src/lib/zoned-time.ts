/**
 * The little bit of time-zone arithmetic a calendar needs, and no more.
 *
 * A lesson is stored as an instant. A calendar is a grid of wall-clock times. Turning one
 * into the other is the whole job, and it cannot be done with a fixed offset: Kyiv is
 * three hours ahead in summer and two in winter, so a grid built on a constant is right
 * for half the year. Everything here goes through Intl, which knows the rules.
 */

export type PlainDate = { year: number; month: number; day: number }
export type PlainTime = PlainDate & { hour: number; minute: number }

const partsFormatter = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatter.get(timeZone)

  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsFormatter.set(timeZone, formatter)
  }

  return formatter
}

/** What the clock on the wall says, in that zone, at that instant. */
export function toZoned(instant: Date, timeZone: string): PlainTime {
  const parts = formatterFor(timeZone).formatToParts(instant)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    // Some locales render midnight as hour 24 rather than 0; both mean the same instant.
    hour: value('hour') % 24,
    minute: value('minute'),
  }
}

function offsetMinutes(instant: Date, timeZone: string): number {
  const zoned = toZoned(instant, timeZone)
  const seconds = Number(
    formatterFor(timeZone)
      .formatToParts(instant)
      .find((part) => part.type === 'second')?.value ?? '0',
  )

  const asIfUtc = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    seconds,
  )

  return (asIfUtc - instant.getTime()) / 60_000
}

/**
 * The instant at which the wall clock in that zone reads this.
 *
 * Solved twice because the offset depends on the answer: the first guess uses the offset
 * at the wrong moment, which is off by an hour for the day either side of a clock change,
 * and the second uses the offset at the moment the first one found.
 */
export function fromZoned(time: PlainTime, timeZone: string): Date {
  const naive = Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute)
  const firstGuess = new Date(naive - offsetMinutes(new Date(naive), timeZone) * 60_000)

  return new Date(naive - offsetMinutes(firstGuess, timeZone) * 60_000)
}

/** Monday, because that is where a Ukrainian week starts. */
export function startOfWeek(date: PlainDate): PlainDate {
  const noon = new Date(Date.UTC(date.year, date.month - 1, date.day, 12))
  // getUTCDay is 0 for Sunday, which is the end of the week here rather than the start.
  const weekday = (noon.getUTCDay() + 6) % 7
  noon.setUTCDate(noon.getUTCDate() - weekday)

  return { year: noon.getUTCFullYear(), month: noon.getUTCMonth() + 1, day: noon.getUTCDate() }
}

export function addDays(date: PlainDate, days: number): PlainDate {
  // Noon, so that adding a day cannot land on a moment that a clock change erased.
  const noon = new Date(Date.UTC(date.year, date.month - 1, date.day, 12))
  noon.setUTCDate(noon.getUTCDate() + days)

  return { year: noon.getUTCFullYear(), month: noon.getUTCMonth() + 1, day: noon.getUTCDate() }
}

const pad = (value: number) => String(value).padStart(2, '0')

/** YYYY-MM-DD, which is what travels in the query string. */
export function toIsoDate(date: PlainDate): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`
}

export function parseIsoDate(value: string | undefined): PlainDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  if (!match) return null

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  return { year, month, day }
}

export function isSameDate(a: PlainDate, b: PlainDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
}

/** Minutes since midnight, in the zone — which is where a lesson sits on the grid. */
export function minutesIntoDay(instant: Date, timeZone: string): number {
  const zoned = toZoned(instant, timeZone)

  return zoned.hour * 60 + zoned.minute
}

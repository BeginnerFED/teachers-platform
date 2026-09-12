import { PLATFORM_TIME_ZONE } from '@tp/shared'
import { addDays, fromZoned, parseIsoDate, startOfWeek, toIsoDate, toZoned } from '@/lib/zoned-time'

/** Both calendars use the same week boundaries, including daylight-saving changes. */
export function getCalendarWeek(week: string | undefined, locale: string, now = new Date()) {
  const today = toZoned(now, PLATFORM_TIME_ZONE)
  const monday = startOfWeek(parseIsoDate(week) ?? today)
  const nextMonday = addDays(monday, 7)
  const from = fromZoned({ ...monday, hour: 0, minute: 0 }, PLATFORM_TIME_ZONE)
  const to = fromZoned({ ...nextMonday, hour: 0, minute: 0 }, PLATFORM_TIME_ZONE)
  const label = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: PLATFORM_TIME_ZONE,
  }).formatRange(
    fromZoned({ ...monday, hour: 12, minute: 0 }, PLATFORM_TIME_ZONE),
    fromZoned({ ...addDays(monday, 6), hour: 12, minute: 0 }, PLATFORM_TIME_ZONE),
  )

  return {
    today,
    monday,
    from: from.toISOString(),
    to: to.toISOString(),
    label,
    previousWeek: toIsoDate(addDays(monday, -7)),
    nextWeek: toIsoDate(nextMonday),
  }
}

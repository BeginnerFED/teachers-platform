import { initials } from '@/lib/format'
import { addDays, fromZoned, type PlainDate } from '@/lib/zoned-time'
import type { Messages } from '@/messages'

/**
 * The week the chapter shows, on Kyiv's calendar like every calendar in the product: Monday
 * 28 September to Sunday 4 October, with Thursday the 1st as today.
 */
const TIME_ZONE = 'Europe/Kyiv'
const MONDAY: PlainDate = { year: 2026, month: 9, day: 28 }
const TODAY = 3

/** Noon, as the week grid does it: a date has no time, and noon is one no clock change erases. */
const noon = (date: PlainDate) => fromZoned({ ...date, hour: 12, minute: 0 }, TIME_ZONE)

/**
 * What the schedule scene says, picked on the server from the page's dictionary.
 *
 * The week label, weekday names and day numbers are written here with the same Intl calls
 * the calendar page makes, so each language gets its own short month and weekday forms.
 */
export function pickScheduleCopy(t: Messages) {
  const locale = t.common.pickerLocale
  const days = Array.from({ length: 7 }, (_, index) => noon(addDays(MONDAY, index)))
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: TIME_ZONE })
  const dayNumber = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: TIME_ZONE })
  const range = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: TIME_ZONE,
  })
  const { people } = t.loginPromo

  return {
    title: t.loginPromo.scenes.schedule.title,
    line: t.loginPromo.scenes.schedule.line,
    thisWeek: t.calendar.today,
    week: range.formatRange(days[0]!, days[6]!),
    days: days.map((day, index) => ({
      weekday: weekday.format(day),
      day: dayNumber.format(day),
      today: index === TODAY,
    })),
    /** Each student's face on the grid: the initials the calendar draws for them. */
    faces: {
      olya: initials(people.olya),
      maksym: initials(people.maksym),
      iryna: initials(people.iryna),
      dmytro: initials(people.dmytro),
      anna: initials(people.anna),
    },
    reminder: t.studentHome.notificationKinds.lesson_reminder,
    open: t.homework.open,
  }
}

export type ScheduleCopy = ReturnType<typeof pickScheduleCopy>

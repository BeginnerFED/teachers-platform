import type { CalendarLesson, LessonStatus } from '@tp/shared'
import { cn } from '@/lib/utils'
import {
  addDays,
  fromZoned,
  isSameDate,
  minutesIntoDay,
  toZoned,
  type PlainDate,
} from '@/lib/zoned-time'
import type { Messages } from '@/messages'
import { packOverlapping } from '../layout'

/** One hour of the day, in pixels. Fifty minutes of teaching has to stay readable in it. */
const HOUR = 56

/** What the grid falls back to when the week is empty and nothing sets its own bounds. */
const DEFAULT_FIRST_HOUR = 8
const DEFAULT_LAST_HOUR = 21

const STATUS_CLASS: Record<LessonStatus, string> = {
  // What is still to come is the thing an admin is looking for, so it wears the brand.
  scheduled: 'bg-primary/10 border-l-primary hover:bg-primary/15',
  held: 'bg-muted border-l-muted-foreground/40 hover:bg-muted/80',
  canceled: 'bg-muted/40 border-l-border text-muted-foreground hover:bg-muted/60',
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

/** Noon, because a date has no time and noon is the hour a clock change cannot erase. */
function instantForDay(date: PlainDate, timeZone: string): Date {
  return fromZoned({ ...date, hour: 12, minute: 0 }, timeZone)
}

export function WeekGrid({
  lessons,
  monday,
  today,
  timeZone,
  locale,
  t,
}: {
  lessons: CalendarLesson[]
  monday: PlainDate
  today: PlainDate
  timeZone: string
  locale: string
  t: Messages
}) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index))

  // Each lesson placed on the wall clock of the platform's zone, once, so nothing below
  // has to think about time zones again.
  const placedLessons = lessons.map((lesson) => {
    const instant = new Date(lesson.scheduledAt)
    const zoned = toZoned(instant, timeZone)
    const start = minutesIntoDay(instant, timeZone)

    return { lesson, date: zoned, start, end: start + lesson.durationMinutes }
  })

  // The grid stretches to what is actually in the week rather than to office hours, so a
  // lesson at seven in the morning is visible instead of scrolled off the top.
  const firstHour = placedLessons.length
    ? Math.max(0, Math.min(DEFAULT_FIRST_HOUR, ...placedLessons.map((p) => Math.floor(p.start / 60))))
    : DEFAULT_FIRST_HOUR
  const lastHour = placedLessons.length
    ? Math.min(24, Math.max(DEFAULT_LAST_HOUR, ...placedLessons.map((p) => Math.ceil(p.end / 60))))
    : DEFAULT_LAST_HOUR

  const hours = Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index)
  const height = hours.length * HOUR
  const offset = (minutes: number) => ((minutes - firstHour * 60) / 60) * HOUR

  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone })
  const dayNumber = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone })
  const clock = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone })

  const columns = 'grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]'

  return (
    <div className="overflow-hidden rounded-md border">
      <div className={cn(columns, 'bg-muted/50 border-b')}>
        <div className="border-r" />

        {days.map((day) => {
          const current = isSameDate(day, today)

          return (
            <div
              key={`${day.month}-${day.day}`}
              className="flex items-baseline justify-center gap-1.5 border-r py-2 last:border-r-0"
            >
              <span className="text-muted-foreground text-xs capitalize">
                {weekday.format(instantForDay(day, timeZone))}
              </span>
              <span
                className={cn(
                  'text-sm tabular-nums',
                  current
                    ? 'bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full font-semibold'
                    : 'font-medium',
                )}
              >
                {dayNumber.format(instantForDay(day, timeZone))}
              </span>
            </div>
          )
        })}
      </div>

      <div className="relative overflow-x-auto">
        <div className={cn(columns, 'relative')} style={{ height }}>
          <div className="relative border-r">
            {hours.map((hour) => (
              <span
                key={hour}
                className="text-muted-foreground absolute right-2 -translate-y-1/2 text-[11px] tabular-nums"
                style={{ top: offset(hour * 60) }}
              >
                {`${pad(hour)}:00`}
              </span>
            ))}
          </div>

          {days.map((day) => {
            const ofDay = placedLessons.filter((p) => isSameDate(p.date, day))
            const packed = packOverlapping(ofDay, (p) => ({ start: p.start, end: p.end }))

            return (
              <div key={`${day.month}-${day.day}`} className="relative border-r last:border-r-0">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    aria-hidden
                    className="border-border/60 absolute inset-x-0 border-t first:border-t-0"
                    style={{ top: offset(hour * 60) }}
                  />
                ))}

                {packed.map(({ item, lane, lanes }) => {
                  const { lesson } = item
                  const names = lesson.students.map((s) => s.fullName ?? s.email)
                  const teacher = lesson.teacher
                    ? (lesson.teacher.fullName ?? lesson.teacher.email)
                    : '—'

                  return (
                    <div
                      key={lesson.id}
                      // The full picture on hover, because at three lessons to a column
                      // there is not room to write it out.
                      title={`${clock.format(new Date(lesson.scheduledAt))} · ${teacher}\n${names.join(', ')}${lesson.topic ? `\n${lesson.topic}` : ''}`}
                      className={cn(
                        'absolute overflow-hidden rounded-md border border-l-2 px-1.5 py-1 transition-colors',
                        STATUS_CLASS[lesson.status],
                      )}
                      style={{
                        top: offset(item.start) + 1,
                        height: Math.max(offset(item.end) - offset(item.start) - 2, 18),
                        left: `calc(${(lane / lanes) * 100}% + 2px)`,
                        width: `calc(${(1 / lanes) * 100}% - 4px)`,
                      }}
                    >
                      <p
                        className={cn(
                          'truncate text-[11px] leading-tight font-medium',
                          lesson.status === 'canceled' && 'line-through',
                        )}
                      >
                        {teacher}
                      </p>
                      <p className="text-muted-foreground truncate text-[10px] leading-tight">
                        {names.length === 0 ? t.calendar.noStudents : names.join(', ')}
                      </p>
                      {lesson.topic ? (
                        <p className="text-muted-foreground truncate text-[10px] leading-tight">
                          {lesson.topic}
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {lessons.length === 0 ? (
          <p className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-sm">
            {t.calendar.empty}
          </p>
        ) : null}
      </div>
    </div>
  )
}

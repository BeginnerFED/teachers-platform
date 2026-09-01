import { PLATFORM_TIME_ZONE } from '@tp/shared'
import { listLessons } from '@/features/calendar/api'
import { CalendarToolbar } from '@/features/calendar/components/calendar-toolbar'
import { WeekGrid } from '@/features/calendar/components/week-grid'
import { listTeachers } from '@/features/teachers/api'
import { requireViewer } from '@/lib/auth'
import { addDays, fromZoned, parseIsoDate, startOfWeek, toIsoDate, toZoned } from '@/lib/zoned-time'
import { getMessages } from '@/messages/server'

/** Enough to cover every teacher on the platform; the filter is what narrows it. */
const TEACHER_LIMIT = 100

export default async function CalendarPage({ searchParams }: PageProps<'/admin/calendar'>) {
  const [viewer, t, raw] = await Promise.all([requireViewer(), getMessages(), searchParams])

  const week = typeof raw.week === 'string' ? raw.week : undefined
  const teacherId = typeof raw.teacher === 'string' ? raw.teacher : undefined

  // A hand-edited week falls back to the current one rather than blanking the page. Today
  // is read in the platform's zone, not the server's, or the week would turn over at the
  // wrong moment for everyone using it.
  const today = toZoned(new Date(), PLATFORM_TIME_ZONE)
  const monday = startOfWeek(parseIsoDate(week) ?? today)
  const nextMonday = addDays(monday, 7)

  const from = fromZoned({ ...monday, hour: 0, minute: 0 }, PLATFORM_TIME_ZONE)
  const to = fromZoned({ ...nextMonday, hour: 0, minute: 0 }, PLATFORM_TIME_ZONE)

  // Independent reads, so they go together. The teacher list feeds the filter only.
  const [lessons, teachers] = await Promise.all([
    listLessons({
      from: from.toISOString(),
      to: to.toISOString(),
      // A hand-edited teacher id is dropped by the API's own validation, so it is passed
      // through as it arrived rather than half-checked here.
      ...(teacherId ? { teacherId } : {}),
    }),
    listTeachers({ page: 1, perPage: TEACHER_LIMIT }),
  ])

  // Written on the server, where the zone is known: "31 серп. – 6 вер."
  const range = new Intl.DateTimeFormat(viewer.locale, {
    day: 'numeric',
    month: 'short',
    timeZone: PLATFORM_TIME_ZONE,
  }).formatRange(
    fromZoned({ ...monday, hour: 12, minute: 0 }, PLATFORM_TIME_ZONE),
    fromZoned({ ...addDays(monday, 6), hour: 12, minute: 0 }, PLATFORM_TIME_ZONE),
  )

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="flex items-baseline gap-2 text-2xl font-semibold">
          {t.calendar.title}
          <span className="text-muted-foreground text-lg font-normal tabular-nums">
            ({lessons.length})
          </span>
        </h1>
        <p className="text-muted-foreground text-sm">{t.calendar.description}</p>
      </div>

      <CalendarToolbar
        label={range}
        previousWeek={toIsoDate(addDays(monday, -7))}
        nextWeek={toIsoDate(nextMonday)}
        teacherId={teacherId}
        teachers={teachers.data.map((teacher) => ({
          id: teacher.id,
          name: teacher.fullName ?? teacher.email,
        }))}
        t={t}
      />

      <WeekGrid
        lessons={lessons}
        monday={monday}
        today={today}
        timeZone={PLATFORM_TIME_ZONE}
        locale={viewer.locale}
        t={t}
      />
    </>
  )
}

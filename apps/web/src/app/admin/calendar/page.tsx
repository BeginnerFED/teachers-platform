import { PLATFORM_TIME_ZONE } from '@tp/shared'
import { listLessons } from '@/features/calendar/api'
import { CalendarBrowser } from '@/features/calendar/components/calendar-browser'
import { WeekGrid } from '@/features/calendar/components/week-grid'
import { getCalendarWeek } from '@/features/calendar/week'
import { listTeachers } from '@/features/teachers/api'
import { requireRole } from '@/lib/auth'
import { getMessages } from '@/messages/server'

/** Enough to cover every teacher on the platform; the filter is what narrows it. */
const TEACHER_LIMIT = 100

export default async function CalendarPage({ searchParams }: PageProps<'/admin/calendar'>) {
  const [viewer, t, raw] = await Promise.all([requireRole('admin'), getMessages(), searchParams])

  const week = typeof raw.week === 'string' ? raw.week : undefined
  const teacherId = typeof raw.teacher === 'string' ? raw.teacher : undefined

  const calendar = getCalendarWeek(week, viewer.locale)

  // Independent reads, so they go together. The teacher list feeds the filter only.
  const [lessons, teachers] = await Promise.all([
    listLessons({
      from: calendar.from,
      to: calendar.to,
      // A hand-edited teacher id is dropped by the API's own validation, so it is passed
      // through as it arrived rather than half-checked here.
      ...(teacherId ? { teacherId } : {}),
    }),
    listTeachers({ page: 1, perPage: TEACHER_LIMIT }),
  ])

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

      <CalendarBrowser
        label={calendar.label}
        previousWeek={calendar.previousWeek}
        nextWeek={calendar.nextWeek}
        teacherId={teacherId}
        teachers={teachers.data.map((teacher) => ({
          id: teacher.id,
          name: teacher.fullName ?? teacher.email,
        }))}
        t={t}
      >
        <WeekGrid
          lessons={lessons}
          monday={calendar.monday}
          today={calendar.today}
          timeZone={PLATFORM_TIME_ZONE}
          locale={viewer.locale}
          t={t}
        />
      </CalendarBrowser>
    </>
  )
}

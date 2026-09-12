import { PLATFORM_TIME_ZONE } from '@tp/shared'
import { CalendarBrowser } from '@/features/calendar/components/calendar-browser'
import { getCalendarWeek } from '@/features/calendar/week'
import { studentLessons } from '@/features/student-dashboard/api'
import { StudyLessons } from '@/features/student-dashboard/components/study-lessons'
import { StudyEmpty } from '@/features/student-dashboard/components/study-panel'
import { requireRole } from '@/lib/auth'
import { addDays, fromZoned, toIsoDate, toZoned } from '@/lib/zoned-time'
import { getMessages } from '@/messages/server'

export default async function StudentCalendarPage({
  searchParams,
}: PageProps<'/student/calendar'>) {
  const [viewer, t, raw] = await Promise.all([requireRole('student'), getMessages(), searchParams])
  const week = getCalendarWeek(typeof raw.week === 'string' ? raw.week : undefined, viewer.locale)
  const lessons = await studentLessons({ from: week.from, to: week.to })
  const now = new Date().getTime()
  const date = new Intl.DateTimeFormat(viewer.locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: PLATFORM_TIME_ZONE,
  })
  const days = Array.from({ length: 7 }, (_, index) => addDays(week.monday, index))
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.studentHome.calendar}</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">{t.studentHome.calendarDescription}</p>
      </div>
      <CalendarBrowser
        label={week.label}
        previousWeek={week.previousWeek}
        nextWeek={week.nextWeek}
        t={t}
      >
        {!lessons.length ? (
          <div className="rounded-xl border">
            <StudyEmpty title={t.studentHome.noWeekLessons} hint={t.studentHome.noLessonsHint} />
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            {days.map((day) => {
              const key = toIsoDate(day)
              const items = lessons.filter(
                (lesson) =>
                  toIsoDate(toZoned(new Date(lesson.scheduledAt), PLATFORM_TIME_ZONE)) === key,
              )
              return (
                <section key={key} className="border-b last:border-b-0">
                  <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <h2 className="text-sm font-medium">
                      {date.format(fromZoned({ ...day, hour: 12, minute: 0 }, PLATFORM_TIME_ZONE))}
                    </h2>
                    {key === toIsoDate(week.today) && (
                      <span className="text-primary text-xs font-medium">{t.calendar.today}</span>
                    )}
                  </div>
                  {items.length ? (
                    <StudyLessons
                      now={now}
                      lessons={items}
                      t={t}
                      locale={viewer.locale}
                      calendar
                      selectedId={typeof raw.lesson === 'string' ? raw.lesson : undefined}
                    />
                  ) : (
                    <p className="text-muted-foreground px-5 py-3 text-xs">
                      {t.studentHome.noDayLessons}
                    </p>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </CalendarBrowser>
    </>
  )
}

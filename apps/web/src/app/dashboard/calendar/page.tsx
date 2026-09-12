import { PLATFORM_TIME_ZONE } from '@tp/shared'
import { listMyLessons } from '@/features/calendar/api'
import { listRecipients } from '@/features/homework/api'
import { ScheduleLessonDialog } from '@/features/calendar/components/schedule-lesson-dialog'
import { CalendarBrowser } from '@/features/calendar/components/calendar-browser'
import { WeekGrid } from '@/features/calendar/components/week-grid'
import { getCalendarWeek } from '@/features/calendar/week'
import { requireRole } from '@/lib/auth'
import { getMessages } from '@/messages/server'
import { addDays, toIsoDate } from '@/lib/zoned-time'

export default async function TeacherCalendarPage({
  searchParams,
}: PageProps<'/dashboard/calendar'>) {
  const [viewer, t, raw] = await Promise.all([requireRole('teacher'), getMessages(), searchParams])
  const calendar = getCalendarWeek(
    typeof raw.week === 'string' ? raw.week : undefined,
    viewer.locale,
  )
  const [lessons, students] = await Promise.all([
    listMyLessons({ from: calendar.from, to: calendar.to }),
    listRecipients().catch(() => null),
  ])
  const today = toIsoDate(calendar.today)
  const monday = toIsoDate(calendar.monday)
  const defaultDate =
    today >= monday && today < toIsoDate(addDays(calendar.monday, 7)) ? today : monday

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-baseline gap-2 text-2xl font-semibold">
            {t.calendar.title}
            <span className="text-muted-foreground text-lg font-normal tabular-nums">
              ({lessons.length})
            </span>
          </h1>
          <p className="text-muted-foreground text-sm">{t.calendar.teacherDescription}</p>
        </div>
        <ScheduleLessonDialog
          students={students}
          defaultDate={defaultDate}
          locale={viewer.locale}
          t={t}
        />
      </div>
      <CalendarBrowser
        label={calendar.label}
        previousWeek={calendar.previousWeek}
        nextWeek={calendar.nextWeek}
        t={t}
      >
        <WeekGrid
          key={`${monday}:${typeof raw.lesson === 'string' ? raw.lesson : ''}:${raw.attendance === '1'}`}
          initialLessonId={
            typeof raw.lesson === 'string' && lessons.some((lesson) => lesson.id === raw.lesson)
              ? raw.lesson
              : undefined
          }
          initialAttendance={raw.attendance === '1'}
          showStudents
          editing={{ teacherId: viewer.id, students }}
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

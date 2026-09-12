import Link from 'next/link'
import { CalendarDaysIcon, Clock3Icon } from 'lucide-react'
import { PLATFORM_TIME_ZONE, type StudyLesson } from '@tp/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StudentLessonJoin } from '@/features/live/components/student-live-notifications'
import { startOfWeek, toIsoDate, toZoned } from '@/lib/zoned-time'
import type { Messages } from '@/messages'

export function studentLessonHref(lesson: Pick<StudyLesson, 'id' | 'scheduledAt'>) {
  const week = toIsoDate(startOfWeek(toZoned(new Date(lesson.scheduledAt), PLATFORM_TIME_ZONE)))
  return `/student/calendar?${new URLSearchParams({ week, lesson: lesson.id })}`
}
export function StudyLessons({
  lessons,
  locale,
  t,
  calendar = false,
  selectedId,
  now,
}: {
  lessons: StudyLesson[]
  locale: string
  t: Messages
  calendar?: boolean
  selectedId?: string
  now: number
}) {
  const date = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
    timeZone: PLATFORM_TIME_ZONE,
  })
  const clock = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: PLATFORM_TIME_ZONE,
  })
  return (
    <ul className="divide-y">
      {lessons.map((lesson) => {
        const start = new Date(lesson.scheduledAt)
        const end = new Date(start.getTime() + lesson.durationMinutes * 60_000)
        return (
          <li
            id={`lesson-${lesson.id}`}
            key={lesson.id}
            className={`scroll-mt-20 p-5 ${selectedId === lesson.id ? 'bg-primary/[0.04] ring-primary/30 ring-1 ring-inset' : ''}`}
          >
            <div className="flex flex-wrap items-start gap-3">
              <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                <CalendarDaysIcon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="break-words text-sm font-medium">
                    {lesson.topic || t.studentHome.lesson}
                  </h3>
                  <Badge variant="outline" className="text-muted-foreground">
                    {t.lessons.status[lesson.status]}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1 break-words text-xs">
                  {lesson.teacher?.fullName || lesson.teacher?.email || '—'}
                </p>
                <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums">
                  <Clock3Icon className="text-muted-foreground size-3.5" />
                  <span>
                    {date.format(start)} · {clock.format(start)}–{clock.format(end)}
                  </span>
                  <span className="text-muted-foreground">
                    · {t.studentHome.minutes.replace('{count}', String(lesson.durationMinutes))}
                  </span>
                </p>
                <p className="text-muted-foreground mt-1.5 text-xs">
                  {lesson.attendeeCount > 1
                    ? t.studentHome.group.replace('{count}', String(lesson.attendeeCount))
                    : t.studentHome.individual}
                </p>
                {calendar && lesson.status === 'held' && (
                  <div className="bg-muted/40 mt-3 flex flex-wrap gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-xs">
                    <span>
                      {t.studentHome.attendance}: {t.lessons.attendance[lesson.attendance]}
                    </span>
                    <span className="text-muted-foreground">
                      {lesson.deducted ? t.studentHome.deducted : t.studentHome.notDeducted}
                    </span>
                  </div>
                )}
                {calendar && lesson.status === 'scheduled' && end.getTime() <= now && (
                  <p className="text-muted-foreground mt-3 text-xs">
                    {t.studentHome.attendancePending}
                  </p>
                )}
                {calendar && lesson.status === 'canceled' && (
                  <p className="text-muted-foreground mt-3 text-xs">{t.studentHome.notDeducted}</p>
                )}
                {lesson.status === 'scheduled' && (
                  <div className="mt-3">
                    <StudentLessonJoin lessonId={lesson.id} hideWaiting={end.getTime() <= now} />
                  </div>
                )}
              </div>
              {!calendar && (
                <Button asChild variant="ghost" size="sm" className="corner-brackets">
                  <Link href={studentLessonHref(lesson)}>{t.calendar.title}</Link>
                </Button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowUpRightIcon, CalendarDaysIcon, ChevronRightIcon, ChevronDownIcon } from 'lucide-react'
import {
  PLATFORM_TIME_ZONE,
  type CalendarLesson,
  type MaterialOwner,
  type PendingLessons,
} from '@tp/shared'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { EditLessonDialog } from '@/features/calendar/components/schedule-lesson-dialog'
import { LessonDetailSheet } from '@/features/calendar/components/lesson-detail-sheet'
import type { Messages } from '@/messages'
import { cn } from '@/lib/utils'
import { RefreshDashboard } from './refresh-dashboard'

export function TodayLessons({
  lessons,
  date,
  t,
  locale,
  calendarHref = '/admin/calendar',
  showStudents = false,
  editing,
  pending,
}: {
  lessons: CalendarLesson[] | null
  date: string
  t: Messages
  locale: string
  calendarHref?: string
  showStudents?: boolean
  editing?: { teacherId: string; students: MaterialOwner[] | null }
  pending?: PendingLessons | null
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editLesson, setEditLesson] = useState<CalendarLesson | null>(null)
  const selected = [...(lessons ?? []), ...(pending?.items ?? [])].find(
    (lesson) => lesson.id === selectedId,
  )
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PLATFORM_TIME_ZONE,
  })
  const visible = [...(lessons ?? [])]
    .sort((a, b) => {
      const rank = { scheduled: 0, held: 1, canceled: 2 }
      return rank[a.status] - rank[b.status] || a.scheduledAt.localeCompare(b.scheduledAt)
    })
    .slice(0, 5)

  return (
    <section
      className="bg-card flex min-w-0 flex-col overflow-hidden rounded-xl border"
      aria-labelledby="today-lessons-heading"
    >
      <div className="flex items-center justify-between gap-3 border-b p-5">
        <div>
          <h2 id="today-lessons-heading" className="text-sm font-semibold">
            {t.adminHome.todayLessons}
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            {date} · {t.adminHome.timeZone}
          </p>
        </div>
        <CalendarDaysIcon className="text-muted-foreground size-4 shrink-0" />
      </div>
      {lessons === null ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-10 text-center">
          <p className="text-muted-foreground text-sm">{t.adminHome.calendarFailed}</p>
          <RefreshDashboard label={t.common.retry} />
        </div>
      ) : visible.length ? (
        <ul className="flex-1 divide-y">
          {visible.map((lesson) => (
            <li key={lesson.id}>
              <button
                type="button"
                className="hover:bg-muted/40 focus-visible:ring-ring group flex w-full items-center gap-3 px-5 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                onClick={() => setSelectedId(lesson.id)}
              >
                <span className="border-border bg-muted/30 flex w-12 shrink-0 flex-col items-center gap-1 rounded-lg border py-2 text-xs font-medium tabular-nums">
                  {time.format(new Date(lesson.scheduledAt))}
                  <span className="text-muted-foreground text-[10px] font-normal">
                    {lesson.durationMinutes} {t.lessons.minutes}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {lesson.topic || t.lessons.noTopic}
                  </span>
                  <span className="text-muted-foreground mt-1 block truncate text-xs">
                    {showStudents
                      ? lesson.students
                          .map((student) => student.fullName || student.email)
                          .join(', ') || t.calendar.noStudents
                      : (lesson.teacher?.fullName ?? lesson.teacher?.email ?? '—')}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium',
                    lesson.status === 'scheduled'
                      ? 'border-sky-200 text-sky-700 dark:border-sky-900 dark:text-sky-300'
                      : lesson.status === 'held'
                        ? 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300'
                        : 'text-muted-foreground',
                  )}
                >
                  {editing && lesson.attendancePending
                    ? t.calendar.attendance.pending
                    : t.lessons.status[lesson.status]}
                </span>
                <ChevronRightIcon className="text-muted-foreground group-hover:text-primary size-3.5 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-12 text-center">
          <CalendarDaysIcon className="text-muted-foreground/50 mb-3 size-7" />
          <p className="text-sm font-medium">{t.adminHome.noLessons}</p>
          <p className="text-muted-foreground mt-1 text-xs">{t.adminHome.noLessonsHint}</p>
        </div>
      )}
      {pending === null ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3 text-xs"
        >
          <p className="text-muted-foreground">{t.calendar.attendance.pendingFailed}</p>
          <RefreshDashboard label={t.common.retry} />
        </div>
      ) : pending && pending.total > 0 ? (
        <Collapsible className="border-t">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="corner-brackets group h-auto w-full justify-between gap-2 whitespace-normal rounded-none px-5 py-3 text-left text-xs"
            >
              <span>
                {t.calendar.attendance.pendingLessons}{' '}
                <span className="text-muted-foreground tabular-nums">({pending.total})</span>
              </span>
              <ChevronDownIcon className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="divide-y">
              {pending.items.map((lesson) => (
                <li key={lesson.id}>
                  <Button
                    variant="ghost"
                    className="corner-brackets h-auto w-full justify-between gap-3 rounded-none px-5 py-3 text-left"
                    onClick={() => setSelectedId(lesson.id)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs">
                        {lesson.students.map((s) => s.fullName || s.email).join(', ') ||
                          t.calendar.noStudents}
                      </span>
                      <span className="text-muted-foreground block text-[11px] font-normal">
                        {new Intl.DateTimeFormat(locale, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          timeZone: PLATFORM_TIME_ZONE,
                        }).format(new Date(lesson.scheduledAt))}{' '}
                        · {time.format(new Date(lesson.scheduledAt))}
                      </span>
                    </span>
                    <ChevronRightIcon className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground px-5 pb-3 text-[11px]">
              {t.calendar.attendance.pendingHint.replace('{shown}', String(pending.items.length))}
            </p>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
      <div className="bg-muted/20 flex items-center justify-between gap-3 border-t px-5 py-3 text-xs">
        <span className="text-muted-foreground">
          {lessons &&
            t.adminHome.showing
              .replace('{shown}', String(visible.length))
              .replace('{total}', String(lessons.length))}
        </span>
        <Link
          href={calendarHref}
          className="corner-brackets hover:text-primary focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
        >
          {t.adminHome.openCalendar}
          <ArrowUpRightIcon className="size-3.5" />
        </Link>
      </div>
      <LessonDetailSheet
        lessons={selected ? [selected] : []}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
        timeZone={PLATFORM_TIME_ZONE}
        locale={locale}
        t={t}
        editableTeacherId={editing?.teacherId}
        onEdit={editing ? setEditLesson : undefined}
      />
      {editing && editLesson && (
        <EditLessonDialog
          key={editLesson.id}
          lesson={editLesson}
          students={editing.students}
          locale={locale}
          t={t}
          onClose={() => setEditLesson(null)}
          onSaved={() => setSelectedId(null)}
        />
      )}
    </section>
  )
}

'use client'

import { ArrowLeftIcon, ChevronRightIcon, PencilIcon } from 'lucide-react'
import { useState } from 'react'
import type { CalendarLesson } from '@tp/shared'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { tintFor } from '../tint'
import { LessonAttendance } from './lesson-attendance'
import { StartScheduledLive } from './start-scheduled-live'

const STATUS_BADGE = {
  scheduled: 'border-current/50 bg-sky-50 text-sky-700',
  held: 'border-current/50 bg-emerald-50 text-emerald-700',
  canceled: 'border-current/50 bg-neutral-50 text-neutral-600',
} as const

const ATTENDANCE_BADGE = {
  expected: 'border-current/50 bg-neutral-50 text-neutral-600',
  present: 'border-current/50 bg-emerald-50 text-emerald-700',
  absent: 'border-current/50 bg-red-50 text-red-700',
  excused: 'border-current/50 bg-amber-50 text-amber-700',
} as const

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="bg-muted/40 divide-border divide-y rounded-lg border">{children}</div>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-muted-foreground mb-2 text-[11px] font-medium uppercase tracking-widest">
      {children}
    </h3>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  )
}

function Face({ id, name, size = 32 }: { id: string | null; name: string; size?: number }) {
  return (
    <Avatar className="shrink-0 rounded-full" style={{ width: size, height: size }}>
      <AvatarFallback
        className={cn(
          // The same outlined-badge rule used everywhere else: the border is the text
          // colour at half strength, unmistakably the same hue without competing with it.
          'border-current/50 rounded-full border text-[11px] font-semibold',
          id ? tintFor(id) : '',
        )}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

function Person({ id, name, email }: { id: string; name: string; email?: string }) {
  return (
    <>
      <Face id={id} name={name} />
      <div className="grid min-w-0 flex-1">
        <span className="truncate text-sm">{name}</span>
        {email ? <span className="text-muted-foreground truncate text-xs">{email}</span> : null}
      </div>
    </>
  )
}

function CrowdList({
  lessons,
  onPick,
  range,
  t,
}: {
  lessons: CalendarLesson[]
  onPick: (lesson: CalendarLesson) => void
  range: (lesson: CalendarLesson) => string
  t: Messages
}) {
  return (
    <Panel>
      {lessons.map((lesson) => {
        const teacher = lesson.teacher
        const name = teacher ? (teacher.fullName ?? teacher.email) : '—'

        return (
          <button
            key={lesson.id}
            type="button"
            onClick={() => onPick(lesson)}
            className="hover:bg-muted/60 flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors"
          >
            <Face id={teacher?.id ?? null} name={name} />

            <div className="grid min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="whitespace-nowrap text-sm font-medium tabular-nums">
                  {range(lesson)}
                </span>
                <span className="truncate text-sm">{name}</span>
              </span>
              <span className="text-muted-foreground truncate text-xs">
                {lesson.students.length === 0
                  ? t.calendar.noStudents
                  : lesson.students.map((student) => student.fullName ?? student.email).join(', ')}
              </span>
            </div>

            <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
          </button>
        )
      })}
    </Panel>
  )
}

function LessonDetail({
  lesson,
  t,
  locale,
  canManage,
  initialAttendance = false,
}: {
  lesson: CalendarLesson
  t: Messages
  locale: string
  canManage: boolean
  initialAttendance?: boolean
}) {
  return (
    <div className="flex flex-col gap-6">
      {canManage && <StartScheduledLive lesson={lesson} t={t} />}
      <Panel>
        <Row label={t.calendar.detail.duration}>
          <span className="tabular-nums">
            {lesson.durationMinutes} {t.lessons.minutes}
          </span>
        </Row>

        <Row label={t.calendar.detail.status}>
          <Badge variant="outline" className={STATUS_BADGE[lesson.status]}>
            {t.lessons.status[lesson.status]}
          </Badge>
        </Row>

        <div className="flex items-center gap-3 px-3 py-2">
          <span className="text-muted-foreground shrink-0 text-sm">
            {t.calendar.detail.teacher}
          </span>
          {lesson.teacher ? (
            <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
              <Person
                id={lesson.teacher.id}
                name={lesson.teacher.fullName ?? lesson.teacher.email}
                email={lesson.teacher.email}
              />
            </div>
          ) : (
            <span className="ml-auto text-sm">—</span>
          )}
        </div>
      </Panel>

      {canManage ? (
        <LessonAttendance
          key={lesson.id}
          lesson={lesson}
          locale={locale}
          t={t}
          initialEditing={initialAttendance}
        />
      ) : (
        <div>
          <SectionTitle>
            {t.calendar.detail.students}
            {lesson.students.length > 1 ? (
              <span className="text-muted-foreground ml-1.5 normal-case tabular-nums">
                ({lesson.students.length})
              </span>
            ) : null}
          </SectionTitle>

          <Panel>
            {lesson.students.length === 0 ? (
              <div className="text-muted-foreground px-3 py-3 text-sm">{t.calendar.noStudents}</div>
            ) : (
              lesson.students.map((student) => (
                <div key={student.id} className="flex items-center gap-3 px-3 py-2">
                  <Person
                    id={student.id}
                    name={student.fullName ?? student.email}
                    email={student.email}
                  />
                  <Badge
                    variant="outline"
                    className={cn('shrink-0', ATTENDANCE_BADGE[student.attendance])}
                  >
                    {t.lessons.attendance[student.attendance]}
                  </Badge>
                </div>
              ))
            )}
          </Panel>
        </div>
      )}

      <div>
        <SectionTitle>{t.calendar.detail.note}</SectionTitle>
        <Panel>
          <p
            className={cn(
              'px-3 py-3 text-sm',
              lesson.notes ? 'whitespace-pre-wrap' : 'text-muted-foreground',
            )}
          >
            {lesson.notes ?? t.calendar.detail.noNote}
          </p>
        </Panel>
      </div>
    </div>
  )
}

/**
 * Everything a mark on the grid has no room for.
 *
 * One sheet for the whole grid rather than one per lesson: a busy week is two hundred
 * marks, and two hundred dormant dialogs is a cost paid on every render for something only
 * ever opened once at a time.
 *
 * Reached from the marker standing in for a crowded hour, it opens on a list, because the
 * question then is which teacher is on at what time rather than the particulars of any one
 * of them. Picking a row is what asks that, and it slides in the way a page does.
 */
export function LessonDetailSheet({
  lessons,
  onOpenChange,
  timeZone,
  locale,
  t,
  onEdit,
  editableTeacherId,
  initialAttendance = false,
}: {
  /** One lesson, or the crowd behind a "+3" marker. Empty closes the sheet. */
  lessons: CalendarLesson[]
  onOpenChange: (open: boolean) => void
  timeZone: string
  locale: string
  t: Messages
  onEdit?: (lesson: CalendarLesson) => void
  editableTeacherId?: string
  initialAttendance?: boolean
}) {
  const [focusedId, setFocusedId] = useState<string | null>(null)
  /**
   * Outlives the selection by one slide. Clearing it on the way back would unmount the
   * detail pane mid-animation, and the panel would blink instead of sliding.
   */
  const [lastFocused, setLastFocused] = useState<CalendarLesson | null>(null)

  const isCrowd = lessons.length > 1
  // Looked up rather than trusted: an id left over from a crowd that is no longer open
  // simply finds nothing, and the sheet falls back to the list it should be showing.
  const focused = isCrowd ? lessons.find((lesson) => lesson.id === focusedId) : lessons[0]
  const shown = focused ?? lastFocused

  const when = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  })
  const span = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  })

  const range = (lesson: CalendarLesson) =>
    span.formatRange(
      new Date(lesson.scheduledAt),
      new Date(new Date(lesson.scheduledAt).getTime() + lesson.durationMinutes * 60_000),
    )

  return (
    <Sheet
      open={lessons.length > 0}
      onOpenChange={(next) => {
        // Reset here rather than in an effect: closing is an event, and doing it on a
        // prop change would render twice for every crowd opened.
        if (!next) {
          setFocusedId(null)
          setLastFocused(null)
        }
        onOpenChange(next)
      }}
    >
      <SheetContent className="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b p-5">
          {/* Only when there is a list to go back to. Reached from a single mark, there is
              nothing behind this. */}
          {isCrowd && focused ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFocusedId(null)}
              className="text-muted-foreground -ml-2 h-7 w-fit gap-1.5 px-2"
            >
              <ArrowLeftIcon className="size-3.5" />
              {t.calendar.crowd.title}
            </Button>
          ) : null}

          {/* Keyed, so the heading fades between views rather than snapping while the
              panes underneath are still travelling. */}
          <div key={focused ? 'detail' : 'list'} className="animate-in fade-in-0 duration-200">
            <SheetTitle className="text-left text-base">
              {focused ? (focused.topic ?? t.lessons.noTopic) : t.calendar.crowd.title}
            </SheetTitle>
            <SheetDescription className="text-left text-xs">
              {focused
                ? `${when.format(new Date(focused.scheduledAt))} · ${range(focused)}`
                : t.calendar.crowd.description}
            </SheetDescription>
          </div>
        </SheetHeader>

        {/* Two panes on one track. Picking a lesson slides the track left and going back
            slides it right, which is what makes the panel read as pages rather than as a
            box whose contents were swapped underneath you. A single lesson has no list
            behind it, so it is shown alone with nothing to slide. */}
        {isCrowd ? (
          <div className="relative flex-1 overflow-hidden">
            <div
              className={cn(
                'flex h-full w-[200%] motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out',
                focused && '-translate-x-1/2',
              )}
            >
              <div
                // Nothing to reach in the pane that has left the frame.
                className={cn('w-1/2 overflow-y-auto p-5', focused && 'pointer-events-none')}
                aria-hidden={Boolean(focused)}
              >
                <CrowdList
                  lessons={lessons}
                  range={range}
                  t={t}
                  onPick={(lesson) => {
                    setLastFocused(lesson)
                    setFocusedId(lesson.id)
                  }}
                />
              </div>

              <div
                className={cn('w-1/2 overflow-y-auto p-5', !focused && 'pointer-events-none')}
                aria-hidden={!focused}
              >
                {shown ? (
                  <LessonDetail
                    lesson={shown}
                    t={t}
                    locale={locale}
                    canManage={!!editableTeacherId && shown.teacher?.id === editableTeacherId}
                  />
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5">
            {shown ? (
              <LessonDetail
                lesson={shown}
                t={t}
                locale={locale}
                initialAttendance={initialAttendance}
                canManage={!!editableTeacherId && shown.teacher?.id === editableTeacherId}
              />
            ) : null}
          </div>
        )}
        {focused &&
          onEdit &&
          focused.status === 'scheduled' &&
          focused.liveSession?.status !== 'active' &&
          focused.teacher?.id === editableTeacherId && (
            <div className="border-t p-5">
              <Button className="corner-brackets w-full" onClick={() => onEdit(focused)}>
                <PencilIcon />
                {t.calendar.edit.button}
              </Button>
            </div>
          )}
      </SheetContent>
    </Sheet>
  )
}

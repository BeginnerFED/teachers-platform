'use client'

import { CheckIcon, ChevronRightIcon, MinusIcon, UsersIcon, XIcon } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import type {
  AttendanceStatus,
  LinkedTeacher,
  PastTeacher,
  StudentDetail,
  StudentLesson,
  StudentLessons,
  StudentListItem,
} from '@tp/shared'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { AccountActions } from '@/features/accounts/components/account-actions'
import { linkStudent, loadTeacherOptions, unlinkStudent } from '@/features/roster/actions'
import { EndLinkButton } from '@/features/roster/components/end-link-button'
import { PickPersonDialog } from '@/features/roster/components/pick-person-dialog'
import { endedLinkToast, endLinkFailure, linkFailure } from '@/features/roster/wording'
import { formatDate, formatRelative, initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { loadStudentDetail } from '../actions'

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-muted/40 divide-border divide-y rounded-lg border', className)}>
      {children}
    </div>
  )
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3
      className={cn(
        'text-muted-foreground mb-2 text-[11px] font-medium uppercase tracking-widest',
        className,
      )}
    >
      {children}
    </h3>
  )
}

/**
 * The label never shrinks and the value never wraps: a Ukrainian label is half again as
 * long as its Turkish equivalent, and letting either of them reflow pushed every row in
 * the panel out of alignment with the next.
 */
function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="grid justify-items-end text-right">
        <span className="whitespace-nowrap tabular-nums">{value}</span>
        {/* A relative time, read from the clock: the server's minute and the browser's
            can differ by one, which is no reason to warn. */}
        {hint ? (
          <span className="text-muted-foreground text-xs" suppressHydrationWarning>
            {hint}
          </span>
        ) : null}
      </span>
    </div>
  )
}

/** The note beside a teacher differs by section — since when, or until when — so it is
 *  passed in already worded rather than worked out here. */
function TeacherRow({
  teacher,
  note,
  action,
}: {
  teacher: LinkedTeacher
  note: string
  /** Only a current teacher can be ended; a past one already was. */
  action?: React.ReactNode
}) {
  const name = teacher.fullName ?? teacher.email

  return (
    <div className="group/person flex items-center gap-3 px-3 py-2">
      <Avatar className="size-7 rounded-md">
        <AvatarFallback className="rounded-md text-[10px] font-medium">
          {initials(name)}
        </AvatarFallback>
      </Avatar>

      <div className="grid min-w-0 flex-1">
        <span className="truncate text-sm">{name}</span>
        <span className="text-muted-foreground truncate text-xs">{teacher.email}</span>
      </div>

      {/* For the current teacher the note is a relative time, so it can differ by a
          minute between the server and the browser. */}
      <span
        className="text-muted-foreground shrink-0 whitespace-nowrap text-xs"
        suppressHydrationWarning
      >
        {note}
      </span>

      {action}
    </div>
  )
}

/**
 * Attendance is the one thing on this panel an admin scans rather than reads, so it is a
 * mark before it is a word: a tick, a cross, a dash for the ones that were nobody's fault.
 */
const ATTENDANCE_MARK: Record<AttendanceStatus, { icon: typeof CheckIcon; className: string }> = {
  present: { icon: CheckIcon, className: 'bg-emerald-50 text-emerald-700' },
  absent: { icon: XIcon, className: 'bg-red-50 text-red-700' },
  excused: { icon: MinusIcon, className: 'bg-amber-50 text-amber-700' },
  expected: { icon: MinusIcon, className: 'bg-muted text-muted-foreground' },
}

function Tally({ lessons, t }: { lessons: StudentLessons; t: Messages }) {
  const { tally } = lessons

  const figures: { label: string; value: number; className?: string }[] = [
    { label: t.students.lessons.attended, value: tally.attended, className: 'text-emerald-700' },
    { label: t.students.lessons.missed, value: tally.missed, className: 'text-red-700' },
    { label: t.students.lessons.upcoming, value: tally.upcoming },
  ]

  return (
    <div className="bg-muted/40 grid grid-cols-3 gap-2 rounded-xl border p-4">
      {figures.map((figure) => (
        <div key={figure.label} className="grid gap-1">
          <span
            className={cn('text-2xl font-semibold tabular-nums leading-none', figure.className)}
          >
            {figure.value}
          </span>
          <span className="text-muted-foreground text-xs">{figure.label}</span>
        </div>
      ))}
    </div>
  )
}

function LessonRow({ lesson, t, locale }: { lesson: StudentLesson; t: Messages; locale: string }) {
  const mark = ATTENDANCE_MARK[lesson.attendance]
  const Icon = mark.icon

  // A cancelled session is not an absence, so it says so rather than wearing the mark of
  // one. Everything else is judged by whether this student was in the room.
  const canceled = lesson.status === 'canceled'

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full',
          canceled ? 'bg-muted text-muted-foreground' : mark.className,
        )}
      >
        <Icon className="size-3.5" />
      </span>

      <div className="grid min-w-0 flex-1">
        <span className={cn('truncate text-sm', canceled && 'text-muted-foreground line-through')}>
          {lesson.topic ?? t.lessons.noTopic}
        </span>
        <span className="text-muted-foreground truncate text-xs">
          {lesson.teacher ? (lesson.teacher.fullName ?? lesson.teacher.email) : '—'}
          {lesson.attendeeCount > 1 ? (
            <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle">
              <UsersIcon className="size-3" />
              {lesson.attendeeCount}
            </span>
          ) : null}
        </span>
      </div>

      <span className="grid shrink-0 justify-items-end text-right">
        <span className="whitespace-nowrap text-xs tabular-nums">
          {formatDate(lesson.scheduledAt, locale)}
        </span>
        <span className="text-muted-foreground whitespace-nowrap text-xs tabular-nums">
          {canceled ? t.lessons.status.canceled : `${lesson.durationMinutes} ${t.lessons.minutes}`}
        </span>
      </span>
    </div>
  )
}

export function StudentDetailSheet({
  student,
  t,
  locale,
}: {
  student: StudentListItem
  t: Messages
  locale: string
}) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<StudentDetail | null>(null)
  const [failed, setFailed] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selected = searchParams.get('person') === student.id

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    loadStudentDetail(student.id)
      .then((result) => {
        if (cancelled) return
        setFailed('error' in result)
        if ('data' in result) setDetail(result.data)
        setOpen(true)
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true)
          setOpen(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [selected, student.id])

  const name = student.fullName ?? student.email

  function load() {
    startTransition(async () => {
      const result = await loadStudentDetail(student.id)

      if ('error' in result) setFailed(true)
      else setDetail(result.data)
    })
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next && selected) {
      const params = new URLSearchParams(searchParams)
      params.delete('person')
      router.replace(`${pathname}?${params}`, { scroll: false })
    }
    if (!next) return

    // Refetched on each open rather than cached, so a relationship ended elsewhere shows
    // the next time the panel is looked at.
    setFailed(false)
    load()
  }

  /** After a link changes: the panel re-reads itself, and the row behind it re-renders. */
  async function change<Result extends { error: string | null }>(run: () => Promise<Result>) {
    const result = await run()

    // A pick refused because somebody placed the student first is a change as well, made
    // elsewhere: re-read, the panel names their teacher instead of offering to assign one.
    if (!result.error || result.error === 'student_has_teacher') {
      load()
      router.refresh()
    }

    return result
  }

  // The list already knows who currently teaches them, so the panel can show that much
  // before the request lands and only the history has to wait. One at most: a student
  // studies with one teacher at a time.
  const current: LinkedTeacher | undefined = (detail?.teachers ?? student.teachers)[0]
  const past: PastTeacher[] | null = detail?.pastTeachers ?? null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t.students.detail.open}
          // The explicit hover: repeats the row's colours, because the ghost variant
          // brings its own hover and would otherwise win when the cursor is on the button
          // itself — making it revert exactly as you reach for it.
          className="corner-brackets bg-muted text-muted-foreground group-hover/row:bg-primary group-hover/row:text-primary-foreground hover:bg-primary hover:text-primary-foreground size-8 transition-colors duration-150"
        >
          <ChevronRightIcon />
        </Button>
      </SheetTrigger>

      <SheetContent
        // The whole width on a phone, like the teacher's panel: at the sheet's own three
        // quarters, the teacher's name in its row was squeezed to a few letters.
        className="flex flex-col gap-0 p-0 outline-none data-[side=right]:w-full sm:max-w-md"
        // The panel takes focus itself rather than its first control. With a teacher in it,
        // that control is the × that ends their studies: hidden until the row is hovered,
        // and one key away from the question that ends them. Tab goes on from here in order.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus()
        }}
      >
        <SheetHeader className="border-b p-5">
          <div className="flex items-center gap-3">
            <Avatar className="size-11 rounded-xl">
              <AvatarFallback className="rounded-xl text-sm font-medium">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 gap-0.5">
              <SheetTitle className="truncate text-left text-base">{name}</SheetTitle>
              <SheetDescription className="truncate text-left text-xs">
                {student.email}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
          {/* First, because "how much teaching has actually happened" is the question this
              panel exists to answer. The numbers cover the whole history; the list under
              them is capped. */}
          <div>
            <SectionTitle>{t.students.lessons.title}</SectionTitle>

            {failed ? (
              <p className="text-destructive text-sm">{t.students.detail.loadFailed}</p>
            ) : !detail ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-lg" />
              </div>
            ) : detail.lessons.items.length === 0 ? (
              <Panel>
                <div className="text-muted-foreground px-3 py-3 text-sm">
                  {t.students.lessons.none}
                </div>
              </Panel>
            ) : (
              <div className="flex flex-col gap-3">
                <Tally lessons={detail.lessons} t={t} />

                {/* Its own scroll area, so two years of weekly lessons do not push the
                    teachers off the bottom of the panel. */}
                <Panel className="max-h-80 overflow-y-auto">
                  {detail.lessons.items.map((lesson) => (
                    <LessonRow key={lesson.id} lesson={lesson} t={t} locale={locale} />
                  ))}
                </Panel>
              </div>
            )}
          </div>

          <div>
            {/* The action sits on the section's own line, the way a page keeps its action
                beside its heading. Offered only while nobody teaches them: another teacher
                takes ending this one first, which cancels what was planned with them. The
                line keeps its height either way, so ending a link does not shift it. */}
            <div className="mb-2 flex min-h-7 items-center justify-between gap-3">
              <SectionTitle className="mb-0">{t.students.detail.teacher}</SectionTitle>

              {current ? null : (
                <PickPersonDialog
                  label={t.students.detail.assignTeacher}
                  title={t.students.detail.pickTeacher.title}
                  description={t.students.detail.pickTeacher.description}
                  searchPlaceholder={t.students.detail.pickTeacher.search}
                  emptyMessage={t.students.detail.pickTeacher.empty}
                  exclude={[]}
                  load={loadTeacherOptions}
                  onPick={(teacherId) => change(() => linkStudent(teacherId, student.id))}
                  success={t.students.detail.linked}
                  failure={t.errors.internal}
                  explainFailure={(result) => linkFailure(result, t)}
                />
              )}
            </div>

            <Panel>
              {current ? (
                <TeacherRow
                  teacher={current}
                  note={formatRelative(current.since, locale)}
                  action={
                    <EndLinkButton
                      label={t.students.detail.endLink}
                      confirm={t.students.detail.endConfirm}
                      onEnd={() => change(() => unlinkStudent(current.id, student.id))}
                      success={(ended) => endedLinkToast(ended, t)}
                      failure={(error) => endLinkFailure(error, t)}
                    />
                  }
                />
              ) : (
                <div className="text-muted-foreground px-3 py-3 text-sm">
                  {t.students.detail.noTeachers}
                </div>
              )}
            </Panel>
          </div>

          <div>
            <SectionTitle>{t.students.detail.account}</SectionTitle>
            <Panel>
              <Row
                label={t.students.detail.joined}
                value={formatDate(student.createdAt, locale)}
                hint={formatRelative(student.createdAt, locale)}
              />
            </Panel>

            {/* Under the facts about the account, the two things you can do to it. */}
            <div className="mt-2">
              <AccountActions
                account={{ id: student.id, email: student.email, fullName: student.fullName }}
                onChanged={() => {
                  load()
                  router.refresh()
                }}
                t={t}
              />
            </div>
          </div>

          <div>
            <SectionTitle>{t.students.detail.past}</SectionTitle>

            {failed ? (
              <p className="text-destructive text-sm">{t.students.detail.loadFailed}</p>
            ) : past === null ? (
              <Skeleton className="h-20 w-full rounded-lg" />
            ) : past.length === 0 ? (
              <Panel>
                <div className="text-muted-foreground px-3 py-3 text-sm">
                  {t.students.detail.noPast}
                </div>
              </Panel>
            ) : (
              <Panel className="max-h-72 overflow-y-auto">
                {past.map((teacher) => (
                  <TeacherRow
                    key={teacher.id}
                    teacher={teacher}
                    note={`${t.students.detail.until} ${formatDate(teacher.until, locale)}`}
                  />
                ))}
              </Panel>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

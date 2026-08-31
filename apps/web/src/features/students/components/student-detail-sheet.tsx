'use client'

import { ChevronRightIcon } from 'lucide-react'
import { useState, useTransition } from 'react'
import type { LinkedTeacher, PastTeacher, StudentDetail, StudentListItem } from '@tp/shared'
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-muted-foreground mb-2 text-[11px] font-medium tracking-widest uppercase">
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
        <span className="tabular-nums whitespace-nowrap">{value}</span>
        {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
      </span>
    </div>
  )
}

/** The note beside a teacher differs by section — since when, or until when — so it is
 *  passed in already worded rather than worked out here. */
function TeacherRow({ teacher, note }: { teacher: LinkedTeacher; note: string }) {
  const name = teacher.fullName ?? teacher.email

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <Avatar className="size-7 rounded-md">
        <AvatarFallback className="rounded-md text-[10px] font-medium">
          {initials(name)}
        </AvatarFallback>
      </Avatar>

      <div className="grid min-w-0 flex-1">
        <span className="truncate text-sm">{name}</span>
        <span className="text-muted-foreground truncate text-xs">{teacher.email}</span>
      </div>

      <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">{note}</span>
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

  const name = student.fullName ?? student.email

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) return

    // Refetched on each open rather than cached, so a relationship ended elsewhere shows
    // the next time the panel is looked at.
    setFailed(false)

    startTransition(async () => {
      const result = await loadStudentDetail(student.id)

      if ('error' in result) setFailed(true)
      else setDetail(result.data)
    })
  }

  // The list already knows who currently teaches them, so the panel can show that much
  // before the request lands and only the history has to wait.
  const current: LinkedTeacher[] = detail?.teachers ?? student.teachers
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

      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
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
          <div>
            <SectionTitle>
              {t.students.detail.teachers}
              {current.length > 1 ? (
                <span className="text-muted-foreground ml-1.5 tabular-nums normal-case">
                  ({current.length})
                </span>
              ) : null}
            </SectionTitle>

            {current.length === 0 ? (
              <Panel>
                <div className="text-muted-foreground px-3 py-3 text-sm">
                  {t.students.detail.noTeachers}
                </div>
              </Panel>
            ) : (
              <Panel>
                {current.map((teacher) => (
                  <TeacherRow
                    key={teacher.id}
                    teacher={teacher}
                    note={formatRelative(teacher.since, locale)}
                  />
                ))}
              </Panel>
            )}
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

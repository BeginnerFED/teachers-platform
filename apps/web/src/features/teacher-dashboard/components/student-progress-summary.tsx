import Link from 'next/link'
import {
  AlertTriangleIcon,
  ArrowUpRightIcon,
  CalendarCheck2Icon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  Clock3Icon,
} from 'lucide-react'
import type { LessonCreditSummary } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/features/homework/components/status-badge'
import { formatDate } from '@/lib/format'
import type { Messages } from '@/messages'
import type { StudentProgressSummary as StudentProgressData } from '../actions'

export function activityCounts(history: LessonCreditSummary['history']) {
  return history.reduce(
    (counts, lesson) => {
      if (lesson.status === 'scheduled') counts.planned++
      if (lesson.status !== 'held') return counts

      if (lesson.attendance === 'present') counts.attended++
      if (lesson.attendance === 'absent') counts.missed++
      if (lesson.attendance === 'excused') counts.excused++
      if (lesson.attendance === 'expected') counts.pending++
      return counts
    },
    { attended: 0, missed: 0, excused: 0, planned: 0, pending: 0 },
  )
}

export function StudentProgressSummary({
  summary,
  studentId,
  locale,
  t,
}: {
  summary: StudentProgressData
  studentId: string
  locale: string
  t: Messages
}) {
  const copy = t.teacherHome.students.progress
  const activity = activityCounts(summary.credits.history)
  const configured = summary.credits.granted > 0 || summary.credits.used > 0
  const attention = [
    summary.homework.submitted > 0
      ? copy.needsReview.replace('{count}', String(summary.homework.submitted))
      : null,
    summary.homework.overdue > 0
      ? copy.overdue.replace('{count}', String(summary.homework.overdue))
      : null,
    configured && summary.credits.remaining <= 2
      ? copy.lowCredits.replace('{count}', String(summary.credits.remaining))
      : null,
    activity.pending > 0
      ? copy.attendancePending.replace('{count}', String(activity.pending))
      : null,
  ].filter((item): item is string => item !== null)

  return (
    <div className="space-y-5 px-1 pb-4">
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangleIcon className="text-muted-foreground size-4" />
          {copy.attention}
        </h3>
        {attention.length ? (
          <ul className="divide-border/60 bg-muted/20 divide-y rounded-xl border px-3">
            {attention.map((item) => (
              <li key={item} className="py-2.5 text-xs leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground rounded-xl border border-dashed px-3 py-3 text-xs">
            {copy.allClear}
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <CalendarCheck2Icon className="text-muted-foreground size-4" />
          {copy.lessons}
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: copy.attended, value: activity.attended },
            { label: copy.missed, value: activity.missed },
            { label: copy.excused, value: activity.excused },
            { label: copy.planned, value: activity.planned },
          ].map((item) => (
            <Fact key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <ClipboardCheckIcon className="text-muted-foreground size-4" />
          {copy.homework}
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <Fact label={copy.open} value={summary.homework.assigned} />
          <Fact label={copy.waiting} value={summary.homework.submitted} />
          <Fact label={copy.completed} value={summary.homework.graded} />
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <ClipboardListIcon className="text-muted-foreground size-4" />
            {copy.recentHomework}
          </h3>
        </div>

        {summary.recentHomework.length ? (
          <ul className="divide-border/60 divide-y rounded-xl border">
            {summary.recentHomework.map((assignment) => (
              <li key={assignment.id}>
                <Link
                  href={`/homework/${assignment.id}`}
                  className="hover:bg-muted/40 focus-visible:ring-ring group flex items-center gap-3 px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {assignment.material.title}
                    </span>
                    <span className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 text-[11px] tabular-nums">
                      {assignment.dueAt ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock3Icon className="size-3" />
                          {formatDate(assignment.dueAt, locale)}
                        </span>
                      ) : null}
                      {assignment.status === 'assigned' && assignment.progress.total > 0 ? (
                        <span>
                          {assignment.progress.checked}/{assignment.progress.total} {copy.steps}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <StatusBadge
                    status={assignment.status}
                    revisionRequested={Boolean(assignment.revisionRequestedAt)}
                    t={t}
                    className="shrink-0"
                  />
                  <ArrowUpRightIcon className="text-muted-foreground group-hover:text-primary size-3.5 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground rounded-xl border border-dashed px-3 py-4 text-xs">
            {copy.noHomework}
          </p>
        )}

        {summary.recentHomework.length ? (
          <Button asChild variant="ghost" size="sm" className="corner-brackets w-full">
            <Link href={`/homework?studentId=${encodeURIComponent(studentId)}`}>
              {copy.openHomework}
              <ArrowUpRightIcon />
            </Link>
          </Button>
        ) : null}
      </section>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/30 rounded-lg border px-3 py-2.5">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground mt-0.5 text-[10px] leading-tight">{label}</p>
    </div>
  )
}

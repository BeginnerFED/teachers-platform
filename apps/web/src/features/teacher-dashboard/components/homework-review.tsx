import Link from 'next/link'
import {
  ArrowUpRightIcon,
  CheckCheckIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
} from 'lucide-react'
import { PLATFORM_TIME_ZONE, type AssignmentListItem, type PageMeta } from '@tp/shared'
import { RefreshDashboard } from '@/features/admin-dashboard/components/refresh-dashboard'
import type { Messages } from '@/messages'

export function HomeworkReview({
  result,
  t,
  locale,
}: {
  result: { data: AssignmentListItem[]; meta: PageMeta } | null
  t: Messages
  locale: string
}) {
  const date = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: PLATFORM_TIME_ZONE,
  })
  return (
    <section
      className="bg-card flex min-w-0 flex-col overflow-hidden rounded-xl border"
      aria-labelledby="homework-review-heading"
    >
      <div className="flex items-center justify-between gap-3 border-b p-5">
        <div>
          <h2 id="homework-review-heading" className="text-sm font-semibold">
            {t.teacherHome.review}
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">{t.teacherHome.reviewHint}</p>
        </div>
        <ClipboardCheckIcon className="text-muted-foreground size-4 shrink-0" />
      </div>
      {!result ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-5 text-center">
          <p className="text-muted-foreground text-sm">{t.teacherHome.reviewFailed}</p>
          <RefreshDashboard label={t.common.retry} />
        </div>
      ) : !result.data.length ? (
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-12 text-center">
          <CheckCheckIcon className="text-muted-foreground/50 mb-3 size-7" />
          <p className="text-sm font-medium">{t.teacherHome.noReview}</p>
          <p className="text-muted-foreground mt-1 text-xs">{t.teacherHome.noReviewHint}</p>
        </div>
      ) : (
        <ul className="flex-1 divide-y">
          {result.data.map((assignment) => (
            <li key={assignment.id}>
              <Link
                href={`/homework/${assignment.id}`}
                className="hover:bg-muted/40 focus-visible:ring-ring group flex items-center gap-3 px-5 py-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
              >
                <span className="bg-muted/40 flex size-9 shrink-0 items-center justify-center rounded-xl border text-xs font-medium">
                  {(assignment.student.fullName || assignment.student.email)
                    .slice(0, 1)
                    .toLocaleUpperCase(locale)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {assignment.student.fullName || assignment.student.email}
                  </span>
                  <span className="text-muted-foreground mt-1 block truncate text-xs">
                    {assignment.material.title}
                  </span>
                  {assignment.submittedAt && (
                    <span className="text-muted-foreground mt-1 block text-[11px]">
                      {t.teacherHome.submitted} · {date.format(new Date(assignment.submittedAt))}
                    </span>
                  )}
                </span>
                <ChevronRightIcon className="text-muted-foreground group-hover:text-primary size-4 shrink-0" />
                <span className="sr-only">{t.teacherHome.reviewAction}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="bg-muted/20 flex items-center justify-between gap-3 border-t px-5 py-3 text-xs">
        <span className="text-muted-foreground">
          {result &&
            t.adminHome.showing
              .replace('{shown}', String(result.data.length))
              .replace('{total}', String(result.meta.total))}
        </span>
        <Link
          href="/homework?status=submitted"
          className="corner-brackets hover:text-primary inline-flex items-center gap-1.5 rounded-sm font-medium transition-colors"
        >
          {t.adminHome.viewAll}
          <ArrowUpRightIcon className="size-3.5" />
        </Link>
      </div>
    </section>
  )
}

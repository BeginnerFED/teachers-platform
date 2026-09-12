import Link from 'next/link'
import { ArrowRightIcon } from 'lucide-react'
import type { AssignmentListItem } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import type { Messages } from '@/messages'
import { awaitingTeacher, totalScore } from './score'
import { StatusBadge } from './status-badge'

/**
 * A student's homework, as rows rather than a table: on a phone, which is where a student
 * lives, a row with a button beats six columns. Each says what, from whom, by when, and
 * where you are with it.
 */
export function StudentHomeworkList({
  items,
  t,
  locale,
  empty,
}: {
  items: AssignmentListItem[]
  t: Messages
  locale: string
  empty?: string
}) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground mx-auto max-w-md p-12 text-center text-sm">
        {empty ?? t.homework.studentEmpty}
      </p>
    )
  }

  return (
    <ul className="divide-y">
      {items.map((item) => {
        const score = totalScore(item)
        const action =
          item.status !== 'assigned'
            ? t.homework.review
            : item.progress.checked > 0
              ? t.homework.continue
              : t.homework.start

        return (
          <li
            key={item.id}
            className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="flex w-full min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/student/homework/${item.id}`}
                  className="break-words font-medium hover:underline"
                >
                  {item.material.title}
                </Link>
                <StatusBadge status={item.status} t={t} />
              </div>

              <p className="text-muted-foreground flex flex-wrap gap-x-3 text-xs tabular-nums">
                <span>
                  {t.homework.teacher}: {item.teacher.fullName ?? item.teacher.email}
                </span>
                <span>
                  {t.homework.dueAt}:{' '}
                  {item.dueAt ? formatDate(item.dueAt, locale) : t.homework.noDue}
                </span>
                {item.status === 'assigned' ? (
                  <span>
                    {item.progress.checked}/{item.progress.total} {t.homework.stepsChecked}
                  </span>
                ) : score ? (
                  <span>
                    {score.score} / {score.max} {t.homework.points}
                    {awaitingTeacher(item) ? ` · ${t.homework.awaitingTeacher}` : ''}
                  </span>
                ) : null}
              </p>

              {item.note ? <p className="break-words text-sm">{item.note}</p> : null}
            </div>

            <Button
              asChild
              size="sm"
              variant={item.status === 'assigned' ? 'default' : 'outline'}
              className="corner-brackets self-end sm:self-center"
            >
              <Link href={`/student/homework/${item.id}`}>
                {action}
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          </li>
        )
      })}
    </ul>
  )
}

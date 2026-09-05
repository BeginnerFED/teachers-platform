import Link from 'next/link'
import { ClipboardListIcon } from 'lucide-react'
import type { AssignmentListItem } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { counted, formatDate, formatRelative } from '@/lib/format'
import type { Messages } from '@/messages'
import { HomeworkRowMenu } from './homework-row-menu'
import { awaitingTeacher, isOverdue, totalScore } from './score'
import { StatusBadge, StatusDot } from './status-badge'

/** Rows after the eighth arrive together; a long list should land, not trickle. */
const STAGGER_CAP = 8
const STAGGER_MS = 35

/**
 * The desk: every piece of homework, newest first, one row each. A row is one thing —
 * a dot for where it is, who and what in bold, one plain sentence of when and how far,
 * a chip, and a quiet menu at the far end. The whole row opens the student's work.
 */
export function HomeworkList({
  items,
  viewerId,
  isAdmin,
  locale,
  empty,
  t,
}: {
  items: AssignmentListItem[]
  /** Whose desk this is: only the teacher who set a piece may take it back. */
  viewerId: string
  /** Names who set each piece; on a teacher's own desk that would be their own name. */
  isAdmin: boolean
  locale: string
  /** Chosen by the page from what it was asked for. */
  empty: { title: string; hint?: string; link?: { href: string; label: string } }
  t: Messages
}) {
  if (items.length === 0) {
    return (
      <div className="border-border/60 bg-card flex flex-col items-center gap-3 rounded-2xl border px-6 py-14 text-center">
        <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
          <ClipboardListIcon className="size-4" />
        </span>

        <div className="space-y-1">
          <p className="text-sm font-medium">{empty.title}</p>
          {empty.hint ? <p className="text-muted-foreground text-sm">{empty.hint}</p> : null}
        </div>

        {empty.link ? (
          <Button asChild variant="ghost" className="text-muted-foreground">
            <Link href={empty.link.href}>{empty.link.label}</Link>
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="border-border/60 bg-card divide-border/60 divide-y rounded-2xl border">
        {items.map((item, index) => {
          const student = item.student.fullName ?? item.student.email
          const late = isOverdue(item)

          return (
            <li
              key={item.id}
              style={{ animationDelay: `${Math.min(index, STAGGER_CAP) * STAGGER_MS}ms` }}
              className="group/row hover:bg-muted/40 animate-rise-in relative flex items-center gap-3 px-4 py-3.5 transition-colors first:rounded-t-[inherit] last:rounded-b-[inherit] motion-reduce:animate-none"
            >
              <StatusDot status={item.status} late={late} />

              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-baseline gap-1.5 text-sm">
                  {/* The whole row is the link, via the overlay — the anchor sits on the
                      student's name, so that is what a screen reader announces. */}
                  <Link
                    href={`/homework/${item.id}`}
                    className="shrink-0 font-medium before:absolute before:inset-0 before:content-['']"
                  >
                    {student}
                  </Link>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground truncate">{item.material.title}</span>
                </p>

                <p className="text-muted-foreground truncate text-xs tabular-nums">
                  {describe(item, { late, isAdmin, locale, t })}
                </p>
              </div>

              <StatusBadge status={item.status} late={late} t={t} className="max-sm:hidden" />

              <HomeworkRowMenu
                assignmentId={item.id}
                canWithdraw={item.status === 'assigned' && item.teacher.id === viewerId}
                t={t}
              />
            </li>
          )
        })}
      </ul>

      <p className="text-muted-foreground px-1 text-xs">{t.homework.footnote}</p>
    </div>
  )
}

/**
 * One sentence about a row: who set it (on the administrator's desk), when, what is due
 * or what came in, and how far along or how well it went. Separated by dots rather than
 * laid out in columns — read, not scanned.
 */
function describe(
  item: AssignmentListItem,
  { late, isAdmin, locale, t }: { late: boolean; isAdmin: boolean; locale: string; t: Messages },
): string {
  const parts: string[] = []

  if (isAdmin) parts.push(item.teacher.fullName ?? item.teacher.email)

  if (item.status === 'assigned') {
    parts.push(`${t.homework.givenOn} ${formatRelative(item.createdAt, locale)}`)

    if (item.dueAt && late) {
      parts.push(`${t.homework.row.overdueSince} ${formatRelative(item.dueAt, locale)}`)
    } else if (item.dueAt) {
      parts.push(
        `${t.homework.dueShort} ${formatDate(item.dueAt, locale)} (${formatRelative(item.dueAt, locale)})`,
      )
    } else {
      parts.push(t.homework.noDue)
    }

    if (item.progress.total > 0) {
      parts.push(
        `${item.progress.checked} ${t.homework.row.of} ${counted(item.progress.total, t.homework.units.steps, locale)}`,
      )
    }

    return parts.join(' · ')
  }

  const score = totalScore(item)

  if (item.status === 'submitted') {
    parts.push(
      `${t.homework.submittedOn} ${formatRelative(item.submittedAt ?? item.updatedAt, locale)}`,
    )
  } else {
    parts.push(`${t.homework.gradedOn} ${formatRelative(item.gradedAt ?? item.updatedAt, locale)}`)
  }

  if (score) {
    parts.push(
      `${score.score} ${t.homework.row.of} ${counted(score.max, t.homework.units.points, locale)}`,
    )
  }

  if (awaitingTeacher(item)) parts.push(t.homework.awaitingTeacher)

  return parts.join(' · ')
}

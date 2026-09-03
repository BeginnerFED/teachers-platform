import Link from 'next/link'
import { ChevronRightIcon } from 'lucide-react'
import type { AssignmentListItem } from '@tp/shared'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/lib/format'
import type { Messages } from '@/messages'
import { awaitingTeacher, totalScore } from './score'
import { StatusBadge } from './status-badge'

const HEAD = 'text-foreground h-11 font-semibold'

/**
 * The teacher's desk: every piece of homework they set, newest first, with where it is and
 * what it scored. Each row opens the student's work.
 */
export function HomeworkTable({
  items,
  t,
  locale,
}: {
  items: AssignmentListItem[]
  t: Messages
  locale: string
}) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground mx-auto max-w-md p-12 text-center text-sm">
        {t.homework.empty}
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          <TableHead className={HEAD}>{t.homework.columns.student}</TableHead>
          <TableHead className={HEAD}>{t.homework.columns.lesson}</TableHead>
          <TableHead className={HEAD}>{t.homework.columns.status}</TableHead>
          <TableHead className={`${HEAD} text-right`}>{t.homework.columns.score}</TableHead>
          <TableHead className={`${HEAD} max-md:hidden`}>{t.homework.columns.due}</TableHead>
          <TableHead className={`${HEAD} max-md:hidden`}>{t.homework.columns.given}</TableHead>
          <TableHead className="w-12">
            <span className="sr-only">{t.homework.open}</span>
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {items.map((item) => {
          const score = totalScore(item)

          return (
            <TableRow key={item.id} className="group/row">
              <TableCell>
                <Link href={`/homework/${item.id}`} className="flex flex-col hover:underline">
                  <span className="font-medium">{item.student.fullName ?? item.student.email}</span>
                  {item.student.fullName ? (
                    <span className="text-muted-foreground text-xs">{item.student.email}</span>
                  ) : null}
                </Link>
              </TableCell>

              <TableCell>
                <span className="flex flex-col">
                  <span className="line-clamp-1">{item.material.title}</span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {item.material.level}
                  </span>
                </span>
              </TableCell>

              <TableCell>
                <span className="flex flex-col items-start gap-1">
                  <StatusBadge status={item.status} t={t} />
                  {item.status === 'assigned' ? (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {item.progress.checked}/{item.progress.total} {t.homework.stepsChecked}
                    </span>
                  ) : null}
                </span>
              </TableCell>

              <TableCell className="text-right tabular-nums">
                {score ? (
                  <span className="flex flex-col items-end">
                    <span>
                      {score.score} / {score.max}
                    </span>
                    {awaitingTeacher(item) ? (
                      <span className="text-muted-foreground text-xs">
                        {t.homework.awaitingTeacher}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>

              <TableCell className="text-muted-foreground text-sm max-md:hidden">
                {item.dueAt ? formatDate(item.dueAt, locale) : t.homework.noDue}
              </TableCell>

              <TableCell className="text-muted-foreground text-sm max-md:hidden">
                {formatDate(item.createdAt, locale)}
              </TableCell>

              <TableCell>
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground size-7 opacity-60 group-hover/row:opacity-100"
                >
                  <Link href={`/homework/${item.id}`} aria-label={t.homework.open}>
                    <ChevronRightIcon className="size-4" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

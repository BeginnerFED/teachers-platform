import { UsersIcon } from 'lucide-react'
import type { TeacherListItem } from '@tp/shared'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatJoinedAt, formatRelative, initials } from '@/lib/format'
import type { Messages } from '@/messages'
import { remainingLabel } from '../format'
import { SubscriptionBadge } from './subscription-badge'
import { TeacherDetailSheet } from './teacher-detail-sheet'

const HEAD = 'text-foreground h-11 font-semibold'

export function TeacherTable({
  teachers,
  t,
  locale,
  filtering = false,
}: {
  teachers: TeacherListItem[]
  t: Messages
  locale: string
  /** Distinguishes "nobody has signed up" from "your filter matched nothing". */
  filtering?: boolean
}) {
  if (teachers.length === 0) {
    return (
      <div className="p-10 text-center">
        <p className="text-muted-foreground text-sm">
          {filtering ? t.teachers.noResults : t.teachers.empty}
        </p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        {/* A tinted band with weightier labels, so the header reads as the frame of the
            table rather than as a first row that happens to contain words. */}
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          <TableHead className={HEAD}>{t.teachers.columns.name}</TableHead>
          <TableHead className={HEAD}>{t.teachers.columns.status}</TableHead>
          <TableHead className={HEAD}>{t.teachers.columns.remaining}</TableHead>
          <TableHead className={HEAD}>{t.teachers.columns.students}</TableHead>
          <TableHead className={HEAD}>{t.teachers.columns.joined}</TableHead>
          <TableHead className="w-12">
            <span className="sr-only">{t.teachers.columns.actions}</span>
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {teachers.map((teacher) => {
          const name = teacher.fullName ?? teacher.email

          return (
            // group/row lets the chevron respond to the whole row being hovered, so the
            // affordance is the row rather than an eight-pixel target at the end of it.
            <TableRow key={teacher.id} className="group/row">
              {/* Name and address share a cell: they identify one person, and splitting
                  them across columns spread the row wider than the screen. */}
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg text-xs font-medium">
                      {initials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid min-w-0">
                    <span className="truncate font-medium">{name}</span>
                    <span className="text-muted-foreground truncate text-xs">{teacher.email}</span>
                  </div>
                </div>
              </TableCell>

              <TableCell>
                <SubscriptionBadge subscription={teacher.subscription} t={t} />
              </TableCell>

              <TableCell
                // Someone who cannot work right now should be readable at a glance,
                // whether that is because time ran out or because it was switched off.
                className={
                  teacher.subscription && !teacher.subscription.hasAccess
                    ? 'text-destructive tabular-nums'
                    : 'tabular-nums'
                }
              >
                {remainingLabel(teacher.subscription, t)}
              </TableCell>

              <TableCell>
                <span
                  className={
                    teacher.studentCount === 0
                      ? 'text-muted-foreground flex items-center gap-1.5 tabular-nums'
                      : 'flex items-center gap-1.5 tabular-nums'
                  }
                >
                  <UsersIcon className="size-3.5 opacity-60" />
                  {teacher.studentCount}
                </span>
              </TableCell>

              <TableCell className="text-muted-foreground">
                <div className="grid">
                  <span className="tabular-nums">{formatJoinedAt(teacher.createdAt, locale)}</span>
                  <span className="text-xs">{formatRelative(teacher.createdAt, locale)}</span>
                </div>
              </TableCell>

              <TableCell className="text-right">
                <TeacherDetailSheet teacher={teacher} t={t} locale={locale} />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

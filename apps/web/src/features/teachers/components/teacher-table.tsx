import type { TeacherListItem } from '@tp/shared'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Messages } from '@/messages'
import { formatJoinedAt, remainingLabel } from '../format'
import { SubscriptionBadge } from './subscription-badge'
import { TeacherRowActions } from './teacher-row-actions'

export function TeacherTable({
  teachers,
  t,
  locale,
}: {
  teachers: TeacherListItem[]
  t: Messages
  locale: string
}) {
  if (teachers.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground text-sm">{t.teachers.empty}</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.teachers.columns.name}</TableHead>
            <TableHead>{t.teachers.columns.email}</TableHead>
            <TableHead>{t.teachers.columns.status}</TableHead>
            <TableHead>{t.teachers.columns.remaining}</TableHead>
            <TableHead>{t.teachers.columns.joined}</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">{t.teachers.columns.actions}</span>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {teachers.map((teacher) => (
            <TableRow key={teacher.id}>
              <TableCell className="font-medium">{teacher.fullName ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">{teacher.email}</TableCell>
              <TableCell>
                <SubscriptionBadge subscription={teacher.subscription} t={t} />
              </TableCell>
              <TableCell
                // Someone who cannot work right now should be readable at a glance,
                // whether that is because time ran out or because it was switched off.
                className={
                  teacher.subscription && !teacher.subscription.hasAccess
                    ? 'text-destructive'
                    : undefined
                }
              >
                {remainingLabel(teacher.subscription, t)}
              </TableCell>
              <TableCell className="text-muted-foreground tabular-nums">
                {formatJoinedAt(teacher.createdAt, locale)}
              </TableCell>
              <TableCell>
                <TeacherRowActions teacher={teacher} t={t} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

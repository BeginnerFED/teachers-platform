import { GraduationCapIcon } from 'lucide-react'
import type { StudentListItem } from '@tp/shared'
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
import { StudentDetailSheet } from './student-detail-sheet'

const HEAD = 'text-foreground h-11 font-semibold'

export function StudentTable({
  students,
  t,
  locale,
  filtering = false,
}: {
  students: StudentListItem[]
  t: Messages
  locale: string
  /** Distinguishes "nobody has signed up" from "your filter matched nothing". */
  filtering?: boolean
}) {
  if (students.length === 0) {
    return (
      <div className="p-10 text-center">
        <p className="text-muted-foreground text-sm">
          {filtering ? t.students.noResults : t.students.empty}
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
          <TableHead className={HEAD}>{t.students.columns.name}</TableHead>
          <TableHead className={HEAD}>{t.students.columns.teacher}</TableHead>
          <TableHead className={HEAD}>{t.students.columns.lessons}</TableHead>
          <TableHead className={HEAD}>{t.students.columns.joined}</TableHead>
          <TableHead className="w-12">
            <span className="sr-only">{t.students.columns.actions}</span>
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {students.map((student) => {
          const name = student.fullName ?? student.email
          const [first, ...rest] = student.teachers

          return (
            // group/row lets the chevron respond to the whole row being hovered, so the
            // affordance is the row rather than an eight-pixel target at the end of it.
            <TableRow key={student.id} className="group/row">
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
                    <span className="text-muted-foreground truncate text-xs">{student.email}</span>
                  </div>
                </div>
              </TableCell>

              <TableCell>
                {/* A student nobody teaches is the reason an admin opens this page, so it
                    is said in words rather than left as an empty cell. */}
                {first ? (
                  <div className="grid min-w-0">
                    <span className="truncate">{first.fullName ?? first.email}</span>
                    {rest.length > 0 ? (
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {t.students.andMore} {rest.length}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-muted-foreground">{t.students.noTeacher}</span>
                )}
              </TableCell>

              <TableCell>
                {/* Lessons they were actually in. A student on the books who has never
                    turned up is the other thing this page is for noticing. */}
                <span
                  className={
                    student.lessonsAttended === 0
                      ? 'text-muted-foreground flex items-center gap-1.5 tabular-nums'
                      : 'flex items-center gap-1.5 tabular-nums'
                  }
                >
                  <GraduationCapIcon className="size-3.5 opacity-60" />
                  {student.lessonsAttended}
                </span>
              </TableCell>

              <TableCell className="text-muted-foreground">
                <div className="grid">
                  <span className="tabular-nums">{formatJoinedAt(student.createdAt, locale)}</span>
                  <span className="text-xs">{formatRelative(student.createdAt, locale)}</span>
                </div>
              </TableCell>

              <TableCell className="text-right">
                <StudentDetailSheet student={student} t={t} locale={locale} />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

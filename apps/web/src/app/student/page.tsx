import Link from 'next/link'
import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  Clock3Icon,
} from 'lucide-react'
import { listAssignmentsQuery } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { listAssignments, summariseAssignments } from '@/features/homework/api'
import { StudentLiveBanner } from '@/features/live/components/student-live-notifications'
import { StudentHomeworkList } from '@/features/homework/components/student-homework-list'
import { studentTeachers, upcomingStudentLessons } from '@/features/student-dashboard/api'
import { StudyLessons } from '@/features/student-dashboard/components/study-lessons'
import {
  StudyEmpty,
  StudyError,
  StudyPanel,
} from '@/features/student-dashboard/components/study-panel'
import { StudyTeachers } from '@/features/student-dashboard/components/study-teachers'
import { requireRole } from '@/lib/auth'
import { getMessages } from '@/messages/server'

export default async function StudentPage() {
  const [viewer, t] = await Promise.all([requireRole('student'), getMessages()])
  const [upcoming, homework, totals, teachers] = await Promise.allSettled([
    upcomingStudentLessons(),
    listAssignments(listAssignmentsQuery.parse({ status: 'assigned', perPage: 5 })),
    summariseAssignments({}),
    studentTeachers(),
  ])
  const summary = totals.status === 'fulfilled' ? totals.value : null
  const now = new Date().getTime()
  const stats = [
    {
      key: 'assigned',
      label: t.studentHome.openHomework,
      hint: t.studentHome.openHomeworkHint,
      icon: ClipboardListIcon,
    },
    {
      key: 'submitted',
      label: t.studentHome.submitted,
      hint: t.studentHome.submittedHint,
      icon: Clock3Icon,
    },
    {
      key: 'graded',
      label: t.studentHome.graded,
      hint: t.studentHome.gradedHint,
      icon: ClipboardCheckIcon,
    },
  ] as const
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.studentHome.title}</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">{t.studentHome.description}</p>
        </div>
        <Button asChild className="corner-brackets">
          <Link href="/student/calendar">
            <CalendarDaysIcon />
            {t.studentHome.calendar}
          </Link>
        </Button>
      </div>
      <StudentLiveBanner />
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map(({ key, label, hint, icon: Icon }) => (
          <Link
            key={key}
            href={`/student/homework?status=${key}`}
            className="bg-card hover:border-primary/30 focus-visible:ring-ring group min-w-0 rounded-xl border p-5 transition-colors focus-visible:outline-none focus-visible:ring-2"
          >
            <div className="text-muted-foreground flex items-center justify-between gap-2">
              <span className="text-xs font-medium">{label}</span>
              <Icon className="size-4 shrink-0" />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-3xl font-semibold tabular-nums tracking-tight">
                {summary ? new Intl.NumberFormat(viewer.locale).format(summary[key]) : '—'}
              </span>
              <ArrowUpRightIcon className="text-muted-foreground group-hover:text-primary size-4" />
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">{hint}</p>
          </Link>
        ))}
      </div>
      {!summary && <StudyError t={t} />}
      {!!summary?.overdue && (
        <div className="bg-muted/20 flex flex-wrap items-center gap-3 rounded-xl border px-5 py-3">
          <Clock3Icon className="text-muted-foreground size-4" />
          <p className="min-w-0 flex-1 text-sm">
            {t.studentHome.overdue.replace('{count}', String(summary.overdue))}
          </p>
          <Button asChild variant="ghost" className="corner-brackets">
            <Link href="/student/homework?overdue=true">
              {t.studentHome.overdueAction}
              <ArrowUpRightIcon />
            </Link>
          </Button>
        </div>
      )}
      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        <StudyPanel
          title={t.studentHome.upcoming}
          hint={t.studentHome.upcomingHint}
          href="/student/calendar"
          action={t.studentHome.calendar}
        >
          {upcoming.status === 'rejected' ? (
            <StudyError t={t} />
          ) : upcoming.value.length ? (
            <StudyLessons lessons={upcoming.value} t={t} locale={viewer.locale} now={now} />
          ) : (
            <StudyEmpty title={t.studentHome.noLessons} hint={t.studentHome.noLessonsHint} />
          )}
        </StudyPanel>
        <StudyPanel
          title={t.studentHome.homework}
          hint={t.studentHome.homeworkHint}
          href="/student/homework"
          action={t.studentHome.allHomework}
        >
          {homework.status === 'rejected' ? (
            <StudyError t={t} />
          ) : homework.value.data.length ? (
            <StudentHomeworkList items={homework.value.data} t={t} locale={viewer.locale} />
          ) : (
            <StudyEmpty title={t.studentHome.noHomework} hint={t.studentHome.noHomeworkHint} />
          )}
        </StudyPanel>
      </div>
      <StudyPanel title={t.studentHome.teachers} hint={t.studentHome.creditsHint}>
        {teachers.status === 'rejected' ? (
          <StudyError t={t} />
        ) : (
          <StudyTeachers teachers={teachers.value} t={t} locale={viewer.locale} />
        )}
      </StudyPanel>
    </>
  )
}

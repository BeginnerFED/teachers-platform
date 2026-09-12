import Link from 'next/link'
import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  Clock3Icon,
  PlusIcon,
} from 'lucide-react'
import { PLATFORM_TIME_ZONE, listAssignmentsQuery } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { RefreshDashboard } from '@/features/admin-dashboard/components/refresh-dashboard'
import { TodayLessons } from '@/features/admin-dashboard/components/today-lessons'
import {
  listMyLessons,
  listPendingLessons,
  listTeacherStudentOverview,
} from '@/features/calendar/api'
import { createDraft } from '@/features/library/actions'
import { listAssignments, summariseAssignments } from '@/features/homework/api'
import { myLiveSession } from '@/features/live/api'
import { ActiveLessonCard } from '@/features/live/components/active-lesson-card'
import { LiveLaunchProvider } from '@/features/live/components/live-launcher'
import { QuickStudents } from '@/features/teacher-dashboard/components/quick-students'
import { HomeworkReview } from '@/features/teacher-dashboard/components/homework-review'
import { requireRole } from '@/lib/auth'
import { addDays, fromZoned, toZoned } from '@/lib/zoned-time'
import { getMessages } from '@/messages/server'

export default async function TeacherDashboardPage() {
  const [viewer, t] = await Promise.all([requireRole('teacher'), getMessages()])
  const now = new Date()
  const today = toZoned(now, PLATFORM_TIME_ZONE)
  const from = fromZoned({ ...today, hour: 0, minute: 0 }, PLATFORM_TIME_ZONE)
  const to = fromZoned({ ...addDays(today, 1), hour: 0, minute: 0 }, PLATFORM_TIME_ZONE)
  const [active, calendar, counts, review, students, pending] = await Promise.allSettled([
    myLiveSession(),
    listMyLessons({ from: from.toISOString(), to: to.toISOString() }),
    summariseAssignments({}),
    listAssignments(listAssignmentsQuery.parse({ status: 'submitted', perPage: 5 })),
    listTeacherStudentOverview(),
    listPendingLessons(),
  ])
  const summary = counts.status === 'fulfilled' ? counts.value : null
  const lessons = calendar.status === 'fulfilled' ? calendar.value : null
  const date = new Intl.DateTimeFormat(viewer.locale, {
    day: 'numeric',
    month: 'long',
    timeZone: PLATFORM_TIME_ZONE,
  }).format(now)
  const stats = [
    {
      label: t.teacherHome.today,
      hint: t.teacherHome.todayHint,
      count: lessons?.length,
      href: '/dashboard/calendar',
      icon: CalendarDaysIcon,
    },
    {
      label: t.teacherHome.review,
      hint: t.teacherHome.reviewHint,
      count: summary?.submitted,
      href: '/homework?status=submitted',
      icon: ClipboardCheckIcon,
    },
    {
      label: t.teacherHome.assigned,
      hint: t.teacherHome.assignedHint,
      count: summary?.assigned,
      href: '/homework?status=assigned',
      icon: ClipboardListIcon,
    },
  ]
  return (
    <LiveLaunchProvider
      session={active.status === 'fulfilled' ? active.value : null}
      failed={active.status === 'rejected'}
      t={t}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.teacher.title}</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">{t.teacherHome.description}</p>
        </div>
        <form action={createDraft}>
          <Button type="submit" className="corner-brackets">
            <PlusIcon />
            {t.teacherHome.createMaterial}
          </Button>
        </form>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map(({ label, hint, count, href, icon: Icon }) => (
          <Link
            href={href}
            key={href}
            className="bg-card hover:border-primary/30 focus-visible:ring-ring group min-w-0 rounded-xl border p-5 transition-colors focus-visible:outline-none focus-visible:ring-2"
          >
            <div className="text-muted-foreground flex items-center justify-between gap-2">
              <span className="text-xs font-medium">{label}</span>
              <Icon className="size-4 shrink-0" />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-3xl font-semibold tabular-nums tracking-tight">
                {count === undefined ? '—' : new Intl.NumberFormat(viewer.locale).format(count)}
              </span>
              <ArrowUpRightIcon className="text-muted-foreground group-hover:text-primary size-4" />
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">{hint}</p>
          </Link>
        ))}
      </div>
      {!summary && (
        <div
          role="alert"
          className="text-muted-foreground flex items-center justify-between gap-3 rounded-xl border px-5 py-3 text-sm"
        >
          {t.teacherHome.countsFailed}
          <RefreshDashboard label={t.common.retry} />
        </div>
      )}
      <ActiveLessonCard locale={viewer.locale} home />
      {!!summary?.overdue && (
        <div className="bg-muted/20 flex flex-wrap items-center gap-3 rounded-xl border px-5 py-3">
          <Clock3Icon className="text-muted-foreground size-4 shrink-0" />
          <p className="flex-1 text-sm">
            {t.teacherHome.overdue.replace('{count}', String(summary.overdue))}
          </p>
          <Button asChild variant="ghost" className="corner-brackets">
            <Link href="/homework?overdue=true">
              {t.teacherHome.overdueAction}
              <ArrowUpRightIcon />
            </Link>
          </Button>
        </div>
      )}
      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        <TodayLessons
          lessons={lessons}
          date={date}
          locale={viewer.locale}
          t={t}
          calendarHref="/dashboard/calendar"
          showStudents
          editing={{
            teacherId: viewer.id,
            students: students.status === 'fulfilled' ? students.value : null,
          }}
          pending={pending.status === 'fulfilled' ? pending.value : null}
        />
        <HomeworkReview
          result={review.status === 'fulfilled' ? review.value : null}
          t={t}
          locale={viewer.locale}
        />
      </div>
      <QuickStudents
        students={students.status === 'fulfilled' ? students.value : null}
        locale={viewer.locale}
        t={t}
      />
    </LiveLaunchProvider>
  )
}

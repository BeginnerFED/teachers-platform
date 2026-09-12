import { AlertCircleIcon } from 'lucide-react'
import { PLATFORM_TIME_ZONE, listTeachersQuery } from '@tp/shared'
import { createStudent, createTeacher } from '@/features/accounts/actions'
import { NewAccountDialog } from '@/features/accounts/components/new-account-dialog'
import { getAdminDashboard, getAdminDashboardActivity } from '@/features/admin-dashboard/api'
import {
  DashboardAttention,
  DashboardStats,
  RecentTeachers,
} from '@/features/admin-dashboard/components/dashboard-overview'
import { RefreshDashboard } from '@/features/admin-dashboard/components/refresh-dashboard'
import { RecentActivity } from '@/features/admin-dashboard/components/recent-activity'
import { TodayLessons } from '@/features/admin-dashboard/components/today-lessons'
import { listLessons } from '@/features/calendar/api'
import { TeacherField } from '@/features/roster/components/teacher-field'
import { listTeachers } from '@/features/teachers/api'
import { requireViewer } from '@/lib/auth'
import { addDays, fromZoned, toZoned } from '@/lib/zoned-time'
import { getMessages } from '@/messages/server'

export default async function AdminPage() {
  const [t, viewer] = await Promise.all([getMessages(), requireViewer()])
  const now = new Date()
  const today = toZoned(now, PLATFORM_TIME_ZONE)
  const from = fromZoned({ ...today, hour: 0, minute: 0 }, PLATFORM_TIME_ZONE)
  const to = fromZoned({ ...addDays(today, 1), hour: 0, minute: 0 }, PLATFORM_TIME_ZONE)
  const [overview, calendar, teachers, activity] = await Promise.allSettled([
    getAdminDashboard(),
    listLessons({ from: from.toISOString(), to: to.toISOString() }),
    listTeachers(listTeachersQuery.parse({ perPage: 100 })),
    getAdminDashboardActivity(),
  ])
  const data = overview.status === 'fulfilled' ? overview.value : null
  const date = new Intl.DateTimeFormat(viewer.locale, {
    day: 'numeric',
    month: 'long',
    timeZone: PLATFORM_TIME_ZONE,
  }).format(now)

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{t.admin.title}</h1>
            <RefreshDashboard label={t.adminHome.refresh} />
          </div>
          <p className="text-muted-foreground text-sm">{t.adminHome.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <NewAccountDialog
            label={t.students.add}
            title={t.students.create.title}
            description={t.students.create.description}
            duplicateMessage={t.students.create.duplicate}
            action={createStudent}
            variant="outline"
            fields={
              teachers.status === 'fulfilled' ? (
                <TeacherField
                  teachers={teachers.value.data}
                  label={t.students.create.teacher}
                  none={t.students.create.noTeacher}
                />
              ) : (
                <p className="text-muted-foreground text-xs">{t.adminHome.assignLater}</p>
              )
            }
            t={t}
          />
          <NewAccountDialog
            label={t.teachers.add}
            title={t.teachers.create.title}
            description={t.teachers.create.description}
            duplicateMessage={t.teachers.create.duplicate}
            action={createTeacher}
            t={t}
          />
        </div>
      </div>
      {data ? (
        <>
          <DashboardStats data={data} t={t} locale={viewer.locale} />
          <DashboardAttention data={data} t={t} locale={viewer.locale} />
        </>
      ) : (
        <div role="alert" className="flex items-center gap-3 rounded-xl border p-5">
          <AlertCircleIcon className="text-muted-foreground size-5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">{t.adminHome.loadFailed}</p>
            <p className="text-muted-foreground mt-1 text-xs">{t.adminHome.loadFailedHint}</p>
          </div>
          <RefreshDashboard label={t.common.retry} />
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {data && <RecentTeachers data={data} t={t} locale={viewer.locale} />}
        <TodayLessons
          lessons={calendar.status === 'fulfilled' ? calendar.value : null}
          date={date}
          t={t}
          locale={viewer.locale}
        />
      </div>
      <RecentActivity
        data={activity.status === 'fulfilled' ? activity.value : null}
        t={t}
        locale={viewer.locale}
      />
    </>
  )
}

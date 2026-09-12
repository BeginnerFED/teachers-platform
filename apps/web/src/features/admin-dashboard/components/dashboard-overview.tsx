import Link from 'next/link'
import {
  ArrowUpRightIcon,
  BookOpenIcon,
  CheckCheckIcon,
  CheckCircle2Icon,
  Clock3Icon,
  GraduationCapIcon,
  UsersIcon,
} from 'lucide-react'
import type { AdminDashboard, TeacherListItem } from '@tp/shared'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TeacherDetailSheet } from '@/features/teachers/components/teacher-detail-sheet'
import { StudentDetailSheet } from '@/features/students/components/student-detail-sheet'
import { SubscriptionBadge } from '@/features/teachers/components/subscription-badge'
import { remainingLabel } from '@/features/teachers/format'
import { formatDate, initials } from '@/lib/format'
import type { Messages } from '@/messages'
import { AssignTeacher, ExtendAccess } from './quick-actions'

type Props = { data: AdminDashboard; t: Messages; locale: string }

export function DashboardStats({ data, t, locale }: Props) {
  const number = new Intl.NumberFormat(locale)
  const stats = [
    {
      label: t.nav.teachers,
      value: data.counts.teachers,
      note: t.adminHome.teachersHint,
      icon: UsersIcon,
      href: '/admin/teachers',
    },
    {
      label: t.nav.students,
      value: data.counts.students,
      note: t.adminHome.studentsHint,
      icon: GraduationCapIcon,
      href: '/admin/students',
    },
    {
      label: t.adminHome.availableTeachers,
      value: data.counts.availableTeachers,
      note: t.adminHome.availableHint,
      icon: CheckCheckIcon,
      href: '/admin/teachers?access=available',
    },
    {
      label: t.adminHome.publishedMaterials,
      value: data.counts.publishedMaterials,
      note: t.adminHome.materialsHint,
      icon: BookOpenIcon,
      href: '/library?scope=platform&status=published',
    },
  ]
  return (
    <section aria-label={t.adminHome.summary} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(({ label, value, note, icon: Icon, href }) => (
        <Link
          key={href}
          href={href}
          className="bg-card hover:border-primary/30 focus-visible:ring-ring group rounded-xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 sm:p-5"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-muted-foreground min-h-8 text-xs font-medium leading-4">
              {label}
            </span>
            <span className="bg-muted/70 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors">
              <Icon className="size-4" />
            </span>
          </div>
          <div className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">
            {number.format(value)}
          </div>
          <div className="text-muted-foreground mt-3 flex items-center justify-between gap-2 text-[11px]">
            <span>{note}</span>
            <ArrowUpRightIcon className="group-hover:text-primary size-3.5 shrink-0" />
          </div>
        </Link>
      ))}
    </section>
  )
}

function Face({ name }: { name: string }) {
  return (
    <Avatar className="size-9 shrink-0 rounded-xl">
      <AvatarFallback className="bg-muted/70 rounded-xl text-xs font-medium">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

function TeacherRow({
  teacher,
  expiry = false,
  t,
  locale,
}: {
  teacher: TeacherListItem
  expiry?: boolean
  t: Messages
  locale: string
}) {
  const name = teacher.fullName ?? teacher.email
  const end = teacher.subscription?.accessEndsAt
  return (
    <li className="group/row hover:bg-muted/40 flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors sm:px-5">
      <Face name={name} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 break-words text-sm font-medium sm:truncate">{name}</p>
        <p className="text-muted-foreground mt-0.5 truncate text-xs">{teacher.email}</p>
        {!expiry && (
          <p className="text-muted-foreground mt-1 text-[11px]">
            {formatDate(teacher.createdAt, locale)}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
          {expiry ? (
            <>
              <span className="bg-muted rounded-md px-2 py-1 text-[11px] font-medium">
                {remainingLabel(teacher.subscription, t)}
              </span>
              {end && (
                <span className="text-muted-foreground text-[11px] tabular-nums">
                  {formatDate(end, locale)}
                </span>
              )}
            </>
          ) : (
            <SubscriptionBadge subscription={teacher.subscription} t={t} />
          )}
        </div>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        {expiry ? (
          <>
            <span className="bg-muted rounded-md px-2 py-1 text-xs font-medium">
              {remainingLabel(teacher.subscription, t)}
            </span>
            {end && (
              <p className="text-muted-foreground mt-1.5 text-[11px] tabular-nums">
                {formatDate(end, locale)}
              </p>
            )}
          </>
        ) : (
          <SubscriptionBadge subscription={teacher.subscription} t={t} />
        )}
      </div>
      {expiry ? (
        <div className="ml-12 flex basis-full items-center justify-between gap-2 sm:ml-0 sm:basis-auto">
          <ExtendAccess teacher={teacher} t={t} locale={locale} />
          <TeacherDetailSheet teacher={teacher} t={t} locale={locale} />
        </div>
      ) : (
        <TeacherDetailSheet teacher={teacher} t={t} locale={locale} />
      )}
    </li>
  )
}

function QueueFooter({
  count,
  total,
  href,
  t,
}: {
  count: number
  total: number
  href: string
  t: Messages
}) {
  return (
    <div className="bg-muted/20 flex items-center justify-between gap-3 border-t px-5 py-3 text-xs">
      <span className="text-muted-foreground">
        {t.adminHome.showing.replace('{shown}', String(count)).replace('{total}', String(total))}
      </span>
      <Link
        href={href}
        className="hover:text-primary focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-sm font-medium focus-visible:outline-none focus-visible:ring-2"
      >
        {t.adminHome.viewAll}
        <ArrowUpRightIcon className="size-3.5" />
      </Link>
    </div>
  )
}

export function DashboardAttention({ data, t, locale }: Props) {
  const total = data.expiring.total + data.expired.total + data.unlinked.total
  const queues = [
    { key: 'expiring', label: t.adminHome.expiring, queue: data.expiring },
    { key: 'expired', label: t.adminHome.expired, queue: data.expired },
  ] as const
  return (
    <section
      className="bg-card overflow-hidden rounded-xl border"
      aria-labelledby="attention-heading"
    >
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
          <Clock3Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="attention-heading" className="text-sm font-semibold">
            {t.adminHome.attention}
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">{t.adminHome.attentionHint}</p>
        </div>
        {total > 0 && (
          <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums">
            {new Intl.NumberFormat(locale).format(total)}
          </span>
        )}
      </div>
      {total === 0 ? (
        <div className="flex flex-col items-center gap-2 border-t px-5 py-9 text-center">
          <CheckCircle2Icon className="mb-1 size-7 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-medium">{t.adminHome.allClear}</p>
          <p className="text-muted-foreground max-w-md text-xs leading-5">
            {t.adminHome.allClearHint}
          </p>
        </div>
      ) : (
        <Tabs
          defaultValue={
            data.expired.total ? 'expired' : data.expiring.total ? 'expiring' : 'unlinked'
          }
          className="gap-0"
        >
          <div className="overflow-x-auto border-b px-4 pb-4 sm:px-5">
            <TabsList aria-label={t.adminHome.attention}>
              {queues.map(({ key, label, queue }) => (
                <TabsTrigger key={key} value={key} className="gap-2 px-3 text-xs">
                  {label}
                  <span className="text-muted-foreground text-[10px] tabular-nums">
                    {queue.total}
                  </span>
                </TabsTrigger>
              ))}
              <TabsTrigger value="unlinked" className="gap-2 px-3 text-xs">
                {t.adminHome.unlinked}
                <span className="text-muted-foreground text-[10px] tabular-nums">
                  {data.unlinked.total}
                </span>
              </TabsTrigger>
            </TabsList>
          </div>
          {queues.map(({ key, queue }) => (
            <TabsContent key={key} value={key} className="m-0">
              {queue.items.length ? (
                <ul className="divide-y">
                  {queue.items.map((teacher) => (
                    <TeacherRow key={teacher.id} teacher={teacher} expiry t={t} locale={locale} />
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground px-5 py-10 text-center text-sm">
                  {t.adminHome.queueEmpty[key]}
                </p>
              )}
              {queue.total > 0 && (
                <QueueFooter
                  count={queue.items.length}
                  total={queue.total}
                  href={`/admin/teachers?access=${key}`}
                  t={t}
                />
              )}
            </TabsContent>
          ))}
          <TabsContent value="unlinked" className="m-0">
            {data.unlinked.items.length ? (
              <ul className="divide-y">
                {data.unlinked.items.map((student) => (
                  <li
                    key={student.id}
                    className="group/row hover:bg-muted/40 flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors sm:px-5"
                  >
                    <Face name={student.fullName ?? student.email} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {student.fullName ?? student.email}
                      </p>
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {student.email}
                      </p>
                    </div>
                    <div className="ml-12 flex basis-full items-center justify-between gap-2 sm:ml-0 sm:basis-auto">
                      <AssignTeacher student={student} t={t} />
                      <StudentDetailSheet student={student} t={t} locale={locale} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground px-5 py-10 text-center text-sm">
                {t.adminHome.queueEmpty.unlinked}
              </p>
            )}
            {data.unlinked.total > 0 && (
              <QueueFooter
                count={data.unlinked.items.length}
                total={data.unlinked.total}
                href="/admin/students?link=unlinked"
                t={t}
              />
            )}
          </TabsContent>
        </Tabs>
      )}
    </section>
  )
}

export function RecentTeachers({ data, t, locale }: Props) {
  return (
    <section
      className="bg-card flex min-w-0 flex-col overflow-hidden rounded-xl border"
      aria-labelledby="recent-teachers-heading"
    >
      <div className="flex items-center justify-between gap-3 border-b p-5">
        <div>
          <h2 id="recent-teachers-heading" className="text-sm font-semibold">
            {t.adminHome.recentTeachers}
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">{t.adminHome.recentHint}</p>
        </div>
        <UsersIcon className="text-muted-foreground size-4 shrink-0" />
      </div>
      {data.recentTeachers.length ? (
        <ul className="flex-1 divide-y">
          {data.recentTeachers.map((teacher) => (
            <TeacherRow key={teacher.id} teacher={teacher} t={t} locale={locale} />
          ))}
        </ul>
      ) : (
        <div className="text-muted-foreground flex flex-1 items-center justify-center px-5 py-12 text-center text-sm">
          {t.teachers.empty}
        </div>
      )}
      <QueueFooter
        count={data.recentTeachers.length}
        total={data.counts.teachers}
        href="/admin/teachers"
        t={t}
      />
    </section>
  )
}

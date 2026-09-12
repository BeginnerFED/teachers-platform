'use client'

import Link from 'next/link'
import { useId, useState } from 'react'
import {
  ArrowUpRightIcon,
  BanIcon,
  CalendarPlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  HistoryIcon,
  GraduationCapIcon,
  Link2Icon,
  PauseIcon,
  PlayIcon,
  SparklesIcon,
  UnlinkIcon,
  UserPlusIcon,
  type LucideIcon,
} from 'lucide-react'
import {
  PLATFORM_TIME_ZONE,
  type AdminDashboardActivity,
  type DashboardActivityItem,
  type DashboardActivityPerson,
} from '@tp/shared'
import { Button } from '@/components/ui/button'
import { counted } from '@/lib/format'
import type { Messages } from '@/messages'
import { RefreshDashboard } from './refresh-dashboard'

const PREVIEW_SIZE = 5

const EVENT_ICONS: Record<DashboardActivityItem['type'], LucideIcon> = {
  teacher_created: UserPlusIcon,
  student_created: GraduationCapIcon,
  teacher_assigned: Link2Icon,
  teacher_unassigned: UnlinkIcon,
  trial_started: SparklesIcon,
  extended: CalendarPlusIcon,
  suspended: PauseIcon,
  reactivated: PlayIcon,
  canceled: BanIcon,
}

function personHref(person: DashboardActivityPerson) {
  const params = new URLSearchParams({ query: person.email, person: person.id })
  return `/admin/${person.role === 'teacher' ? 'teachers' : 'students'}?${params}`
}

export function RecentActivity({
  data,
  t,
  locale,
}: {
  data: AdminDashboardActivity | null
  t: Messages
  locale: string
}) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const text = t.adminHome.activity
  const shown = expanded ? data?.items : data?.items.slice(0, PREVIEW_SIZE)
  const date = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PLATFORM_TIME_ZONE,
  })
  const fullDate = new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: PLATFORM_TIME_ZONE,
  })

  return (
    <section
      className="bg-card overflow-hidden rounded-xl border"
      aria-labelledby="activity-heading"
    >
      <div className="flex items-center justify-between gap-3 border-b p-5">
        <div>
          <h2 id="activity-heading" className="text-sm font-semibold">
            {text.title}
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">{text.description}</p>
        </div>
        <HistoryIcon className="text-muted-foreground size-4 shrink-0" />
      </div>
      {!data ? (
        <div role="alert" className="flex items-center justify-between gap-3 p-5">
          <p className="text-muted-foreground text-sm">{text.failed}</p>
          <RefreshDashboard label={t.common.retry} />
        </div>
      ) : data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <HistoryIcon className="text-muted-foreground mb-1 size-6" />
          <p className="text-sm font-medium">{text.empty}</p>
          <p className="text-muted-foreground text-xs">{text.emptyHint}</p>
        </div>
      ) : (
        <>
          <ol id={listId} className="divide-y">
            {shown?.map((item) => {
              const Icon = EVENT_ICONS[item.type]
              const label = text.events[item.type]
              return (
                <li
                  key={item.id}
                  className="hover:bg-muted/30 flex items-start gap-3 px-4 py-3.5 transition-colors sm:px-5"
                >
                  <span className="bg-muted/70 text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-baseline sm:gap-4">
                      <p className="text-sm font-medium">
                        {label}
                        {item.kind === 'access' && item.months !== null && (
                          <span className="text-muted-foreground font-normal">
                            {' · '}
                            {counted(item.months, t.adminHome.quickActions.months, locale)}
                          </span>
                        )}
                      </p>
                      <time
                        dateTime={item.createdAt}
                        title={`${fullDate.format(new Date(item.createdAt))} · ${t.adminHome.timeZone}`}
                        className="text-muted-foreground shrink-0 text-[11px] tabular-nums"
                      >
                        {date.format(new Date(item.createdAt))}
                      </time>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <Link
                        href={personHref(item.subject)}
                        className="hover:text-primary focus-visible:ring-ring inline-flex min-w-0 max-w-full items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2"
                      >
                        <span className="truncate">
                          {item.subject.fullName ?? item.subject.email}
                        </span>
                        <ArrowUpRightIcon className="size-3 shrink-0" />
                      </Link>
                      {item.kind === 'roster' && (
                        <>
                          <span className="text-muted-foreground" aria-hidden="true">
                            ·
                          </span>
                          <Link
                            href={personHref(item.teacher)}
                            className="text-muted-foreground hover:text-primary focus-visible:ring-ring min-w-0 max-w-full truncate rounded-sm focus-visible:outline-none focus-visible:ring-2"
                          >
                            {item.teacher.fullName ?? item.teacher.email}
                          </Link>
                        </>
                      )}
                      {item.kind === 'access' && item.actor && (
                        <span className="text-muted-foreground min-w-0 max-w-full truncate">
                          {text.by.replace('{name}', item.actor.fullName ?? item.actor.email)}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
          <div className="bg-muted/20 flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3">
            <p className="text-muted-foreground text-[11px]">{text.rosterHint}</p>
            {data.items.length > PREVIEW_SIZE && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                aria-expanded={expanded}
                aria-controls={listId}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? text.less : text.more}
                {expanded ? (
                  <ChevronUpIcon className="size-3.5" />
                ) : (
                  <ChevronDownIcon className="size-3.5" />
                )}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  )
}

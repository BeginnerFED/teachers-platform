'use client'

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockAlertIcon,
  SearchIcon,
  UserRoundIcon,
  XIcon,
} from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useOptimistic, useRef, useTransition, type ReactNode } from 'react'
import {
  ASSIGNMENT_STATUSES,
  type AssignmentStatus,
  type AssignmentsSummary,
  type ListAssignmentsQuery,
  type MaterialOwner,
  type PageMeta,
} from '@tp/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { useUrlSearchTerm } from '@/hooks/use-url-search-term'

const ALL = 'all'
const SEARCH_DEBOUNCE_MS = 350

type Tab = AssignmentStatus | typeof ALL

/**
 * The desk's controls, and the frame the rows arrive in. The same shape as the library:
 * tabs that answer the click before the server does, a search that waits for a pause in
 * typing, and rows that dim in place while the next ones are on their way rather than
 * being torn out for a skeleton.
 *
 * The tabs wear their counts, so what is waiting is known before any tab is opened. Late
 * work gets a chip instead of a fifth tab: it is only there when there is any, because a
 * control that says "none" is furniture.
 */
export function HomeworkBrowser({
  query,
  meta,
  summary,
  teachers,
  studentScope,
  student = false,
  t,
  children,
}: {
  query: ListAssignmentsQuery
  meta: PageMeta
  summary: AssignmentsSummary
  /** Offered to the administrator, whose desk holds everyone's homework. */
  teachers?: MaterialOwner[]
  /** Visible context when a teacher arrives from one student's summary. */
  studentScope?: MaterialOwner
  student?: boolean
  t: Messages
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const urlTerm = query.query ?? ''
  const navigationParams = useRef(searchParams.toString())
  const { term, setTerm, submitNow } = useUrlSearchTerm(
    urlTerm,
    (next) => navigate({ query: next }),
    SEARCH_DEBOUNCE_MS,
  )

  useEffect(() => {
    if (!pending) navigationParams.current = searchParams.toString()
  }, [pending, searchParams])

  // Late work is open work, so the chip lights the "assigned" tab as well as itself.
  const urlTab: Tab = query.overdue ? 'assigned' : (query.status ?? ALL)
  const [tab, setTab] = useOptimistic<Tab>(urlTab)
  const [overdue, setOverdue] = useOptimistic(query.overdue)

  const total = summary.assigned + summary.submitted + summary.graded
  const lastPage = Math.max(1, Math.ceil(meta.total / meta.perPage))
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.perPage + 1
  const to = Math.min(meta.page * meta.perPage, meta.total)

  function navigate(
    changes: Record<string, string | null>,
    {
      keepPage = false,
      optimistic,
    }: {
      keepPage?: boolean
      /** Runs inside the same transition, so a control can answer the click at once. */
      optimistic?: () => void
    } = {},
  ) {
    const next = new URLSearchParams(navigationParams.current)

    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }

    // Changing what is being looked at returns to the first page; staying on page four of
    // a list that now has one page shows nothing at all.
    if (!keepPage) next.delete('page')

    navigationParams.current = next.toString()
    startTransition(() => {
      optimistic?.()
      router.replace(`${pathname}?${next}`, { scroll: false })
    })
  }

  const counts: Record<Tab, number> = { all: total, ...summary }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          className="max-w-full overflow-x-auto"
          value={tab}
          onValueChange={(next) =>
            navigate(
              { status: next === ALL ? null : next, overdue: null },
              {
                optimistic: () => {
                  setTab(next as Tab)
                  setOverdue(false)
                },
              },
            )
          }
        >
          <TabsList>
            {([ALL, ...ASSIGNMENT_STATUSES] as const).map((value) => (
              <TabsTrigger key={value} value={value}>
                {value === ALL
                  ? t.homework.tabs.all
                  : student
                    ? {
                        assigned: t.studentHome.openHomework,
                        submitted: t.studentHome.submitted,
                        graded: t.studentHome.graded,
                      }[value]
                    : t.homework.status[value]}
                <span
                  className={cn(
                    'bg-foreground/6 text-muted-foreground rounded-full px-1.5 text-[11px] tabular-nums leading-4',
                    // Handed-in work is what is waiting on the teacher, so its number
                    // carries the chip's tint when there is any.
                    value === 'submitted' &&
                      counts.submitted > 0 &&
                      'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
                  )}
                >
                  {counts[value]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {summary.overdue > 0 || overdue ? (
          <Button
            type="button"
            variant="outline"
            aria-pressed={overdue}
            onClick={() =>
              navigate(
                { status: null, overdue: overdue ? null : 'true' },
                {
                  optimistic: () => {
                    setOverdue(!overdue)
                    setTab(overdue ? ALL : 'assigned')
                  },
                },
              )
            }
            className={cn(
              'corner-brackets gap-1.5',
              overdue
                ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/50'
                : 'text-muted-foreground hover:text-red-700 dark:hover:text-red-300',
            )}
          >
            <ClockAlertIcon className="size-3.5" />
            {t.homework.overdue}
            <span className="text-xs tabular-nums">{summary.overdue}</span>
            {overdue ? <XIcon className="size-3" /> : null}
          </Button>
        ) : null}

        {studentScope ? (
          <Button
            type="button"
            variant="outline"
            className="corner-brackets gap-1.5"
            onClick={() => navigate({ studentId: null })}
          >
            <UserRoundIcon className="size-3.5" />
            <span className="max-w-40 truncate">{studentScope.fullName ?? studentScope.email}</span>
            <XIcon className="size-3" />
          </Button>
        ) : null}

        {!student && (
          <div className="relative flex-1 sm:max-w-[240px]">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />

            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={t.homework.filterStudents}
              aria-label={t.homework.filterStudents}
              className="h-8 rounded-full pl-8 pr-8"
            />

            {term ? (
              <button
                type="button"
                onClick={() => {
                  submitNow('')
                }}
                aria-label={t.students.clear}
                className="text-muted-foreground hover:bg-muted hover:text-foreground absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-1 transition-colors"
              >
                <XIcon className="size-3.5" />
              </button>
            ) : null}
          </div>
        )}

        {teachers && teachers.length > 0 ? (
          <Select
            value={query.teacherId ?? ALL}
            onValueChange={(value) => navigate({ teacherId: value === ALL ? null : value })}
          >
            <SelectTrigger className="h-8 w-[180px] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t.homework.allTeachers}</SelectItem>
              {teachers.map((teacher) => (
                <SelectItem key={teacher.id} value={teacher.id}>
                  {teacher.fullName ?? teacher.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {/* The rows that are already there stay there, dimmed, until the new ones arrive. */}
      <div
        aria-busy={pending}
        data-pending={pending ? '' : undefined}
        className="data-pending:pointer-events-none data-pending:opacity-45 transition-opacity duration-200 motion-reduce:transition-none"
      >
        {children}
      </div>

      {lastPage > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm tabular-nums">
            {from}–{to} {t.students.pagination.of} {meta.total}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="corner-brackets"
              disabled={pending || meta.page <= 1}
              onClick={() => navigate({ page: String(meta.page - 1) }, { keepPage: true })}
            >
              <ChevronLeftIcon />
              {t.students.pagination.previous}
            </Button>

            <Button
              variant="ghost"
              className="corner-brackets"
              disabled={pending || meta.page >= lastPage}
              onClick={() => navigate({ page: String(meta.page + 1) }, { keepPage: true })}
            >
              {t.students.pagination.next}
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

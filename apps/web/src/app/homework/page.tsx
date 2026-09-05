import { listAssignmentsQuery, listTeachersQuery, type AssignmentsSummary } from '@tp/shared'
import { listAssignments, listRecipients, summariseAssignments } from '@/features/homework/api'
import { GiveHomeworkButton } from '@/features/homework/components/give-homework-button'
import { HomeworkBrowser } from '@/features/homework/components/homework-browser'
import { HomeworkList } from '@/features/homework/components/homework-list'
import { listTeachers } from '@/features/teachers/api'
import { requireViewer } from '@/lib/auth'
import { counted, formatDate } from '@/lib/format'
import type { Messages } from '@/messages'
import { getMessages } from '@/messages/server'

/**
 * The desk: what was set, where it is, what came back. A teacher's own; for the
 * administrator, everyone's, with a way to narrow it to one teacher's.
 *
 * The title is followed by one sentence that says what is true right now — how many are
 * waiting, how many are late, when the next one is due — so the state of the desk is read
 * before a single row is.
 */
export default async function HomeworkPage({ searchParams }: PageProps<'/homework'>) {
  const [viewer, t, raw] = await Promise.all([requireViewer(), getMessages(), searchParams])

  // A hand-edited query string should not blank the page. Anything unparseable falls back
  // to what the schema already defines.
  const parsed = listAssignmentsQuery.safeParse(raw)
  const query = parsed.success ? parsed.data : listAssignmentsQuery.parse({})
  const isAdmin = viewer.role === 'admin'

  // The rows, the numbers on the tabs, the students any of it could be given to — and,
  // for the administrator, the teachers to narrow it by — in one round trip each, together.
  const [{ data, meta }, summary, recipients, teachers] = await Promise.all([
    listAssignments(query),
    summariseAssignments(query),
    listRecipients(),
    isAdmin ? listTeachers(listTeachersQuery.parse({ perPage: '100' })) : null,
  ])

  const total = summary.assigned + summary.submitted + summary.graded
  const filtering = Boolean(query.query || query.teacherId)

  // What "nothing here" means depends on what was asked for. Only the whole desk being
  // empty gets the hint about how to fill it, and the one quiet way to do so.
  const empty = filtering
    ? { title: t.homework.empty.search }
    : query.overdue
      ? { title: t.homework.empty.overdue }
      : query.status
        ? { title: t.homework.empty[query.status] }
        : {
            title: isAdmin ? t.homework.empty.allAdmin : t.homework.empty.all,
            hint: t.homework.empty.hint,
            link: { href: '/library', label: t.homework.emptyLink },
          }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-baseline gap-2 text-2xl font-semibold tracking-tight">
            {t.homework.title}
            <span className="text-muted-foreground text-lg font-normal tabular-nums">
              ({total})
            </span>
          </h1>
          <p className="text-muted-foreground text-sm">
            {statusLine(summary, { isAdmin, locale: viewer.locale, t })}
          </p>
        </div>

        <GiveHomeworkButton recipients={recipients} t={t} />
      </div>

      <HomeworkBrowser
        query={query}
        meta={meta}
        summary={summary}
        teachers={teachers?.data.map(({ id, fullName, email }) => ({ id, fullName, email }))}
        t={t}
      >
        <HomeworkList
          items={data}
          viewerId={viewer.id}
          isAdmin={isAdmin}
          locale={viewer.locale}
          empty={empty}
          t={t}
        />
      </HomeworkBrowser>
    </>
  )
}

/**
 * One plain sentence from the numbers: what is waiting on the teacher first, then what is
 * late, then what is simply under way, then the next date that matters. Nothing at all
 * gets a sentence of its own rather than a row of zeros.
 */
function statusLine(
  summary: AssignmentsSummary,
  { isAdmin, locale, t }: { isAdmin: boolean; locale: string; t: Messages },
): string {
  const parts: string[] = []

  if (summary.submitted > 0) {
    parts.push(counted(summary.submitted, t.homework.summary.waiting, locale))
  }
  if (summary.overdue > 0) parts.push(counted(summary.overdue, t.homework.summary.overdue, locale))
  if (summary.assigned > 0) parts.push(`${summary.assigned} ${t.homework.summary.open}`)
  if (summary.nextDueAt) {
    parts.push(`${t.homework.summary.nextDue} ${formatDate(summary.nextDueAt, locale)}`)
  }

  if (parts.length === 0) {
    if (summary.graded > 0) return t.homework.summary.allDone

    return isAdmin ? t.homework.summary.quietAdmin : t.homework.summary.quiet
  }

  return parts.join(' · ')
}

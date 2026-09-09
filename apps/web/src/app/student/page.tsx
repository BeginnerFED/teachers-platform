import { listAssignmentsQuery } from '@tp/shared'
import { listAssignments } from '@/features/homework/api'
import { joinableLiveSessions } from '@/features/live/api'
import { JoinBanner } from '@/features/live/components/join-banner'
import { StudentHomeworkList } from '@/features/homework/components/student-homework-list'
import { requireViewer } from '@/lib/auth'
import { getMessages } from '@/messages/server'

/**
 * A student's home is their homework. Nothing else on the platform is theirs to browse, so
 * the list is the page — the same heading in the same place as everywhere else.
 */
export default async function StudentPage() {
  const [viewer, t] = await Promise.all([requireViewer(), getMessages()])

  const [{ data, meta }, live] = await Promise.all([
    listAssignments(listAssignmentsQuery.parse({ perPage: '50' })),
    joinableLiveSessions(),
  ])

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="flex items-baseline gap-2 text-2xl font-semibold">
          {t.student.title}
          <span className="text-muted-foreground text-lg font-normal tabular-nums">
            ({meta.total})
          </span>
        </h1>
        <p className="text-muted-foreground text-sm">{t.student.description}</p>
      </div>

      <JoinBanner sessions={live} t={t} />

      <div className="rounded-md border">
        <StudentHomeworkList items={data} t={t} locale={viewer.locale} />
      </div>
    </>
  )
}

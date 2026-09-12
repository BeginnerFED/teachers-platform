import { notFound } from 'next/navigation'
import { getAssignment } from '@/features/homework/api'
import { HomeworkPlayer } from '@/features/homework/components/homework-player'
import { StatusBadge } from '@/features/homework/components/status-badge'
import { Visited } from '@/features/recent/recent'
import { ApiError } from '@/lib/api/errors'
import { requireViewer } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { getMessages } from '@/messages/server'

/**
 * Doing the homework. The heading is the lesson; under it, who set it, by when, and what
 * they said. Then the lesson itself, step by step, remembering everything.
 */
export default async function StudentHomeworkPage({
  params,
}: PageProps<'/student/homework/[assignmentId]'>) {
  const [viewer, t, { assignmentId }] = await Promise.all([requireViewer(), getMessages(), params])

  const assignment = await getAssignment(assignmentId).catch((error) => {
    if (error instanceof ApiError && error.status === 404) notFound()

    throw error
  })

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold">{assignment.material.title}</h1>
          <Visited kind="task" title={assignment.material.title} />
          <p className="text-muted-foreground flex flex-wrap gap-x-3 text-sm tabular-nums">
            <span>
              {t.homework.teacher}: {assignment.teacher.fullName ?? assignment.teacher.email}
            </span>
            <span>
              {t.homework.dueAt}:{' '}
              {assignment.dueAt ? formatDate(assignment.dueAt, viewer.locale) : t.homework.noDue}
            </span>
          </p>
          {assignment.note ? <p className="max-w-2xl text-sm">{assignment.note}</p> : null}
        </div>

        <StatusBadge status={assignment.status} t={t} className="mt-1.5" />
      </div>

      <HomeworkPlayer key={assignment.id} assignment={assignment} t={t} />
    </>
  )
}

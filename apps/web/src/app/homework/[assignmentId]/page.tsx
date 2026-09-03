import { notFound } from 'next/navigation'
import { getAssignment } from '@/features/homework/api'
import { ReviewPanel } from '@/features/homework/components/review-panel'
import { StatusBadge } from '@/features/homework/components/status-badge'
import { MaterialPlayer } from '@/features/library/components/material-player'
import { ApiError } from '@/lib/api/errors'
import { requireViewer } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { getMessages } from '@/messages/server'

/**
 * One student's work on one lesson, for the teacher who set it. The heading is the student —
 * that is who the teacher came to see — with the lesson and the dates under it; then the
 * marks and the teacher's own; then the work itself, exactly as the student saw it, every
 * answer locked and every mark shown.
 */
export default async function HomeworkReviewPage({
  params,
}: PageProps<'/homework/[assignmentId]'>) {
  const [viewer, t, { assignmentId }] = await Promise.all([requireViewer(), getMessages(), params])

  const assignment = await getAssignment(assignmentId).catch((error) => {
    if (error instanceof ApiError && error.status === 404) notFound()

    throw error
  })

  const answers = Object.fromEntries(
    Object.entries(assignment.steps).map(([stepId, step]) => [stepId, step.answers]),
  )

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold">
            {assignment.student.fullName ?? assignment.student.email}
          </h1>
          <p className="text-muted-foreground flex flex-wrap gap-x-3 text-sm tabular-nums">
            <span>{assignment.material.title}</span>
            <span>
              {t.homework.givenOn} {formatDate(assignment.createdAt, viewer.locale)}
            </span>
            {assignment.submittedAt ? (
              <span>
                {t.homework.submittedOn} {formatDate(assignment.submittedAt, viewer.locale)}
              </span>
            ) : assignment.dueAt ? (
              <span>
                {t.homework.dueAt} {formatDate(assignment.dueAt, viewer.locale)}
              </span>
            ) : null}
          </p>
        </div>

        <StatusBadge status={assignment.status} t={t} className="mt-1.5" />
      </div>

      <ReviewPanel assignment={assignment} t={t} />

      <MaterialPlayer
        material={assignment.lesson}
        backHref="/homework"
        initialAnswers={answers}
        initialResults={assignment.results}
        readOnly
        compactHeader
        t={t}
      />
    </>
  )
}

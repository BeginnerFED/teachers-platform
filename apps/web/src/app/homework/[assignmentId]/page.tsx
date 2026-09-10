import { notFound } from 'next/navigation'
import type { AssignmentDetail } from '@tp/shared'
import { getAssignment } from '@/features/homework/api'
import { ReviewPanel } from '@/features/homework/components/review-panel'
import { awaitingTeacher, isOverdue, totalScore } from '@/features/homework/components/score'
import { StatusBadge } from '@/features/homework/components/status-badge'
import { WithdrawButton } from '@/features/homework/components/withdraw-button'
import { MaterialPlayer } from '@/features/library/components/material-player'
import { Visited } from '@/features/recent/recent'
import { ApiError } from '@/lib/api/errors'
import { requireViewer } from '@/lib/auth'
import { counted, formatDate, formatRelative } from '@/lib/format'
import type { Messages } from '@/messages'
import { getMessages } from '@/messages/server'

/**
 * One student's work on one lesson. The heading is the student — that is who the teacher
 * came to see — with one sentence under it saying where the work stands; then the marks
 * and the teacher's own; then the work itself, exactly as the student saw it, every answer
 * locked and every mark shown.
 *
 * The teacher who set it can mark it and take it back. The administrator can open any of
 * it and do neither.
 */
export default async function HomeworkReviewPage({
  params,
}: PageProps<'/homework/[assignmentId]'>) {
  const [viewer, t, { assignmentId }] = await Promise.all([requireViewer(), getMessages(), params])

  const assignment = await getAssignment(assignmentId).catch((error) => {
    if (error instanceof ApiError && error.status === 404) notFound()

    throw error
  })

  const own = assignment.teacher.id === viewer.id
  const late = isOverdue(assignment)

  const answers = Object.fromEntries(
    Object.entries(assignment.steps).map(([stepId, step]) => [stepId, step.answers]),
  )

  const student = assignment.student.fullName ?? assignment.student.email

  return (
    <>
      {/* Named after the work rather than the person: a teacher marking three of one
          student's lessons would otherwise get three rows reading the same name. */}
      <Visited kind="homework" title={`${assignment.material.title} · ${student}`} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{student}</h1>
          <p className="text-muted-foreground text-sm tabular-nums">
            {statusLine(assignment, { own, late, locale: viewer.locale, t })}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={assignment.status} late={late} t={t} />
          {own && assignment.status === 'assigned' ? (
            <WithdrawButton assignmentId={assignment.id} t={t} />
          ) : null}
        </div>
      </div>

      <ReviewPanel assignment={assignment} canGrade={own} locale={viewer.locale} t={t} />

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

/** The lesson, then where the work stands, in one line under the student's name. */
function statusLine(
  assignment: AssignmentDetail,
  { own, late, locale, t }: { own: boolean; late: boolean; locale: string; t: Messages },
): string {
  const parts = [`${assignment.material.title} · ${assignment.material.level}`]

  // Who set it — worth a word only to the administrator, on somebody else's.
  if (!own) parts.push(assignment.teacher.fullName ?? assignment.teacher.email)

  if (assignment.status === 'assigned') {
    parts.push(`${t.homework.givenOn} ${formatRelative(assignment.createdAt, locale)}`)

    if (assignment.dueAt && late) {
      parts.push(`${t.homework.row.overdueSince} ${formatRelative(assignment.dueAt, locale)}`)
    } else if (assignment.dueAt) {
      parts.push(
        `${t.homework.dueShort} ${formatDate(assignment.dueAt, locale)} (${formatRelative(assignment.dueAt, locale)})`,
      )
    }

    if (assignment.progress.total > 0) {
      parts.push(
        `${assignment.progress.checked} ${t.homework.row.of} ${counted(assignment.progress.total, t.homework.units.steps, locale)}`,
      )
    }

    return parts.join(' · ')
  }

  parts.push(
    assignment.status === 'submitted'
      ? `${t.homework.submittedOn} ${formatRelative(assignment.submittedAt ?? assignment.updatedAt, locale)}`
      : `${t.homework.gradedOn} ${formatRelative(assignment.gradedAt ?? assignment.updatedAt, locale)}`,
  )

  const score = totalScore(assignment)
  if (score) {
    parts.push(
      `${score.score} ${t.homework.row.of} ${counted(score.max, t.homework.units.points, locale)}`,
    )
  }

  if (awaitingTeacher(assignment)) parts.push(t.homework.awaitingTeacher)

  return parts.join(' · ')
}

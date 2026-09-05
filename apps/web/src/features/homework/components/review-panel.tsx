'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import type { AssignmentDetail } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { counted } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { gradeAssignment } from '../actions'

const CARD = 'border-border/60 bg-card flex flex-col gap-5 rounded-2xl border p-5 sm:p-6'

/**
 * The teacher's side of a piece of homework. While it is open there is nothing to mark, so
 * the panel says so and shows how far along it is. Once handed in it holds the marks: the
 * machine's, fixed; the teacher's, for the writing; the two together; and a line to the
 * student.
 *
 * The administrator sees the same panel over any teacher's homework, with the marks and
 * the line but nothing to type into: looking is theirs, marking is the teacher's.
 */
export function ReviewPanel({
  assignment,
  canGrade,
  locale,
  t,
}: {
  assignment: AssignmentDetail
  canGrade: boolean
  locale: string
  t: Messages
}) {
  if (assignment.status === 'assigned') {
    const { checked, total } = assignment.progress

    return (
      <div className={cn(CARD, 'gap-4')}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <p className="text-muted-foreground text-sm">{t.homework.notSubmitted}</p>

          {total > 0 ? (
            <span className="text-muted-foreground flex items-center gap-2 text-xs tabular-nums">
              <Progress value={(checked / total) * 100} className="w-24" />
              {checked} {t.homework.row.of} {counted(total, t.homework.units.steps, locale)}
            </span>
          ) : null}
        </div>

        <Note assignment={assignment} t={t} />
      </div>
    )
  }

  return canGrade ? (
    <GradeCard assignment={assignment} t={t} />
  ) : (
    <MarksCard assignment={assignment} t={t} />
  )
}

/** The teacher's line to the student, shown where the teacher will look for it. */
function Note({ assignment, t }: { assignment: AssignmentDetail; t: Messages }) {
  if (!assignment.note) return null

  return (
    <Field label={t.homework.note}>
      <p className="text-sm">{assignment.note}</p>
    </Field>
  )
}

/** A small label, an optional helper line, and the thing itself. */
function Field({
  label,
  help,
  children,
  className,
}: {
  label: string
  help?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium">{label}</span>
        {help ? <span className="text-muted-foreground text-xs">{help}</span> : null}
      </div>
      {children}
    </div>
  )
}

function Big({ score, max }: { score: number | string; max: number }) {
  return (
    <span className="text-2xl font-semibold tabular-nums">
      {score}
      <span className="text-muted-foreground text-base font-normal"> / {max}</span>
    </span>
  )
}

function AutoScore({ assignment }: { assignment: AssignmentDetail }) {
  const score = assignment.autoScore ?? 0
  const max = assignment.autoMax ?? 0

  return (
    <div className="flex flex-col gap-2">
      <Big score={score} max={max} />
      <Progress value={max === 0 ? 100 : (score / max) * 100} className="w-24" />
    </div>
  )
}

function GradeCard({ assignment, t }: { assignment: AssignmentDetail; t: Messages }) {
  const [manual, setManual] = useState(
    assignment.manualScore === null ? '' : String(assignment.manualScore),
  )
  const [feedback, setFeedback] = useState(assignment.feedback ?? '')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const manualScore = manual.trim() === '' ? null : Number(manual)
  const manualValid =
    manualScore === null ||
    (Number.isInteger(manualScore) && manualScore >= 0 && manualScore <= assignment.manualMax)

  // Saving what is already saved is a click for nothing, so the button waits for a change
  // — except on work not yet marked at all, where saving is how it becomes "read".
  const dirty =
    assignment.status !== 'graded' ||
    manualScore !== assignment.manualScore ||
    feedback.trim() !== (assignment.feedback ?? '')

  const total = (assignment.autoScore ?? 0) + (manualValid ? (manualScore ?? 0) : 0)
  const totalMax = (assignment.autoMax ?? 0) + assignment.manualMax

  const save = () =>
    startTransition(async () => {
      const { error } = await gradeAssignment(assignment.id, {
        manualScore,
        feedback: feedback.trim() || null,
      })

      if (error) {
        toast.error(t.homework.failed)
        return
      }

      toast.success(t.homework.graded)
      router.refresh()
    })

  return (
    <div className={CARD}>
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        <Field label={t.homework.autoScore}>
          <AutoScore assignment={assignment} />
        </Field>

        {assignment.manualMax > 0 ? (
          <>
            <Field label={t.homework.manualScore}>
              <div className="flex items-center gap-2">
                <Input
                  id="manual-score"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={assignment.manualMax}
                  value={manual}
                  onChange={(event) => setManual(event.target.value)}
                  aria-invalid={!manualValid || undefined}
                  aria-label={t.homework.manualScore}
                  className="h-9 w-16 text-lg font-semibold tabular-nums"
                />
                <span className="text-muted-foreground tabular-nums">/ {assignment.manualMax}</span>
              </div>
            </Field>

            <Field label={t.homework.total}>
              <Big score={total} max={totalMax} />
            </Field>
          </>
        ) : null}
      </div>

      <Note assignment={assignment} t={t} />

      <Field label={t.homework.feedback}>
        <Label htmlFor="feedback" className="sr-only">
          {t.homework.feedback}
        </Label>
        <Textarea
          id="feedback"
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder={t.homework.feedbackPlaceholder}
          maxLength={2000}
          rows={2}
          className="min-h-16 text-sm"
        />
      </Field>

      <div className="flex justify-end">
        <Button type="button" disabled={pending || !manualValid || !dirty} onClick={save}>
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          {pending ? t.homework.saving : t.homework.saveGrade}
        </Button>
      </div>
    </div>
  )
}

/** The marks as they stand, for somebody who may read them but not give them. */
function MarksCard({ assignment, t }: { assignment: AssignmentDetail; t: Messages }) {
  return (
    <div className={CARD}>
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        <Field label={t.homework.autoScore}>
          <AutoScore assignment={assignment} />
        </Field>

        {assignment.manualMax > 0 ? (
          <>
            <Field label={t.homework.manualScore}>
              <Big score={assignment.manualScore ?? '—'} max={assignment.manualMax} />
            </Field>
            <Field label={t.homework.total}>
              <Big
                score={(assignment.autoScore ?? 0) + (assignment.manualScore ?? 0)}
                max={(assignment.autoMax ?? 0) + assignment.manualMax}
              />
            </Field>
          </>
        ) : null}
      </div>

      <Note assignment={assignment} t={t} />

      <Field label={t.homework.feedback}>
        <p className={cn('text-sm', !assignment.feedback && 'text-muted-foreground')}>
          {assignment.feedback ?? '—'}
        </p>
      </Field>

      <p className="text-muted-foreground border-border/60 border-t pt-3 text-xs">
        {t.homework.readOnly}
      </p>
    </div>
  )
}

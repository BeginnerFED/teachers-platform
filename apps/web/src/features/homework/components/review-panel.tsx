'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Loader2Icon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import type { AssignmentDetail } from '@tp/shared'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Messages } from '@/messages'
import { gradeAssignment, withdrawAssignment } from '../actions'

/**
 * The teacher's side of a piece of homework. While it is open there is nothing to mark, so
 * the panel says so and offers the one thing a teacher can do — take it back. Once handed
 * in it holds the marks: the machine's, fixed; the teacher's, for the writing; and a line
 * to the student.
 */
export function ReviewPanel({ assignment, t }: { assignment: AssignmentDetail; t: Messages }) {
  const [manual, setManual] = useState(
    assignment.manualScore === null ? '' : String(assignment.manualScore),
  )
  const [feedback, setFeedback] = useState(assignment.feedback ?? '')
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  if (assignment.status === 'assigned') {
    return (
      <>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-4 text-sm">
          <p className="text-muted-foreground">{t.homework.notSubmitted}</p>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setConfirming(true)}
            className="corner-brackets hover:text-destructive"
          >
            {pending ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2Icon />}
            {t.homework.withdraw}
          </Button>
        </div>

        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.homework.confirmWithdraw.title}</AlertDialogTitle>
              <AlertDialogDescription>{t.homework.confirmWithdraw.body}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.homework.confirmWithdraw.cancel}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  startTransition(async () => {
                    const { error } = await withdrawAssignment(assignment.id)

                    if (error) {
                      toast.error(t.homework.failed)
                      return
                    }

                    toast.success(t.homework.withdrawn)
                    router.push('/homework')
                  })
                }
              >
                {t.homework.confirmWithdraw.confirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    )
  }

  const manualScore = manual.trim() === '' ? null : Number(manual)
  const manualValid =
    manualScore === null ||
    (Number.isInteger(manualScore) && manualScore >= 0 && manualScore <= assignment.manualMax)

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
    <div className="grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-[auto_1fr_auto] sm:items-end">
      <div className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-xs">{t.homework.autoScore}</span>
        <span className="text-lg font-semibold tabular-nums">
          {assignment.autoScore ?? 0} / {assignment.autoMax ?? 0}
        </span>

        {assignment.manualMax > 0 ? (
          <div className="mt-1 flex flex-col gap-1.5">
            <Label htmlFor="manual-score" className="text-muted-foreground text-xs">
              {t.homework.manualScore} · / {assignment.manualMax}
            </Label>
            <Input
              id="manual-score"
              type="number"
              inputMode="numeric"
              min={0}
              max={assignment.manualMax}
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              aria-invalid={!manualValid || undefined}
              className="h-8 w-24 tabular-nums"
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="feedback" className="text-muted-foreground text-xs">
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
      </div>

      <Button
        type="button"
        size="sm"
        disabled={pending || !manualValid}
        onClick={save}
        className="corner-brackets"
      >
        {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
        {pending ? t.homework.saving : t.homework.saveGrade}
      </Button>
    </div>
  )
}

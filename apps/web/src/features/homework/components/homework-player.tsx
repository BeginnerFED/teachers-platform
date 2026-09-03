'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CheckIcon } from 'lucide-react'
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
import { MaterialPlayer } from '@/features/library/components/material-player'
import type { Messages } from '@/messages'
import { saveProgress, submitAssignment } from '../actions'
import { totalScore } from './score'

/**
 * The lesson, with a memory. Every check is saved; leaving a step saves what was typed on
 * it; the last page hands the work in. Come back tomorrow and it is where you left it.
 *
 * Once handed in, the same player shows the work read-only with every mark — and the
 * teacher's words, when they come.
 */
export function HomeworkPlayer({ assignment, t }: { assignment: AssignmentDetail; t: Messages }) {
  const [current, setCurrent] = useState(assignment)
  const [confirming, setConfirming] = useState(false)
  const [submitting, startSubmitting] = useTransition()
  const router = useRouter()

  const answers = Object.fromEntries(
    Object.entries(current.steps).map(([stepId, step]) => [stepId, step.answers]),
  )

  const submit = () =>
    startSubmitting(async () => {
      const { assignment: next, error } = await submitAssignment(current.id)

      if (error || !next) {
        toast.error(t.homework.failed)
        return
      }

      setCurrent(next)
      toast.success(t.homework.submitted)
      // The page around the player — the badge, the description — is server-rendered.
      router.refresh()
    })

  if (current.status !== 'assigned') {
    const score = totalScore(current)

    return (
      <div className="flex flex-col gap-6">
        <div className="mx-auto w-full max-w-3xl rounded-lg border p-4 text-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <CheckIcon className="size-4 text-emerald-600" />
            <span className="font-medium">{t.homework.result}</span>
            {score ? (
              <span className="tabular-nums">
                {score.score} / {score.max} {t.homework.points}
              </span>
            ) : null}
            {current.status === 'submitted' && current.manualMax > 0 ? (
              <span className="text-muted-foreground">· {t.homework.awaitingTeacher}</span>
            ) : null}
          </div>

          {current.feedback ? (
            <div className="mt-3 border-t pt-3">
              <p className="text-muted-foreground mb-1 text-xs">{t.homework.feedback}</p>
              <p className="whitespace-pre-wrap">{current.feedback}</p>
            </div>
          ) : null}
        </div>

        <MaterialPlayer
          material={current.lesson}
          backHref="/student"
          initialAnswers={answers}
          initialResults={current.results}
          readOnly
          compactHeader
          t={t}
        />
      </div>
    )
  }

  return (
    <>
      <MaterialPlayer
        material={current.lesson}
        backHref="/student"
        initialAnswers={answers}
        initialResults={current.results}
        onCheck={(stepId, given) => saveProgress(current.id, stepId, given, true)}
        onLeaveStep={(stepId, given) => {
          // Fire and forget: nothing on the page waits for a draft to be saved.
          void saveProgress(current.id, stepId, given, false)
        }}
        submit={{
          label: submitting ? t.homework.submitting : t.homework.submit,
          pending: submitting,
          onSubmit: () => setConfirming(true),
        }}
        compactHeader
        t={t}
      />

      {/* Confirmed, because there is no way back from it. */}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.homework.confirmSubmit.title}</AlertDialogTitle>
            <AlertDialogDescription>{t.homework.confirmSubmit.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.homework.confirmSubmit.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirming(false)
                submit()
              }}
            >
              {t.homework.confirmSubmit.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

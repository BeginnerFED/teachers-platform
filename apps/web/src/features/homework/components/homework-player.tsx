'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import { CheckIcon, CloudOffIcon, Loader2Icon, MessageSquareTextIcon } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { saveProgress, submitAssignment } from '../actions'
import { HomeworkDraft } from '../homework-draft'

export function HomeworkPlayer({ assignment, t }: { assignment: AssignmentDetail; t: Messages }) {
  const [submitted, setSubmitted] = useState<AssignmentDetail | null>(null)
  // Fresh server props include the teacher's latest review, without resetting active typing.
  const current = submitted && submitted.updatedAt > assignment.updatedAt ? submitted : assignment
  const [draft] = useState(
    () =>
      new HomeworkDraft(assignment, (stepId, given, checked) =>
        saveProgress(assignment.id, stepId, given, checked),
      ),
  )
  const state = useSyncExternalStore(draft.subscribe, draft.getSnapshot, draft.getSnapshot)
  const [confirming, setConfirming] = useState(false)
  const [submitting, startSubmitting] = useTransition()
  const submitLock = useRef(false)
  const router = useRouter()
  const revising = current.status === 'assigned' && Boolean(current.revisionRequestedAt)

  useEffect(() => {
    try {
      draft.restore(window.sessionStorage)
    } catch {
      /* Storage may be disabled. */
    }
    const flush = () => {
      void draft.flush()
    }
    const guard = (event: BeforeUnloadEvent) => {
      if (!draft.hasPending()) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    window.addEventListener('online', flush)
    window.addEventListener('focus', flush)
    document.addEventListener('visibilitychange', flush)
    return () => {
      window.removeEventListener('beforeunload', guard)
      window.removeEventListener('online', flush)
      window.removeEventListener('focus', flush)
      document.removeEventListener('visibilitychange', flush)
      draft.leave()
    }
  }, [draft])

  useEffect(() => {
    draft.reconcile(current)
  }, [current, draft])

  const submit = () => {
    if (submitLock.current) return
    submitLock.current = true
    startSubmitting(async () => {
      try {
        if (!(await draft.flush())) {
          toast.error(t.homework.autosave.failed)
          return
        }
        const { assignment: next, error } = await submitAssignment(current.id)
        if (error || !next) {
          toast.error(t.homework.failed)
          router.refresh()
          return
        }
        draft.reconcile(next)
        setSubmitted(next)
        setConfirming(false)
        toast.success(revising ? t.homework.revision.submitted : t.homework.submitted)
        router.refresh()
      } catch {
        toast.error(t.homework.failed)
      } finally {
        submitLock.current = false
      }
    })
  }

  if (current.status !== 'assigned') {
    const reviewed = current.status === 'graded'

    return (
      <div className="flex flex-col gap-6">
        <div className="mx-auto w-full max-w-3xl rounded-lg border p-4 text-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <CheckIcon
              className={cn('size-4', reviewed ? 'text-emerald-600' : 'text-muted-foreground')}
            />
            <span className="font-medium">
              {reviewed ? t.homework.evaluation.reviewed : t.homework.evaluation.pending}
            </span>
          </div>

          {current.feedback ? (
            <div className="mt-3 border-t pt-3">
              <p className="text-muted-foreground mb-1 text-xs">{t.homework.evaluation.feedback}</p>
              <p className="whitespace-pre-wrap">{current.feedback}</p>
            </div>
          ) : null}
        </div>

        <MaterialPlayer
          material={current.lesson}
          backHref="/student/homework"
          answers={Object.fromEntries(
            Object.entries(current.steps).map(([id, step]) => [id, step.answers]),
          )}
          results={current.results}
          readOnly
          reviewed={current.status === 'graded'}
          compactHeader
          t={t}
        />
      </div>
    )
  }

  return (
    <>
      {revising ? (
        <div className="mx-auto w-full max-w-3xl rounded-lg border border-violet-200 bg-violet-50/70 p-4 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100">
          <div className="flex items-start gap-3">
            <MessageSquareTextIcon className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-300" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">{t.homework.revision.guidance}</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{current.revisionNote}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="mx-auto flex w-full max-w-3xl items-center justify-end gap-2 text-xs"
        role="status"
        aria-live="polite"
      >
        {state.status === 'saving' ? (
          <Loader2Icon className="size-3.5 animate-spin" />
        ) : state.status === 'error' ? (
          <CloudOffIcon className="text-destructive size-3.5 shrink-0" />
        ) : state.status === 'saved' ? (
          <CheckIcon className="size-3.5 text-emerald-600" />
        ) : null}
        <span className={state.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
          {state.status === 'error'
            ? t.homework.autosave.failed
            : t.homework.autosave[state.status]}
        </span>
        {state.status === 'error' ? (
          <Button
            size="sm"
            variant="outline"
            className="corner-brackets shrink-0"
            disabled={submitting}
            onClick={() => void draft.flush()}
          >
            {t.common.retry}
          </Button>
        ) : null}
      </div>
      <MaterialPlayer
        material={current.lesson}
        backHref="/student/homework"
        answers={state.answers}
        results={state.results}
        onAnswer={(stepId, blockId, value) => {
          if (!submitLock.current) draft.answer(stepId, blockId, value)
        }}
        onCheck={(stepId) => draft.check(stepId)}
        onLeaveStep={() => {
          void draft.flush()
        }}
        disabled={submitting}
        submit={{
          label: submitting
            ? revising
              ? t.homework.revision.submitting
              : t.homework.submitting
            : revising
              ? t.homework.revision.submit
              : t.homework.submit,
          pending: submitting,
          onSubmit: () => setConfirming(true),
        }}
        compactHeader
        t={t}
      />

      {/* Confirmed, because there is no way back from it. */}
      <AlertDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!submitLock.current) setConfirming(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {revising ? t.homework.revision.confirmTitle : t.homework.confirmSubmit.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {revising ? t.homework.revision.confirmBody : t.homework.confirmSubmit.body}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting} className="corner-brackets">
              {t.homework.confirmSubmit.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className="corner-brackets"
              disabled={submitting}
              onClick={(event) => {
                event.preventDefault()
                submit()
              }}
            >
              {submitting
                ? revising
                  ? t.homework.revision.submitting
                  : t.homework.submitting
                : revising
                  ? t.homework.revision.submit
                  : t.homework.confirmSubmit.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

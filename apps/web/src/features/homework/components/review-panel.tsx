'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  CheckCircle2Icon,
  ClipboardCheckIcon,
  Loader2Icon,
  RotateCcwIcon,
  SparklesIcon,
  Undo2Icon,
} from 'lucide-react'
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel, FieldTitle } from '@/components/ui/field'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { aiLimitMessage } from '@/features/ai/components/ai-usage-meter'
import { counted } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { gradeAssignment, requestAssignmentRevision, suggestHomeworkFeedback } from '../actions'

/**
 * One simple teacher decision: read the work, optionally let the assistant draft useful
 * feedback, and mark the review complete. Correctness stays beside each exercise; this
 * panel never turns a learning activity into a grade sheet.
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
      <Card size="sm">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheckIcon className="text-muted-foreground size-4" />
            {t.homework.evaluation.title}
          </CardTitle>
          <CardDescription>
            {assignment.revisionRequestedAt
              ? t.homework.revision.teacherWaiting
              : t.homework.notSubmitted}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {total > 0 ? (
            <div className="space-y-2">
              <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs tabular-nums">
                <span>{t.homework.evaluation.progress}</span>
                <span>
                  {checked} {t.homework.row.of} {counted(total, t.homework.units.steps, locale)}
                </span>
              </div>
              <Progress value={(checked / total) * 100} className="h-1.5" />
            </div>
          ) : null}
          {assignment.revisionRequestedAt && assignment.revisionNote ? (
            <Field>
              <FieldTitle>{t.homework.revision.guidance}</FieldTitle>
              <p className="text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                {assignment.revisionNote}
              </p>
            </Field>
          ) : null}
          <AssignmentNote assignment={assignment} t={t} />
        </CardContent>
      </Card>
    )
  }

  return canGrade ? (
    <FeedbackCard key={assignment.id} assignment={assignment} locale={locale} t={t} />
  ) : (
    <ReadOnlyCard assignment={assignment} t={t} />
  )
}

function hasWritingBlock(assignment: AssignmentDetail): boolean {
  return assignment.lesson.steps.some((step) =>
    step.blocks.some((block) => block.type === 'free_writing'),
  )
}

function hasReviewableWritingAnswer(assignment: AssignmentDetail): boolean {
  return assignment.lesson.steps.some((step) =>
    step.blocks.some((block) => {
      if (block.type !== 'free_writing') return false

      const answer = assignment.steps[step.id]?.answers[block.id]

      return typeof answer === 'string' && answer.trim().length > 0
    }),
  )
}

function AssignmentNote({ assignment, t }: { assignment: AssignmentDetail; t: Messages }) {
  if (!assignment.note) return null

  return (
    <Field>
      <FieldTitle>{t.homework.note}</FieldTitle>
      <p className="text-muted-foreground text-sm leading-relaxed">{assignment.note}</p>
    </Field>
  )
}

function ExerciseReview({ assignment, t }: { assignment: AssignmentDetail; t: Messages }) {
  const hasAutomaticResult = Object.values(assignment.results).some((stepResult) =>
    Object.values(stepResult.byBlock).some((blockResult) => !blockResult.manual),
  )

  if (!hasAutomaticResult) return null

  return (
    <div className="bg-muted/35 rounded-lg border px-3 py-2.5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" />
        {t.homework.evaluation.exercises}
      </div>
      <p className="text-muted-foreground mt-1.5 pl-6 text-xs leading-relaxed">
        {t.homework.evaluation.exercisesHint}
      </p>
    </div>
  )
}

function FeedbackCard({
  assignment,
  locale,
  t,
}: {
  assignment: AssignmentDetail
  locale: string
  t: Messages
}) {
  const [feedback, setFeedback] = useState(assignment.feedback ?? '')
  const [saving, startSaving] = useTransition()
  const [requesting, startRequesting] = useTransition()
  const [suggesting, startSuggesting] = useTransition()
  const [confirmingSuggestion, setConfirmingSuggestion] = useState(false)
  const [previousFeedback, setPreviousFeedback] = useState<string | null>(null)
  const router = useRouter()

  const hasWriting = hasWritingBlock(assignment)
  const canSuggestFeedback = hasReviewableWritingAnswer(assignment)
  const feedbackValid = !hasWriting || feedback.trim().length > 0
  const revisionValid = feedback.trim().length > 0
  const dirty = assignment.status !== 'graded' || feedback.trim() !== (assignment.feedback ?? '')

  const save = () => {
    if (!feedbackValid) return

    startSaving(async () => {
      const { error } = await gradeAssignment(assignment.id, {
        feedback: feedback.trim() || null,
      })

      if (error) {
        toast.error(t.homework.failed)
        return
      }

      toast.success(t.homework.evaluation.saved)
      setPreviousFeedback(null)
      router.refresh()
    })
  }

  const suggest = () =>
    startSuggesting(async () => {
      try {
        const result = await suggestHomeworkFeedback(assignment.id)

        if (result.error || !result.suggestion) {
          toast.error(
            result.limit
              ? aiLimitMessage({
                  details: result.limit,
                  feature: 'homeworkFeedback',
                  locale,
                  t,
                })
              : result.error === 'rule_violation'
                ? t.homework.aiFeedback.ineligible
                : result.error === 'conflict'
                  ? t.homework.aiFeedback.changed
                  : t.homework.aiFeedback.failed,
          )
          return
        }

        setPreviousFeedback(feedback)
        setFeedback(result.suggestion.feedback)
        toast.success(t.homework.evaluation.assistantDraft)
      } catch {
        toast.error(t.homework.aiFeedback.failed)
      }
    })

  const requestRevision = () => {
    if (!revisionValid || assignment.status !== 'submitted') return

    startRequesting(async () => {
      const { error } = await requestAssignmentRevision(assignment.id, {
        note: feedback.trim(),
      })

      if (error) {
        toast.error(error === 'conflict' ? t.homework.revision.changed : t.homework.revision.failed)
        return
      }

      toast.success(t.homework.revision.requestedToast)
      setPreviousFeedback(null)
      router.refresh()
    })
  }

  const restoreFeedback = () => {
    if (previousFeedback === null) return
    setFeedback(previousFeedback)
    setPreviousFeedback(null)
  }

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheckIcon className="text-muted-foreground size-4" />
          {t.homework.evaluation.title}
        </CardTitle>
        <CardDescription>
          {assignment.status === 'graded'
            ? t.homework.evaluation.gradedHint
            : t.homework.evaluation.submittedHint}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <ExerciseReview assignment={assignment} t={t} />

        {canSuggestFeedback ? (
          <div className="bg-primary/5 ring-primary/10 rounded-lg p-3 ring-1">
            <div className="flex items-start gap-3">
              <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full">
                <SparklesIcon className="size-4" />
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">{t.homework.evaluation.assistantTitle}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {t.homework.evaluation.assistantHint}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="corner-brackets mt-3 w-full"
              disabled={saving || requesting || suggesting || previousFeedback !== null}
              onClick={() => setConfirmingSuggestion(true)}
            >
              {suggesting ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
              {suggesting
                ? t.homework.aiFeedback.generating
                : t.homework.evaluation.assistantAction}
            </Button>

            {previousFeedback !== null ? (
              <div
                role="status"
                className="border-primary/10 mt-3 border-t pt-3 text-xs leading-relaxed"
              >
                <p className="text-muted-foreground">{t.homework.evaluation.assistantDraft}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="corner-brackets -ml-2 mt-1 h-7"
                  onClick={restoreFeedback}
                >
                  <Undo2Icon />
                  {t.homework.evaluation.restoreDraft}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <Field>
          <FieldLabel htmlFor="feedback">{t.homework.evaluation.feedback}</FieldLabel>
          <Textarea
            id="feedback"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder={t.homework.evaluation.feedbackPlaceholder}
            maxLength={2000}
            rows={7}
            className="min-h-36 resize-y text-sm"
          />
          <FieldDescription>
            {hasWriting
              ? t.homework.evaluation.feedbackRequiredHint
              : t.homework.evaluation.feedbackOptionalHint}
          </FieldDescription>
          {assignment.status === 'submitted' ? (
            <FieldDescription>{t.homework.revision.noteHint}</FieldDescription>
          ) : null}
        </Field>

        <AssignmentNote assignment={assignment} t={t} />
      </CardContent>

      <CardFooter className="flex-col gap-2">
        {assignment.status === 'submitted' ? (
          <Button
            type="button"
            variant="outline"
            className="corner-brackets w-full"
            disabled={saving || requesting || suggesting || !revisionValid}
            onClick={requestRevision}
          >
            {requesting ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />}
            {requesting ? t.homework.revision.requesting : t.homework.revision.action}
          </Button>
        ) : null}
        <Button
          type="button"
          className="corner-brackets w-full"
          disabled={saving || requesting || suggesting || !feedbackValid || !dirty}
          onClick={save}
        >
          {saving ? <Loader2Icon className="animate-spin" /> : null}
          {saving
            ? t.homework.saving
            : assignment.status === 'graded'
              ? t.homework.evaluation.update
              : t.homework.evaluation.complete}
        </Button>
      </CardFooter>

      <AlertDialog open={confirmingSuggestion} onOpenChange={setConfirmingSuggestion}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.homework.aiFeedback.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.homework.aiFeedback.disclosure}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.homework.aiFeedback.cancel}</AlertDialogCancel>
            <AlertDialogAction className="corner-brackets" onClick={suggest}>
              {t.homework.aiFeedback.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function ReadOnlyCard({ assignment, t }: { assignment: AssignmentDetail; t: Messages }) {
  const reviewed = assignment.status === 'graded'

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheckIcon className="text-muted-foreground size-4" />
          {t.homework.evaluation.title}
        </CardTitle>
        <CardDescription>{t.homework.readOnly}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/35 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm">
          <CheckCircle2Icon
            className={cn(
              'mt-0.5 size-4 shrink-0',
              reviewed ? 'text-emerald-600' : 'text-muted-foreground',
            )}
          />
          <span>{reviewed ? t.homework.evaluation.reviewed : t.homework.evaluation.pending}</span>
        </div>

        <AssignmentNote assignment={assignment} t={t} />

        <Field>
          <FieldTitle>{t.homework.evaluation.feedback}</FieldTitle>
          <p
            className={cn(
              'whitespace-pre-wrap text-sm leading-relaxed',
              !assignment.feedback && 'text-muted-foreground',
            )}
          >
            {assignment.feedback ?? t.homework.evaluation.feedbackEmpty}
          </p>
        </Field>
      </CardContent>
    </Card>
  )
}

'use client'

import Link from 'next/link'
import { useRef, useState, useTransition } from 'react'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, Loader2Icon, XIcon } from 'lucide-react'
import { GRADED_BLOCK_TYPES, type StepCheckResult, type StudentMaterial } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { checkStep } from '../actions'
import { BlockRenderer } from '../blocks/block-renderer'

const GRADED = new Set<string>(GRADED_BLOCK_TYPES)

type StepAnswers = Record<string, unknown>

/**
 * One step at a time, because that is what a lesson is: a sequence, not a page. The step
 * is the unit of attention — everything on it is meant to be seen together, and what comes
 * next is meant not to be seen yet.
 *
 * Marking is a round trip. The answer key never reaches this component, which is the point:
 * a student with the developer tools open sees the questions and nothing else.
 *
 * The same player serves three occasions. Opened from the library it remembers nothing.
 * Opened as homework it is handed what the student answered so far and told whom to tell
 * about each step; the last page hands the work in instead of leaving. Opened by the
 * teacher afterwards it is read-only: every answer locked, every mark shown.
 */
export function MaterialPlayer({
  material,
  backHref,
  onExit,
  initialAnswers,
  initialResults,
  onCheck,
  onLeaveStep,
  submit,
  readOnly = false,
  compactHeader = false,
  t,
}: {
  material: StudentMaterial
  /** Where "finish" goes when the player is a page of its own. */
  backHref?: string
  /** What "finish" does when the player is opened on top of the editor. */
  onExit?: () => void
  /** Answers already given, by step then by block. */
  initialAnswers?: Record<string, StepAnswers>
  /** Marks already earned, for the steps that were checked. */
  initialResults?: Record<string, StepCheckResult>
  /** Marks a step. The library's stateless check unless the caller has somewhere to record it. */
  onCheck?: (
    stepId: string,
    answers: StepAnswers,
  ) => Promise<{ result: StepCheckResult | null; error: string | null }>
  /** A step left before being checked. What was typed there should not be lost. */
  onLeaveStep?: (stepId: string, answers: StepAnswers) => void
  /** On the last step, hand the work in rather than leave. */
  submit?: { label: string; pending: boolean; onSubmit: () => void }
  /** Nothing can be answered or checked; everything can be seen. */
  readOnly?: boolean
  /** The page already has a heading for this lesson: show the step, not the title again. */
  compactHeader?: boolean
  t: Messages
}) {
  const [index, setIndex] = useState(0)
  const top = useRef<HTMLDivElement>(null)
  const [answers, setAnswers] = useState<Record<string, StepAnswers>>(initialAnswers ?? {})
  const [results, setResults] = useState<Record<string, StepCheckResult>>(initialResults ?? {})
  const [failed, setFailed] = useState(false)
  const [checking, startChecking] = useTransition()

  const step = material.steps[index]
  const total = material.steps.length
  const last = index === total - 1

  // The way out, in whichever form this player was given one.
  const exit = (label: string, variant: 'default' | 'outline' = 'outline') =>
    onExit ? (
      <Button
        type="button"
        size="sm"
        variant={variant}
        onClick={onExit}
        className="corner-brackets"
      >
        {label}
      </Button>
    ) : (
      <Button asChild size="sm" variant={variant}>
        <Link href={backHref ?? '/library'} className="corner-brackets">
          {label}
        </Link>
      </Button>
    )

  if (!step) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 py-16 text-center">
        <p className="text-muted-foreground text-sm">{t.library.detail.noSteps}</p>
        {exit(t.library.player.exit)}
      </div>
    )
  }

  const result = results[step.id]
  const stepAnswers = answers[step.id] ?? {}
  const markable = step.blocks.some((block) => GRADED.has(block.type))
  const locked = readOnly || checking || Boolean(result)

  const setAnswer = (blockId: string, value: unknown) =>
    setAnswers((current) => ({
      ...current,
      [step.id]: { ...(current[step.id] ?? {}), [blockId]: value },
    }))

  const check = () =>
    startChecking(async () => {
      setFailed(false)
      const mark = onCheck ?? ((stepId, given) => checkStep(material.id, stepId, given))
      const { result: graded, error } = await mark(step.id, stepAnswers)

      if (error || !graded) {
        setFailed(true)
        return
      }

      setResults((current) => ({ ...current, [step.id]: graded }))
    })

  const move = (delta: number) => {
    // Leaving a step with unchecked answers on it: tell whoever is keeping them.
    if (!result && !readOnly && Object.keys(stepAnswers).length > 0) {
      onLeaveStep?.(step.id, stepAnswers)
    }

    setIndex((current) => Math.min(Math.max(current + delta, 0), total - 1))
    // A new step starts at the top. Landing halfway down the next exercise because the
    // last one was long is disorienting in a way nobody reports but everybody feels.
    // Scrolled by element rather than by window, so it works inside an overlay too.
    top.current?.scrollIntoView({ block: 'start' })
  }

  const allRight = result ? result.autoScore === result.autoMax : false
  // Handing in is the one action that must not be a reflex: it is offered plainly only
  // once the step in front of the student is marked or has nothing to mark.
  const settled = Boolean(result) || !markable

  return (
    <div ref={top} className="mx-auto flex w-full max-w-3xl scroll-mt-4 flex-col gap-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {compactHeader ? <span /> : <h1 className="text-xl font-semibold">{material.title}</h1>}

          <span className="text-muted-foreground text-xs tabular-nums">
            {t.library.player.step} {index + 1} {t.library.player.of} {total}
          </span>
        </div>

        <Progress value={((index + 1) / total) * 100} className="h-1" />

        {step.title ? <h2 className="pt-1 text-lg font-medium">{step.title}</h2> : null}
      </header>

      <div className="flex flex-col gap-5">
        {step.blocks.map((block) => (
          <BlockRenderer
            key={block.id}
            block={block}
            answer={stepAnswers[block.id]}
            onAnswer={(value) => setAnswer(block.id, value)}
            result={result?.byBlock[block.id]}
            // Locked once marked: an answer that can be edited after the tick appears is
            // not an answer, and the score beside it would immediately be a lie.
            locked={locked}
            t={t}
          />
        ))}
      </div>

      {result ? (
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border p-4 text-sm',
            allRight
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-amber-500/40 bg-amber-500/5',
          )}
        >
          {allRight ? (
            <CheckIcon className="size-4 text-emerald-600" />
          ) : (
            <XIcon className="size-4 text-amber-600" />
          )}

          <span className="font-medium">
            {result.autoScore} / {result.autoMax} {t.library.player.correctOf}
          </span>

          <span className="text-muted-foreground">
            {allRight ? t.library.player.allCorrect : t.library.player.someWrong}
          </span>

          {result.manualMax > 0 && !readOnly ? (
            <span className="text-muted-foreground">· {t.library.player.awaitingTeacher}</span>
          ) : null}
        </div>
      ) : null}

      {failed ? <p className="text-destructive text-sm">{t.library.player.checkFailed}</p> : null}

      {/* Sticky, because a long step would otherwise put the only way forward below the
          fold of a phone — and a lesson you have to scroll to leave is a lesson people
          leave by closing the tab. */}
      <footer className="bg-background/85 sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={index === 0}
          onClick={() => move(-1)}
        >
          <ChevronLeftIcon className="size-4" />
          {t.library.player.previous}
        </Button>

        <div className="flex items-center gap-2">
          {markable && !result && !readOnly ? (
            <Button
              type="button"
              size="sm"
              disabled={checking}
              onClick={check}
              className="corner-brackets"
            >
              {checking ? t.library.player.checking : t.library.player.check}
            </Button>
          ) : null}

          {last ? (
            submit && !readOnly ? (
              <Button
                type="button"
                size="sm"
                variant={settled ? 'default' : 'outline'}
                disabled={submit.pending || checking}
                onClick={() => {
                  if (!result && Object.keys(stepAnswers).length > 0) {
                    onLeaveStep?.(step.id, stepAnswers)
                  }
                  submit.onSubmit()
                }}
                className="corner-brackets"
              >
                {submit.pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {submit.label}
              </Button>
            ) : (
              exit(t.library.player.finish, settled ? 'default' : 'outline')
            )
          ) : (
            <Button
              type="button"
              size="sm"
              variant={settled ? 'default' : 'outline'}
              onClick={() => move(1)}
              className="corner-brackets"
            >
              {t.library.player.next}
              <ChevronRightIcon className="size-4" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}

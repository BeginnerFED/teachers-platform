'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
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
type StepUi = Record<string, unknown>

/**
 * One step at a time, because that is what a lesson is: a sequence, not a page. The step
 * is the unit of attention — everything on it is meant to be seen together, and what comes
 * next is meant not to be seen yet.
 *
 * Marking is a round trip. The answer key never reaches this component, which is the point:
 * a student with the developer tools open sees the questions and nothing else.
 *
 * The same player serves four occasions. Opened from the library it remembers nothing.
 * Opened as homework it is handed what the student answered so far and told whom to tell
 * about each step; the last page hands the work in instead of leaving. Opened by the
 * teacher afterwards it is read-only: every answer locked, every mark shown. Opened in a
 * live lesson it owns nothing at all — the step, the answers, the marks and the state of
 * every block are handed to it from the room's shared board, and every change goes back
 * there.
 */
export function MaterialPlayer({
  material,
  backHref,
  onExit,
  initialAnswers,
  initialResults,
  answers: controlledAnswers,
  onAnswer,
  results: controlledResults,
  ui,
  onUi,
  leads = true,
  onCheck,
  onLeaveStep,
  submit,
  readOnly = false,
  disabled = false,
  reviewed = false,
  compactHeader = false,
  index: controlledIndex,
  onIndexChange,
  canNavigate = true,
  canCheck = true,
  canFinish = true,
  t,
}: {
  material: StudentMaterial
  /** Where "finish" goes when the player is a page of its own. */
  backHref?: string
  /** What "finish" does when the player is opened on top of the editor. */
  onExit?: () => void
  /** Answers already given, by step then by block, when the player keeps them itself. */
  initialAnswers?: Record<string, StepAnswers>
  /** Marks already earned, for the steps that were checked, when the player keeps them itself. */
  initialResults?: Record<string, StepCheckResult>
  /** The answers, when something outside — a live lesson — keeps them. */
  answers?: Record<string, StepAnswers>
  /** Told of every answer, when something outside keeps them. */
  onAnswer?: (stepId: string, blockId: string, value: unknown) => void
  /** The marks, when something outside keeps them. */
  results?: Record<string, StepCheckResult>
  /** The state of every block that is not an answer, by step then by block, when shared. */
  ui?: Record<string, StepUi>
  /** Told of every change to a block's own state, when shared. */
  onUi?: (stepId: string, blockId: string, value: unknown) => void
  /** Whether this browser drives the clocks in timed games. */
  leads?: boolean
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
  /** Temporarily lock interaction while homework finishes saving and submitting. */
  disabled?: boolean
  /** The teacher has finished reviewing the homework's written answers. */
  reviewed?: boolean
  /** The page already has a heading for this lesson: show the step, not the title again. */
  compactHeader?: boolean
  /** Which step to show, when something outside — a live lesson — decides that. */
  index?: number
  /** Told when the reader moves, so a live lesson can carry everyone else along. */
  onIndexChange?: (index: number) => void
  /** Whether the reader may move between steps at all. A guest in a live lesson may not. */
  canNavigate?: boolean
  /**
   * Whether the reader may have the step marked. In a live lesson that locks everybody's
   * answers, so it is the host's call.
   */
  canCheck?: boolean
  /** Whether the last step offers a way out. A guest in a live lesson has none to take. */
  canFinish?: boolean
  t: Messages
}) {
  const [ownIndex, setOwnIndex] = useState(0)
  // Driven from outside when a live lesson says so; otherwise the reader's own.
  const controlled = controlledIndex !== undefined
  const index = controlledIndex ?? ownIndex
  const top = useRef<HTMLDivElement>(null)
  const previousStepIndex = useRef(index)
  const [ownAnswers, setOwnAnswers] = useState<Record<string, StepAnswers>>(initialAnswers ?? {})
  const [ownResults, setOwnResults] = useState<Record<string, StepCheckResult>>(
    initialResults ?? {},
  )
  const answers = controlledAnswers ?? ownAnswers
  const results = controlledResults ?? ownResults
  const [failed, setFailed] = useState(false)
  const [checking, startChecking] = useTransition()

  // The scene is keyed by step, so this ref runs when the page changes. Set the direction
  // during the commit: the new scene then gets the right entrance before its first paint,
  // including when a live host turns the page for everybody else.
  const setStepScene = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return
      node.dataset.direction = index < previousStepIndex.current ? 'backward' : 'forward'
      previousStepIndex.current = index
    },
    [index],
  )

  // A step turned from outside starts at the top too. Not on arrival: the page the player
  // sits in has its own heading, and jumping past it on the first paint would be rude.
  const arrived = useRef(false)
  useEffect(() => {
    if (!controlled) return
    if (!arrived.current) {
      arrived.current = true
      return
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    top.current?.scrollIntoView({
      block: 'start',
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }, [controlled, index])

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
  const stepUi = ui?.[step.id]
  const markable = step.blocks.some((block) => GRADED.has(block.type))
  const locked = readOnly || disabled || checking || Boolean(result)

  const setAnswer = (blockId: string, value: unknown) => {
    if (onAnswer) {
      onAnswer(step.id, blockId, value)
      return
    }

    setOwnAnswers((current) => ({
      ...current,
      [step.id]: { ...(current[step.id] ?? {}), [blockId]: value },
    }))
  }

  const check = () =>
    startChecking(async () => {
      setFailed(false)
      const mark = onCheck ?? ((stepId, given) => checkStep(material.id, stepId, given))
      const { result: graded, error } = await mark(step.id, stepAnswers)

      if (error || !graded) {
        setFailed(true)
        return
      }

      // Kept here unless somebody outside keeps the marks, in which case they arrive
      // from there — for everyone at once.
      if (!controlledResults) setOwnResults((current) => ({ ...current, [step.id]: graded }))
    })

  const move = (delta: number) => {
    // Leaving a step with unchecked answers on it: tell whoever is keeping them.
    if (!result && !readOnly && Object.keys(stepAnswers).length > 0) {
      onLeaveStep?.(step.id, stepAnswers)
    }

    const next = Math.min(Math.max(index + delta, 0), total - 1)
    if (!controlled) {
      setOwnIndex(next)
      // A new step starts at the top. Landing halfway down the next exercise because the
      // last one was long is disorienting in a way nobody reports but everybody feels.
      // Scrolled by element rather than by window, so it works inside an overlay too.
      top.current?.scrollIntoView({ block: 'start' })
    }
    onIndexChange?.(next)
  }

  // The learner sees correctness, not a hidden point calculation. Derive the summary from
  // the same per-answer checks that are visible beside each exercise.
  const blockResults = result ? Object.values(result.byBlock) : []
  const automaticResults = blockResults.filter((blockResult) => !blockResult.manual)
  const hasAutomaticResults = automaticResults.length > 0
  const allRight =
    hasAutomaticResults &&
    automaticResults.every((blockResult) => Object.values(blockResult.parts).every(Boolean))
  const awaitsTeacher = blockResults.some((blockResult) => blockResult.manual)
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

        <Progress
          value={((index + 1) / total) * 100}
          aria-label={`${t.library.player.step} ${index + 1} ${t.library.player.of} ${total}`}
          className="lesson-progress h-1"
        />
      </header>

      <div
        key={step.id}
        ref={setStepScene}
        data-direction="forward"
        className="lesson-step-enter flex flex-col gap-6"
      >
        {step.title ? <h2 className="-mt-2 text-lg font-medium">{step.title}</h2> : null}

        <div className="flex flex-col gap-5">
          {/* Each block is named in the DOM, so a live lesson can say where somebody is
            looking, typing or selecting in terms every screen understands. */}
          {step.blocks.map((block, blockIndex) => (
            <div
              key={block.id}
              data-block-id={block.id}
              className="lesson-block-enter"
              style={{ animationDelay: `${Math.min(blockIndex * 35, 140)}ms` }}
            >
              <BlockRenderer
                block={block}
                answer={stepAnswers[block.id]}
                onAnswer={(value) => setAnswer(block.id, value)}
                result={result?.byBlock[block.id]}
                // Locked once checked: changing an answer after its correctness appears would
                // make the saved review disagree with the work shown on screen.
                locked={locked}
                reviewed={reviewed}
                ui={stepUi?.[block.id]}
                onUi={onUi ? (value) => onUi(step.id, block.id, value) : undefined}
                leads={leads}
                t={t}
              />
            </div>
          ))}
        </div>

        {result && hasAutomaticResults ? (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              'lesson-feedback-enter flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border p-4 text-sm',
              allRight
                ? 'border-emerald-500/40 bg-emerald-500/5'
                : 'border-amber-500/40 bg-amber-500/5',
            )}
          >
            {allRight ? (
              <CheckIcon className="lesson-result-icon size-4 text-emerald-600" />
            ) : (
              <XIcon className="lesson-result-icon size-4 text-amber-600" />
            )}

            <span className="font-medium">
              {allRight ? t.library.player.allCorrect : t.library.player.someWrong}
            </span>

            {awaitsTeacher && !readOnly ? (
              <span className="text-muted-foreground">· {t.library.player.awaitingTeacher}</span>
            ) : null}
          </div>
        ) : null}

        {failed ? (
          <p role="alert" className="lesson-feedback-enter text-destructive text-sm">
            {t.library.player.checkFailed}
          </p>
        ) : null}
      </div>

      {/* Sticky, because a long step would otherwise put the only way forward below the
          fold of a phone — and a lesson you have to scroll to leave is a lesson people
          leave by closing the tab. */}
      <footer className="bg-background/85 sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-4">
        {/* Somebody who does not turn the pages has nothing on this side; the step is
            already named in the header. */}
        {canNavigate ? (
          <Button
            type="button"
            variant="ghost"
            disabled={disabled || index === 0}
            onClick={() => move(-1)}
          >
            <ChevronLeftIcon className="size-4" />
            {t.library.player.previous}
          </Button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-2">
          {markable && !result && !readOnly && canCheck ? (
            <Button
              type="button"
              size="sm"
              disabled={disabled || checking}
              onClick={check}
              className="corner-brackets"
            >
              {checking ? t.library.player.checking : t.library.player.check}
            </Button>
          ) : null}

          {!canNavigate ? null : last ? (
            !canFinish ? null : submit && !readOnly ? (
              <Button
                type="button"
                size="sm"
                variant={settled ? 'default' : 'outline'}
                disabled={disabled || submit.pending || checking}
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
              disabled={disabled}
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

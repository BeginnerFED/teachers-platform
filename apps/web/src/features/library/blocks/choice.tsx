'use client'

import { useEffect } from 'react'
import { CheckIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import { ExerciseShell } from './shell'
import {
  advanceGame,
  IDLE_GAME,
  startGame,
  timedGameShape,
  TONE_CLASS,
  toneFor,
  useBlockState,
  useCountdown,
  type BlockProps,
  type TimedGame,
} from './types'

/** Blocks where the answer is one of a set of things the author wrote down. */

const asArray = (answer: unknown): string[] =>
  Array.isArray(answer) ? answer.filter((v): v is string => typeof v === 'string') : []

const asMap = (answer: unknown): Record<string, unknown> =>
  answer !== null && typeof answer === 'object' && !Array.isArray(answer)
    ? (answer as Record<string, unknown>)
    : {}

/**
 * A row that is a whole tap target, because a phone is the hard case. Exported for the
 * editor, which draws the author's options as exactly these rows.
 */
export function OptionRow({
  checked,
  tone,
  disabled,
  onSelect,
  control,
  children,
}: {
  checked: boolean
  tone: 'correct' | 'wrong' | undefined
  disabled?: boolean
  onSelect: () => void
  control: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label
      data-disabled={disabled || undefined}
      className={cn(
        'lesson-answer-control flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm',
        tone ? TONE_CLASS[tone] : checked ? TONE_CLASS.chosen : TONE_CLASS.idle,
        disabled && 'cursor-default',
      )}
      onClick={(event) => {
        // The label already forwards a click to its control; this only catches taps on
        // the padding, which on a phone is most of the row.
        if (!disabled && event.target === event.currentTarget) onSelect()
      }}
    >
      {control}
      <span className="flex-1 leading-snug">{children}</span>
      {tone === 'correct' ? <CheckIcon className="size-4 shrink-0 text-emerald-600" /> : null}
      {tone === 'wrong' ? <XIcon className="text-destructive size-4 shrink-0" /> : null}
    </label>
  )
}

export function MultipleChoiceBlock({
  block,
  answer,
  onAnswer,
  result,
  locked,
  t,
}: BlockProps<'multiple_choice'>) {
  const chosen = asArray(answer)
  // Marked as one unit whether it takes one answer or several, so the whole block is
  // green or red rather than each option.
  const tone = toneFor(result, block.id)

  const toggle = (optionId: string) => {
    if (locked) return

    if (block.multiple) {
      onAnswer(
        chosen.includes(optionId) ? chosen.filter((id) => id !== optionId) : [...chosen, optionId],
      )
    } else {
      onAnswer([optionId])
    }
  }

  return (
    <ExerciseShell
      label={block.multiple ? t.library.blocks.selectMany : t.library.blocks.selectOne}
      prompt={block.prompt}
      result={result}
    >
      <div className="space-y-2">
        {block.options.map((option) => {
          const checked = chosen.includes(option.id)

          return (
            <OptionRow
              key={option.id}
              checked={checked}
              tone={checked || tone === 'correct' ? tone : undefined}
              disabled={locked}
              onSelect={() => toggle(option.id)}
              control={
                block.multiple ? (
                  <Checkbox
                    checked={checked}
                    disabled={locked}
                    onCheckedChange={() => toggle(option.id)}
                    className="mt-0.5"
                  />
                ) : (
                  <input
                    type="radio"
                    name={block.id}
                    checked={checked}
                    disabled={locked}
                    onChange={() => toggle(option.id)}
                    className="border-input text-primary accent-primary mt-0.5 size-4"
                  />
                )
              }
            >
              {option.text}
            </OptionRow>
          )
        })}
      </div>
    </ExerciseShell>
  )
}

export function TrueFalseBlock({
  block,
  answer,
  onAnswer,
  result,
  locked,
  t,
}: BlockProps<'true_false'>) {
  const given = asMap(answer)

  return (
    <ExerciseShell label={t.library.blocks.trueFalse} prompt={block.prompt} result={result}>
      <ul className="space-y-2">
        {block.statements.map((statement) => {
          const value = given[statement.id]
          const tone = toneFor(result, statement.id)

          return (
            <li
              key={statement.id}
              data-disabled={locked || undefined}
              className={cn(
                'lesson-answer-control flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm',
                tone ? TONE_CLASS[tone] : 'border-border',
              )}
            >
              <span className="flex-1 leading-snug">{statement.text}</span>

              <RadioGroup
                value={value === true ? 'true' : value === false ? 'false' : ''}
                onValueChange={(next) =>
                  !locked && onAnswer({ ...given, [statement.id]: next === 'true' })
                }
                disabled={locked}
                className="flex shrink-0 gap-4"
              >
                {(['true', 'false'] as const).map((option) => (
                  <label key={option} className="flex cursor-pointer items-center gap-1.5 text-xs">
                    <RadioGroupItem value={option} />
                    {option === 'true' ? t.library.blocks.isTrue : t.library.blocks.isFalse}
                  </label>
                ))}
              </RadioGroup>
            </li>
          )
        })}
      </ul>
    </ExerciseShell>
  )
}

/**
 * The same questions as a multiple choice, one at a time and against a clock. Running out
 * of time moves on rather than blocking: the point of the format is pace.
 *
 * The clock is a moment in time — when the question came up — rather than a count that
 * ticks. That is what lets a room share it: every browser reads the same moment and draws
 * the same seconds left, and only the one that leads decides that time is up.
 */
export function QuizGameBlock({
  block,
  answer,
  onAnswer,
  result,
  locked,
  ui,
  onUi,
  leads = true,
  t,
}: BlockProps<'quiz_game'>) {
  const given = asMap(answer)
  const [game, setGame] = useBlockState<TimedGame>(ui, onUi, IDLE_GAME, timedGameShape)
  const { started, index } = game

  const question = block.questions[index]
  const finished = started && index >= block.questions.length
  const running = started && !finished && !locked
  const remaining = useCountdown(game, block.secondsPerQuestion, running)

  const advance = () => setGame(advanceGame(game))

  useEffect(() => {
    if (!running || !leads) return

    // Running out of time moves on, and that decision is taken inside the timer rather
    // than in the effect body: a setState in the body of an effect is a cascading render.
    // The timer is armed from the moment the question came up, so re-arming it on a
    // render costs nothing and drifts nowhere.
    const left = game.startedAt + block.secondsPerQuestion * 1000 - Date.now()
    const timer = setTimeout(() => setGame(advanceGame(game)), Math.max(left, 0))

    return () => clearTimeout(timer)
  }, [running, leads, game, block.secondsPerQuestion, setGame])

  // Once the step has been marked, showing the clock again would be nonsense.
  const showReview = Boolean(result) || locked

  if (showReview) {
    return (
      <ExerciseShell label={t.library.blocks.quiz} prompt={block.prompt} result={result}>
        <ul className="space-y-2">
          {block.questions.map((item) => {
            const tone = toneFor(result, item.id)
            const picked = item.options.find((option) => option.id === given[item.id])

            return (
              <li
                key={item.id}
                className={cn(
                  'rounded-md border p-3 text-sm',
                  tone ? TONE_CLASS[tone] : 'border-border',
                )}
              >
                <p className="font-medium">{item.prompt}</p>
                <p className="text-muted-foreground mt-1 text-xs">{picked?.text ?? '—'}</p>
              </li>
            )
          })}
        </ul>
      </ExerciseShell>
    )
  }

  if (!started) {
    return (
      <ExerciseShell label={t.library.blocks.quiz} prompt={block.prompt} result={result}>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => setGame(startGame())} className="corner-brackets">
            {t.library.blocks.quizStart}
          </Button>
          <span className="text-muted-foreground text-xs tabular-nums">
            {block.questions.length} × {block.secondsPerQuestion}
            {t.library.blocks.seconds}
          </span>
        </div>
      </ExerciseShell>
    )
  }

  if (finished || !question) {
    return (
      <ExerciseShell label={t.library.blocks.quiz} prompt={block.prompt} result={result}>
        <p className="text-muted-foreground text-sm">
          {Object.keys(given).length} / {block.questions.length}
        </p>
      </ExerciseShell>
    )
  }

  return (
    <ExerciseShell label={t.library.blocks.quiz} prompt={block.prompt} result={result}>
      <div key={question.id} className="lesson-inline-enter space-y-3">
        <div className="flex items-center gap-3">
          <Progress
            value={(remaining / block.secondsPerQuestion) * 100}
            className="lesson-progress h-1.5"
          />
          <span className="text-muted-foreground w-10 shrink-0 text-right text-xs tabular-nums">
            {remaining}
            {t.library.blocks.seconds}
          </span>
        </div>

        <p className="text-sm font-medium">
          <span className="text-muted-foreground mr-2 tabular-nums">
            {index + 1}/{block.questions.length}
          </span>
          {question.prompt}
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          {question.options.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant="outline"
              className="corner-brackets h-auto justify-start whitespace-normal py-2.5 text-left"
              onClick={() => {
                onAnswer({ ...given, [question.id]: option.id })
                advance()
              }}
            >
              {option.text}
            </Button>
          ))}
        </div>
      </div>
    </ExerciseShell>
  )
}

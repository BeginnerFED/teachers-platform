'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react'
import { GRADED_BLOCK_TYPES, type StepCheckResult, type StudentMaterial } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { checkStep } from '../actions'
import { BlockRenderer } from '../blocks/block-renderer'

const GRADED = new Set<string>(GRADED_BLOCK_TYPES)

/**
 * One step at a time, because that is what a lesson is: a sequence, not a page. The step
 * is the unit of attention — everything on it is meant to be seen together, and what comes
 * next is meant not to be seen yet.
 *
 * Marking is a round trip. The answer key never reaches this component, which is the point:
 * a student with the developer tools open sees the questions and nothing else.
 */
export function MaterialPlayer({
  material,
  backHref,
  t,
}: {
  material: StudentMaterial
  backHref: string
  t: Messages
}) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>({})
  const [results, setResults] = useState<Record<string, StepCheckResult>>({})
  const [failed, setFailed] = useState(false)
  const [checking, startChecking] = useTransition()

  const step = material.steps[index]
  const total = material.steps.length
  const last = index === total - 1

  if (!step) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 py-16 text-center">
        <p className="text-muted-foreground text-sm">{t.library.detail.noSteps}</p>
        <Button asChild variant="outline" className="corner-brackets">
          <Link href={backHref}>{t.library.player.exit}</Link>
        </Button>
      </div>
    )
  }

  const result = results[step.id]
  const stepAnswers = answers[step.id] ?? {}
  const markable = step.blocks.some((block) => GRADED.has(block.type))

  const setAnswer = (blockId: string, value: unknown) =>
    setAnswers((current) => ({
      ...current,
      [step.id]: { ...(current[step.id] ?? {}), [blockId]: value },
    }))

  const check = () =>
    startChecking(async () => {
      setFailed(false)
      const { result: graded, error } = await checkStep(material.id, step.id, stepAnswers)

      if (error || !graded) {
        setFailed(true)
        return
      }

      setResults((current) => ({ ...current, [step.id]: graded }))
    })

  const move = (delta: number) => {
    setIndex((current) => Math.min(Math.max(current + delta, 0), total - 1))
    // A new step starts at the top. Landing halfway down the next exercise because the
    // last one was long is disorienting in a way nobody reports but everybody feels.
    window.scrollTo({ top: 0 })
  }

  const allRight = result ? result.autoScore === result.autoMax : false

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold">{material.title}</h1>

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
            locked={checking || Boolean(result)}
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

          {result.manualMax > 0 ? (
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
          {markable && !result ? (
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
            <Button asChild size="sm" variant={result || !markable ? 'default' : 'outline'}>
              <Link href={backHref} className="corner-brackets">
                {t.library.player.finish}
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant={result || !markable ? 'default' : 'outline'}
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

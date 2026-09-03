'use client'

import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, RotateCcwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ExerciseShell } from './shell'
import { TONE_CLASS, toneFor, type BlockProps } from './types'

/**
 * Blocks answered by putting things in order or in groups.
 *
 * All of them work by tapping — pick a thing, then pick where it goes — rather than by
 * dragging. On a phone a drag competes with the page's own scroll, and a tap target is
 * usable with one thumb on a bus, which is where a lot of homework actually happens.
 */

const asMap = (answer: unknown): Record<string, string> =>
  answer !== null && typeof answer === 'object' && !Array.isArray(answer)
    ? (answer as Record<string, string>)
    : {}

const asArray = (answer: unknown): string[] =>
  Array.isArray(answer) ? answer.filter((v): v is string => typeof v === 'string') : []

function ResetButton({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className="text-muted-foreground h-7 gap-1.5 px-2 text-xs"
    >
      <RotateCcwIcon className="size-3" />
      {label}
    </Button>
  )
}

export function MatchingBlock({
  block,
  answer,
  onAnswer,
  result,
  locked,
  t,
}: BlockProps<'matching'>) {
  const given = asMap(answer)
  const [picked, setPicked] = useState<string | null>(null)

  // The right-hand column arrives shuffled from the server and carries no ids, so what is
  // stored is the text itself — which is also all that distinguishes two cards to a reader.
  const takenBy = (text: string) => block.lefts.find((left) => given[left.id] === text)

  const assign = (text: string) => {
    if (locked || !picked) return

    // One card, one place. Choosing a card that is already used moves it.
    const next = Object.fromEntries(Object.entries(given).filter(([, value]) => value !== text))
    onAnswer({ ...next, [picked]: text })
    setPicked(null)
  }

  return (
    <ExerciseShell
      label={t.library.blocks.matchPairs}
      prompt={block.prompt}
      hint={t.library.blocks.matchHint}
      result={result}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <ul className="space-y-2">
          {block.lefts.map((left) => {
            const tone = toneFor(result, left.id)
            const chosen = picked === left.id

            return (
              <li key={left.id}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => setPicked(chosen ? null : left.id)}
                  className={cn(
                    'w-full rounded-md border p-3 text-left text-sm transition-colors',
                    tone ? TONE_CLASS[tone] : chosen ? TONE_CLASS.chosen : TONE_CLASS.idle,
                  )}
                >
                  <span className="block font-medium">{left.text}</span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    {given[left.id] ?? '—'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <ul className="flex flex-wrap content-start gap-2">
          {block.rights.map((text) => {
            const owner = takenBy(text)

            return (
              <li key={text}>
                <button
                  type="button"
                  disabled={locked || !picked}
                  onClick={() => assign(text)}
                  className={cn(
                    'rounded-md border px-3 py-2 text-sm transition-colors',
                    owner
                      ? 'border-primary/40 bg-primary/5 text-muted-foreground'
                      : TONE_CLASS.idle,
                    !picked && !locked && 'opacity-60',
                  )}
                >
                  {text}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {!locked ? (
        <div className="mt-3 flex justify-end">
          <ResetButton
            label={t.library.blocks.reset}
            onClick={() => {
              onAnswer({})
              setPicked(null)
            }}
          />
        </div>
      ) : null}
    </ExerciseShell>
  )
}

export function CategorizeBlock({
  block,
  answer,
  onAnswer,
  result,
  locked,
  t,
}: BlockProps<'categorize'>) {
  const given = asMap(answer)
  const [picked, setPicked] = useState<string | null>(null)

  const unplaced = block.items.filter((item) => !given[item.id])

  return (
    <ExerciseShell
      label={t.library.blocks.categorise}
      prompt={block.prompt}
      hint={t.library.blocks.categoriseHint}
      result={result}
    >
      <ul className="mb-3 flex flex-wrap gap-2">
        {unplaced.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              disabled={locked}
              onClick={() => setPicked(picked === item.id ? null : item.id)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm transition-colors',
                picked === item.id ? TONE_CLASS.chosen : TONE_CLASS.idle,
              )}
            >
              {item.text}
            </button>
          </li>
        ))}
        {unplaced.length === 0 ? <li className="text-muted-foreground text-xs">—</li> : null}
      </ul>

      <div className="grid gap-3 sm:grid-cols-2">
        {block.categories.map((category) => (
          <div
            key={category.id}
            className={cn(
              'min-h-24 rounded-md border p-3 transition-colors',
              picked && !locked && 'border-primary/50 bg-primary/[0.03] cursor-pointer',
            )}
            onClick={() => {
              if (locked || !picked) return
              onAnswer({ ...given, [picked]: category.id })
              setPicked(null)
            }}
          >
            <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              {category.label}
            </p>

            <ul className="flex flex-wrap gap-1.5">
              {block.items
                .filter((item) => given[item.id] === category.id)
                .map((item) => {
                  const tone = toneFor(result, item.id)

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (locked) return
                          // Tapping a placed word takes it back out, which is how you fix
                          // a mistake without a reset that throws away everything.
                          const next = { ...given }
                          delete next[item.id]
                          onAnswer(next)
                        }}
                        className={cn(
                          'rounded border px-2 py-1 text-xs',
                          tone ? TONE_CLASS[tone] : 'border-border bg-background',
                        )}
                      >
                        {item.text}
                      </button>
                    </li>
                  )
                })}
            </ul>
          </div>
        ))}
      </div>
    </ExerciseShell>
  )
}

export function SentenceBuilderBlock({
  block,
  answer,
  onAnswer,
  result,
  locked,
  t,
}: BlockProps<'sentence_builder'>) {
  const built = asArray(answer)
  const tone = toneFor(result, block.id)

  // Positional, not by value: "the" can legitimately appear twice, and matching by text
  // would grey out both the moment one is used.
  const usedIndexes = new Set<number>()
  for (const token of built) {
    const index = block.tokens.findIndex(
      (candidate, position) => candidate === token && !usedIndexes.has(position),
    )
    if (index !== -1) usedIndexes.add(index)
  }

  return (
    <ExerciseShell
      label={t.library.blocks.buildSentence}
      prompt={block.prompt}
      hint={t.library.blocks.buildHint}
      result={result}
    >
      <div
        className={cn(
          'mb-3 flex min-h-14 flex-wrap items-center gap-1.5 rounded-md border p-3',
          tone ? TONE_CLASS[tone] : 'border-dashed',
        )}
      >
        {built.length === 0 ? <span className="text-muted-foreground text-xs">—</span> : null}

        {built.map((token, index) => (
          <button
            key={`${token}-${index}`}
            type="button"
            disabled={locked}
            onClick={() => onAnswer(built.filter((_, position) => position !== index))}
            className="bg-background rounded border px-2.5 py-1 text-sm"
          >
            {token}
          </button>
        ))}
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {block.tokens.map((token, index) => (
          <li key={`${token}-${index}`}>
            <button
              type="button"
              disabled={locked || usedIndexes.has(index)}
              onClick={() => onAnswer([...built, token])}
              className={cn(
                'rounded-md border px-2.5 py-1.5 text-sm transition-colors',
                usedIndexes.has(index) ? 'text-muted-foreground/40 border-dashed' : TONE_CLASS.idle,
              )}
            >
              {token}
            </button>
          </li>
        ))}
      </ul>
    </ExerciseShell>
  )
}

/** Practice rather than assessment: it carries no marks, so it asks for no answer. */
export function FlashcardsBlock({ block, t }: BlockProps<'flashcards'>) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const card = block.cards[index]
  if (!card) return null

  const move = (delta: number) => {
    setIndex((current) => (current + delta + block.cards.length) % block.cards.length)
    setFlipped(false)
  }

  return (
    <ExerciseShell label={t.library.blocks.flashcards} prompt={block.prompt}>
      <button
        type="button"
        onClick={() => setFlipped((value) => !value)}
        className="bg-muted/30 hover:bg-muted/50 flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border p-6 text-center transition-colors"
      >
        <span className="text-lg font-medium">{flipped ? card.back : card.front}</span>
        {flipped && card.hint ? (
          <span className="text-muted-foreground text-xs">{card.hint}</span>
        ) : (
          <span className="text-muted-foreground text-[11px] uppercase tracking-wide">
            {t.library.blocks.flip}
          </span>
        )}
      </button>

      <div className="mt-3 flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={() => move(-1)}>
          <ChevronLeftIcon className="size-4" />
        </Button>

        <span className="text-muted-foreground text-xs tabular-nums">
          {t.library.blocks.card} {index + 1} / {block.cards.length}
        </span>

        <Button type="button" variant="ghost" size="sm" onClick={() => move(1)}>
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
    </ExerciseShell>
  )
}

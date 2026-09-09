'use client'

import { useState } from 'react'
import { CheckIcon, RotateCcwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ExerciseShell } from './shell'
import { isStrings, shape, TONE_CLASS, toneFor, useBlockState, type BlockProps } from './types'

/** The second set of games: letters, words in sentences, and a crossword. */

const ALPHABET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']

const asStringMap = (answer: unknown): Record<string, string> =>
  answer !== null && typeof answer === 'object' && !Array.isArray(answer)
    ? Object.fromEntries(
        Object.entries(answer as Record<string, unknown>).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : {}

const asNumberMap = (answer: unknown): Record<string, number> =>
  answer !== null && typeof answer === 'object' && !Array.isArray(answer)
    ? Object.fromEntries(
        Object.entries(answer as Record<string, unknown>).filter(
          (entry): entry is [string, number] => typeof entry[1] === 'number',
        ),
      )
    : {}

const asNumbers = (answer: unknown): number[] =>
  Array.isArray(answer) ? answer.filter((v): v is number => typeof v === 'number') : []

/* --------------------------------------------------------------------- hangman --- */

const hangmanShape = shape<{ guessed: string[] }>({ guessed: isStrings })

/** Practice: the word is here so its letters can be shown as they are found. */
export function HangmanBlock({ block, ui, onUi, t }: BlockProps<'hangman'>) {
  // The letters tried so far are the game; in a live lesson, the room's game.
  const [state, setState] = useBlockState(ui, onUi, { guessed: [] as string[] }, hangmanShape)
  const guessed = new Set(state.guessed)
  const guess = (letter: string) => setState({ guessed: [...state.guessed, letter] })

  const letters = [...block.word]
  const misses = [...guessed].filter((letter) => !letters.includes(letter))
  const won = letters.every((letter) => guessed.has(letter))
  const lost = misses.length >= block.maxMisses
  const over = won || lost

  return (
    <ExerciseShell label={t.library.blocks.hangman} prompt={block.prompt} hint={block.hint}>
      <div className="mb-4 flex flex-wrap justify-center gap-1.5">
        {letters.map((letter, index) => (
          <span
            key={index}
            className={cn(
              'flex size-9 items-center justify-center rounded-md border-b-2 text-lg font-semibold uppercase',
              guessed.has(letter) || lost ? 'border-foreground/60' : 'border-input',
              lost && !guessed.has(letter) && 'text-destructive',
            )}
          >
            {guessed.has(letter) || lost ? letter : ''}
          </span>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap justify-center gap-1">
        {ALPHABET.map((letter) => {
          const used = guessed.has(letter)
          const hit = used && letters.includes(letter)

          return (
            <button
              key={letter}
              type="button"
              disabled={used || over}
              onClick={() => guess(letter)}
              className={cn(
                'size-8 rounded-md border text-sm font-medium transition-colors',
                used ? (hit ? TONE_CLASS.correct : TONE_CLASS.wrong) : TONE_CLASS.idle,
                used && 'opacity-70',
              )}
            >
              {letter}
            </button>
          )
        })}
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
        <span className="flex items-center gap-1.5">
          {t.library.blocks.hangmanMisses}:
          {Array.from({ length: block.maxMisses }, (_, index) => (
            <span
              key={index}
              className={cn(
                'size-2 rounded-full',
                index < misses.length ? 'bg-destructive' : 'bg-muted-foreground/30',
              )}
            />
          ))}
        </span>

        {over ? (
          <span
            className={cn('flex items-center gap-2', won ? 'text-emerald-600' : 'text-destructive')}
          >
            {won ? <CheckIcon className="size-3.5" /> : null}
            {won ? t.library.blocks.hangmanWon : `${t.library.blocks.hangmanLost} ${block.word}`}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              onClick={() => setState({ guessed: [] })}
            >
              <RotateCcwIcon className="size-3" />
              {t.library.blocks.memoryRestart}
            </Button>
          </span>
        ) : null}
      </div>
    </ExerciseShell>
  )
}

/* --------------------------------------------------------------------- anagram --- */

/**
 * Which letter tile went into the word, read back from the word itself: the first unused
 * tile with each letter, in order. Positional, since letters repeat — and derived rather
 * than kept, so a word built in another browser lights up the same tiles here.
 */
function tilesOf(word: string, letters: string[]): number[] {
  const used: number[] = []

  for (const char of word) {
    const index = letters.findIndex((letter, i) => letter === char && !used.includes(i))
    if (index === -1) break
    used.push(index)
  }

  return used
}

export function AnagramBlock({
  block,
  answer,
  onAnswer,
  result,
  locked,
  t,
}: BlockProps<'anagram'>) {
  const given = asStringMap(answer)

  const set = (itemId: string, indexes: number[], letters: string[]) =>
    onAnswer({ ...given, [itemId]: indexes.map((i) => letters[i] ?? '').join('') })

  return (
    <ExerciseShell
      label={t.library.blocks.anagram}
      prompt={block.prompt}
      hint={t.library.blocks.anagramHint}
      result={result}
    >
      <ul className="space-y-3">
        {block.items.map((item) => {
          const picked = tilesOf(given[item.id] ?? '', item.letters)
          const tone = toneFor(result, item.id)

          return (
            <li key={item.id} className="space-y-2">
              <div
                className={cn(
                  'flex min-h-11 flex-wrap items-center gap-1 rounded-md border px-2 py-1.5',
                  tone ? TONE_CLASS[tone] : 'border-dashed',
                )}
              >
                {picked.length === 0 ? (
                  <span className="text-muted-foreground text-xs">{item.hint ?? '—'}</span>
                ) : null}
                {picked.map((index, position) => (
                  <button
                    key={`${index}-${position}`}
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      set(
                        item.id,
                        picked.filter((_, p) => p !== position),
                        item.letters,
                      )
                    }
                    className="bg-background flex size-8 items-center justify-center rounded border text-sm font-medium uppercase"
                  >
                    {item.letters[index]}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1">
                {item.letters.map((letter, index) => (
                  <button
                    key={index}
                    type="button"
                    disabled={locked || picked.includes(index)}
                    onClick={() => set(item.id, [...picked, index], item.letters)}
                    className={cn(
                      'flex size-8 items-center justify-center rounded-md border text-sm font-medium uppercase transition-colors',
                      picked.includes(index)
                        ? 'text-muted-foreground/30 border-dashed'
                        : TONE_CLASS.idle,
                    )}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </li>
          )
        })}
      </ul>
    </ExerciseShell>
  )
}

/* -------------------------------------------------------------- spot the mistake --- */

export function SpotMistakeBlock({
  block,
  answer,
  onAnswer,
  result,
  locked,
  t,
}: BlockProps<'spot_mistake'>) {
  const given = asNumberMap(answer)

  return (
    <ExerciseShell
      label={t.library.blocks.spotMistake}
      prompt={block.prompt}
      hint={t.library.blocks.spotHint}
      result={result}
    >
      <ul className="space-y-2">
        {block.items.map((item) => {
          const tone = toneFor(result, item.id)
          const chosen = given[item.id]

          return (
            <li
              key={item.id}
              className={cn(
                'rounded-md border p-3 text-[15px] leading-loose',
                tone ? TONE_CLASS[tone] : 'border-border',
              )}
            >
              {item.words.map((word, index) => (
                <button
                  key={index}
                  type="button"
                  disabled={locked}
                  onClick={() => onAnswer({ ...given, [item.id]: index })}
                  className={cn(
                    'mr-1.5 rounded px-1 transition-colors',
                    chosen === index
                      ? 'bg-primary/15 ring-primary ring-1'
                      : 'hover:bg-muted decoration-dotted underline-offset-4 hover:underline',
                  )}
                >
                  {word}
                </button>
              ))}
            </li>
          )
        })}
      </ul>
    </ExerciseShell>
  )
}

/* -------------------------------------------------------------- highlight words --- */

export function HighlightWordsBlock({
  block,
  answer,
  onAnswer,
  result,
  locked,
  t,
}: BlockProps<'highlight_words'>) {
  const selected = new Set(asNumbers(answer))

  const toggle = (index: number) => {
    const next = new Set(selected)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    onAnswer([...next].sort((a, b) => a - b))
  }

  return (
    <ExerciseShell
      label={t.library.blocks.highlight}
      prompt={block.prompt}
      hint={t.library.blocks.highlightHint}
      result={result}
    >
      <p className="text-[15px] leading-loose">
        {block.words.map((word, index) => {
          // After marking: a target the student found is green, one they missed is
          // underlined, and something they tapped that was not asked for is red.
          const isTarget = result ? `w${index}` in result.parts : false
          const tone = result
            ? isTarget
              ? result.parts[`w${index}`]
                ? 'correct'
                : 'missed'
              : selected.has(index)
                ? 'wrong'
                : undefined
            : undefined

          return (
            <button
              key={index}
              type="button"
              disabled={locked}
              onClick={() => toggle(index)}
              className={cn(
                'mr-1.5 rounded px-1 transition-colors',
                tone === 'correct' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                tone === 'wrong' && 'bg-destructive/10 text-destructive line-through',
                tone === 'missed' && 'decoration-primary underline decoration-2 underline-offset-4',
                !tone && selected.has(index) && 'bg-primary/15 ring-primary ring-1',
                !tone && !selected.has(index) && 'hover:bg-muted',
              )}
            >
              {word}
            </button>
          )
        })}
      </p>

      <p className="text-muted-foreground mt-3 text-xs tabular-nums">
        {selected.size} {t.library.blocks.found}
        {result && result.parts.precision === false
          ? ` · ${t.library.blocks.highlightPrecision}`
          : ''}
      </p>
    </ExerciseShell>
  )
}

/* ------------------------------------------------------------------- crossword --- */

type Placement = { id: string; r: number; c: number; dir: 'across' | 'down' }

const cellsOf = (placement: Placement, length: number) =>
  Array.from({ length }, (_, i) => ({
    r: placement.dir === 'down' ? placement.r + i : placement.r,
    c: placement.dir === 'across' ? placement.c + i : placement.c,
  }))

export function CrosswordBlock({
  block,
  answer,
  onAnswer,
  result,
  locked,
  t,
}: BlockProps<'crossword'>) {
  const given = asStringMap(answer)
  const [active, setActive] = useState<string | null>(block.entries[0]?.id ?? null)

  const lengthOf = new Map(block.entries.map((entry) => [entry.id, entry.length]))
  const placements = block.placements.filter((p) => lengthOf.has(p.id))

  // Number the entries the way a printed crossword does: by where they start, top to
  // bottom then left to right, sharing a number when they share a starting cell.
  const starts = [...new Set(placements.map((p) => `${p.r},${p.c}`))].sort((a, b) => {
    const [ar, ac] = a.split(',').map(Number)
    const [br, bc] = b.split(',').map(Number)
    return (ar ?? 0) - (br ?? 0) || (ac ?? 0) - (bc ?? 0)
  })
  const numberOf = (p: Placement) => starts.indexOf(`${p.r},${p.c}`) + 1

  // What each cell shows: the active entry's letter wins at a crossing.
  const cellLetter = new Map<string, string>()
  const cellEntries = new Map<string, string[]>()
  for (const p of placements) {
    const typed = (given[p.id] ?? '').toUpperCase()
    cellsOf(p, lengthOf.get(p.id) ?? 0).forEach((cell, i) => {
      const key = `${cell.r},${cell.c}`
      cellEntries.set(key, [...(cellEntries.get(key) ?? []), p.id])
      const letter = typed[i] ?? ''
      if (letter && (p.id === active || !cellLetter.get(key))) cellLetter.set(key, letter)
    })
  }

  const activePlacement = placements.find((p) => p.id === active)
  const activeCells = new Set(
    activePlacement
      ? cellsOf(activePlacement, lengthOf.get(activePlacement.id) ?? 0).map((c) => `${c.r},${c.c}`)
      : [],
  )

  const toneOfCell = (key: string) => {
    if (!result) return undefined
    const ids = cellEntries.get(key) ?? []
    if (ids.some((id) => result.parts[id] === false)) return 'wrong'
    if (ids.length > 0 && ids.every((id) => result.parts[id])) return 'correct'
    return undefined
  }

  const activeEntry = block.entries.find((entry) => entry.id === active)

  return (
    <ExerciseShell
      label={t.library.blocks.crossword}
      prompt={block.prompt}
      hint={t.library.blocks.crosswordHint}
      result={result}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div
          className="grid w-fit shrink-0 gap-px"
          style={{ gridTemplateColumns: `repeat(${block.size}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: block.size * block.size }, (_, index) => {
            const r = Math.floor(index / block.size)
            const c = index % block.size
            const key = `${r},${c}`
            const ids = cellEntries.get(key)
            if (!ids) return <span key={key} className="size-7 sm:size-8" />

            const start = placements.find((p) => p.r === r && p.c === c)
            const tone = toneOfCell(key)

            return (
              <button
                key={key}
                type="button"
                disabled={locked}
                onClick={() => setActive(ids[0] ?? null)}
                className={cn(
                  'relative flex size-7 items-center justify-center rounded-sm border text-sm font-semibold uppercase sm:size-8',
                  tone
                    ? TONE_CLASS[tone]
                    : activeCells.has(key)
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-background',
                )}
              >
                {start ? (
                  <span className="text-muted-foreground absolute left-0.5 top-0 text-[8px] leading-none">
                    {numberOf(start)}
                  </span>
                ) : null}
                {cellLetter.get(key) ?? ''}
              </button>
            )
          })}
        </div>

        <div className="min-w-0 flex-1 space-y-3 text-sm">
          {activeEntry && activePlacement ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
              <span className="text-muted-foreground text-xs tabular-nums">
                {numberOf(activePlacement)} {activePlacement.dir === 'across' ? '→' : '↓'}
              </span>
              <span className="flex-1">{activeEntry.clue}</span>
              <Input
                value={given[activeEntry.id] ?? ''}
                disabled={locked}
                maxLength={activeEntry.length}
                autoComplete="off"
                onChange={(event) =>
                  onAnswer({
                    ...given,
                    [activeEntry.id]: event.target.value.toUpperCase().replace(/[^A-Z]/g, ''),
                  })
                }
                className="h-8 w-40 font-mono text-sm uppercase tracking-widest"
              />
            </div>
          ) : null}

          {(['across', 'down'] as const).map((dir) => {
            const list = placements
              .filter((p) => p.dir === dir)
              .sort((a, b) => numberOf(a) - numberOf(b))
            if (list.length === 0) return null

            return (
              <div key={dir}>
                <p className="text-muted-foreground mb-1 text-[11px] font-medium uppercase tracking-wide">
                  {dir === 'across' ? t.library.blocks.across : t.library.blocks.down}
                </p>
                <ol className="space-y-0.5">
                  {list.map((p) => {
                    const entry = block.entries.find((e) => e.id === p.id)
                    if (!entry) return null
                    const tone = toneFor(result, p.id)

                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setActive(p.id)}
                          className={cn(
                            'flex w-full items-start gap-2 rounded px-1.5 py-0.5 text-left transition-colors',
                            active === p.id ? 'bg-primary/10' : 'hover:bg-muted',
                            tone === 'correct' && 'text-emerald-700 dark:text-emerald-300',
                            tone === 'wrong' && 'text-destructive',
                          )}
                        >
                          <span className="text-muted-foreground w-5 shrink-0 text-xs tabular-nums">
                            {numberOf(p)}
                          </span>
                          <span>
                            {entry.clue}{' '}
                            <span className="text-muted-foreground text-xs">({entry.length})</span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </div>
            )
          })}
        </div>
      </div>
    </ExerciseShell>
  )
}

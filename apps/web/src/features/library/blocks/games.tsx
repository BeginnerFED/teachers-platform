'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { CheckIcon, RotateCcwIcon, Volume2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { hashString, seededRandom, shuffleWith } from '@/lib/random'
import { cn } from '@/lib/utils'
import { SharedField, SharedTextarea } from './shared-text'
import { ExerciseShell } from './shell'
import {
  advanceGame,
  IDLE_GAME,
  isNumber,
  isStrings,
  shape,
  startGame,
  timedGameShape,
  TONE_CLASS,
  toneFor,
  useBlockState,
  useCountdown,
  type BlockProps,
  type TimedGame,
} from './types'

/** The games. Each is a small machine of its own; all of them sit in the same shell. */

const asObject = (answer: unknown): Record<string, unknown> =>
  answer !== null && typeof answer === 'object' && !Array.isArray(answer)
    ? (answer as Record<string, unknown>)
    : {}

const asStringArray = (answer: unknown): string[] =>
  Array.isArray(answer) ? answer.filter((v): v is string => typeof v === 'string') : []

/* ---------------------------------------------------------------- memory match --- */

type Card = { key: string; pairId: string; text: string }

/**
 * Practice, not assessment: the pairs are on the client because finding them is the
 * whole game. The layout is shuffled from the block's id so the server and the browser
 * deal the same hand.
 */
type MemoryGame = { flipped: string[]; matched: string[]; moves: number }
const memoryShape = shape<MemoryGame>({ flipped: isStrings, matched: isStrings, moves: isNumber })
const FRESH_MEMORY: MemoryGame = { flipped: [], matched: [], moves: 0 }

export function MemoryMatchBlock({ block, ui, onUi, t }: BlockProps<'memory_match'>) {
  const cards = useMemo(() => {
    const all: Card[] = block.pairs.flatMap((pair) => [
      { key: `${pair.id}-a`, pairId: pair.id, text: pair.a },
      { key: `${pair.id}-b`, pairId: pair.id, text: pair.b },
    ])

    return shuffleWith(all, seededRandom(hashString(block.id)))
  }, [block.id, block.pairs])

  // The table — which cards are up, which pairs are found — is the game's state, and the
  // room's in a live lesson. A mismatch is turned back down by whoever turned it up.
  const [game, setGame] = useBlockState<MemoryGame>(ui, onUi, FRESH_MEMORY, memoryShape)
  const { flipped, moves } = game
  const matched = new Set(game.matched)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => clearTimeout(timer.current ?? undefined), [])

  const flip = (card: Card) => {
    if (flipped.includes(card.key) || matched.has(card.pairId)) return

    // Two cards up that did not match are on their way back down. Should the browser that
    // turned them have gone before they went, the next tap turns them down itself, so a
    // room is never left staring at a pair nobody can touch.
    const next = flipped.length === 2 ? [card.key] : [...flipped, card.key]

    if (next.length < 2) {
      setGame({ ...game, flipped: next })
      return
    }

    const [first] = next
    const other = cards.find((c) => c.key === first)

    if (other && other.pairId === card.pairId) {
      setGame({ flipped: [], matched: [...game.matched, card.pairId], moves: moves + 1 })
    } else {
      setGame({ ...game, flipped: next, moves: moves + 1 })
      // Long enough to read both, short enough not to feel like a penalty. Only these two
      // are turned back down — whatever else happened at the table in the meantime stays.
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(
        () =>
          setGame((current) =>
            current.flipped.length === 2 && current.flipped.every((key) => next.includes(key))
              ? { ...current, flipped: [] }
              : current,
          ),
        700,
      )
    }
  }

  const done = matched.size === block.pairs.length

  return (
    <ExerciseShell label={t.library.blocks.memory} prompt={block.prompt}>
      <div
        className={cn(
          'grid gap-2',
          block.pairs.length <= 4 ? 'grid-cols-4' : 'grid-cols-4 sm:grid-cols-6',
        )}
      >
        {cards.map((card) => {
          const up = flipped.includes(card.key) || matched.has(card.pairId)

          return (
            <button
              key={card.key}
              type="button"
              onClick={() => flip(card)}
              disabled={up}
              className={cn(
                'flex aspect-[4/3] items-center justify-center rounded-md border p-1 text-center text-sm transition-colors',
                matched.has(card.pairId)
                  ? TONE_CLASS.correct
                  : up
                    ? TONE_CLASS.chosen
                    : 'bg-muted/60 hover:bg-muted text-muted-foreground',
              )}
            >
              {up ? card.text : '?'}
            </button>
          )
        })}
      </div>

      <div className="text-muted-foreground mt-3 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
        <span>
          {t.library.blocks.memoryMoves}: {moves}
        </span>

        {done ? (
          <span className="flex items-center gap-2 text-emerald-600">
            <CheckIcon className="size-3.5" />
            {t.library.blocks.memoryDone}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              onClick={() => setGame(FRESH_MEMORY)}
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

/* ----------------------------------------------------------------- word search --- */

type Cell = { r: number; c: number }
const cellKey = (cell: Cell) => `${cell.r},${cell.c}`

/** The straight line from one cell to another, or nothing if they are not aligned. */
function lineBetween(from: Cell, to: Cell): Cell[] {
  const dr = Math.sign(to.r - from.r)
  const dc = Math.sign(to.c - from.c)
  const length = Math.max(Math.abs(to.r - from.r), Math.abs(to.c - from.c))

  // Rows, columns and the two diagonals only.
  if (dr !== 0 && dc !== 0 && Math.abs(to.r - from.r) !== Math.abs(to.c - from.c)) return [from]

  return Array.from({ length: length + 1 }, (_, i) => ({ r: from.r + dr * i, c: from.c + dc * i }))
}

/**
 * Sweep a straight line across the grid; if it spells one of the words, forwards or
 * backwards, it is found. The letters are on the client so that check is instant; where
 * the words actually sit is not, and marking compares the swept cells against that.
 */
export function WordSearchBlock({
  block,
  answer,
  onAnswer,
  result,
  locked,
  t,
}: BlockProps<'word_search'>) {
  const found = asObject(answer) as Record<string, Cell[]>
  const [start, setStart] = useState<Cell | null>(null)
  const [current, setCurrent] = useState<Cell | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const selecting = start && current ? lineBetween(start, current) : []
  const selectedKeys = new Set(selecting.map(cellKey))
  const foundKeys = new Set(Object.values(found).flat().map(cellKey))

  const cellAt = (x: number, y: number): Cell | null => {
    const element = document.elementFromPoint(x, y) as HTMLElement | null
    const target = element?.closest<HTMLElement>('[data-cell]')
    if (!target || !gridRef.current?.contains(target)) return null

    const [r, c] = (target.dataset.cell ?? '').split(',').map(Number)
    return r === undefined || c === undefined || Number.isNaN(r) || Number.isNaN(c)
      ? null
      : { r, c }
  }

  const commit = () => {
    if (start && current && !locked) {
      const cells = lineBetween(start, current)
      const letters = cells.map((cell) => block.grid[cell.r]?.[cell.c] ?? '').join('')
      const reversed = [...letters].reverse().join('')
      const word = block.words.find((w) => w === letters || w === reversed)

      if (word && !found[word]) onAnswer({ ...found, [word]: cells })
    }

    setStart(null)
    setCurrent(null)
  }

  return (
    <ExerciseShell
      label={t.library.blocks.wordSearch}
      prompt={block.prompt}
      hint={t.library.blocks.wordSearchHint}
      result={result}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* Pointer events on the grid, with the cell read from under the pointer: that is
            what makes a finger sweep on a phone select cells the way a mouse drag does. */}
        <div
          ref={gridRef}
          className="grid w-fit touch-none select-none gap-0.5"
          style={{ gridTemplateColumns: `repeat(${block.size}, minmax(0, 1fr))` }}
          onPointerDown={(event) => {
            if (locked) return
            const cell = cellAt(event.clientX, event.clientY)
            if (cell) {
              setStart(cell)
              setCurrent(cell)
              event.currentTarget.setPointerCapture(event.pointerId)
            }
          }}
          onPointerMove={(event) => {
            if (!start) return
            const cell = cellAt(event.clientX, event.clientY)
            if (cell) setCurrent(cell)
          }}
          onPointerUp={commit}
          onPointerCancel={commit}
        >
          {block.grid.map((row, r) =>
            row.map((letter, c) => {
              const key = cellKey({ r, c })

              return (
                <div
                  key={key}
                  data-cell={key}
                  className={cn(
                    'flex size-7 items-center justify-center rounded-sm border text-xs font-medium uppercase sm:size-8 sm:text-sm',
                    foundKeys.has(key)
                      ? 'border-emerald-500/60 bg-emerald-500/15'
                      : selectedKeys.has(key)
                        ? 'border-primary bg-primary/15'
                        : 'border-border bg-background',
                  )}
                >
                  {letter}
                </div>
              )
            }),
          )}
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm sm:flex-col">
          {block.words.map((word) => {
            const tone = toneFor(result, word)
            const isFound = word in found

            return (
              <li
                key={word}
                className={cn(
                  'tabular-nums',
                  tone === 'correct' && 'text-emerald-600',
                  tone === 'wrong' && 'text-destructive',
                  isFound && !tone && 'text-muted-foreground line-through',
                )}
              >
                {word}
              </li>
            )
          })}
        </ul>
      </div>

      <p className="text-muted-foreground mt-3 text-xs tabular-nums">
        {Object.keys(found).length} / {block.words.length} {t.library.blocks.found}
      </p>
    </ExerciseShell>
  )
}

/* -------------------------------------------------------------- dialogue order --- */

export function DialogueOrderBlock({
  block,
  answer,
  onAnswer,
  result,
  locked,
  t,
}: BlockProps<'dialogue_order'>) {
  const arranged = asStringArray(answer)
  const bank = block.lines.filter((line) => !arranged.includes(line.id))
  const byId = new Map(block.lines.map((line) => [line.id, line]))

  return (
    <ExerciseShell
      label={t.library.blocks.dialogue}
      prompt={block.prompt}
      hint={t.library.blocks.dialogueHint}
      result={result}
    >
      <ol className="mb-3 flex min-h-14 flex-col gap-1.5 rounded-md border border-dashed p-2">
        {arranged.length === 0 ? <li className="text-muted-foreground p-2 text-xs">—</li> : null}

        {arranged.map((id, index) => {
          const line = byId.get(id)
          if (!line) return null
          const tone = toneFor(result, line.id)

          return (
            <li key={id}>
              <button
                type="button"
                disabled={locked}
                onClick={() => onAnswer(arranged.filter((other) => other !== id))}
                className={cn(
                  'flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm',
                  tone ? TONE_CLASS[tone] : 'bg-background border-border',
                )}
              >
                <span className="text-muted-foreground w-4 shrink-0 text-xs tabular-nums">
                  {index + 1}
                </span>
                <span>
                  <span className="font-semibold">{line.speaker}: </span>
                  {line.text}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <ul className="flex flex-col gap-1.5">
        {bank.map((line) => (
          <li key={line.id}>
            <button
              type="button"
              disabled={locked}
              onClick={() => onAnswer([...arranged, line.id])}
              className={cn(
                'flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm',
                TONE_CLASS.idle,
              )}
            >
              <span>
                <span className="font-semibold">{line.speaker}: </span>
                {line.text}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </ExerciseShell>
  )
}

/* ------------------------------------------------------------------- dictation --- */

/**
 * Read aloud by the browser's own voice. No file to host, nothing to download, and a
 * teacher can put a dictation in a lesson in the time it takes to type the sentence.
 */
export function DictationBlock({
  block,
  answer,
  onAnswer,
  result,
  locked,
  t,
}: BlockProps<'dictation'>) {
  const value = typeof answer === 'string' ? answer : ''
  // The server has no speech synthesis and must not disagree with the browser about the
  // first paint. An external-store read with a server snapshot of "unknown" renders the
  // same thing on both sides and settles to the browser's answer after hydration.
  const supported = useSyncExternalStore(
    () => () => {},
    () => ('speechSynthesis' in window ? 'yes' : 'no'),
    () => 'unknown' as const,
  )
  // The voice is this browser's own, and so is the count of listens: a room shares the
  // text, not one browser's speaker.
  const [plays, setPlays] = useState(0)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  const exhausted = block.plays > 0 && plays >= block.plays

  const speak = () => {
    if (supported !== 'yes' || exhausted || speaking) return

    const utterance = new SpeechSynthesisUtterance(block.text)
    utterance.lang = 'en-US'
    utterance.rate = block.rate
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)

    window.speechSynthesis.cancel()
    setSpeaking(true)
    setPlays((count) => count + 1)
    window.speechSynthesis.speak(utterance)
  }

  const words = value.trim() ? value.trim().split(/\s+/).length : 0

  return (
    <ExerciseShell label={t.library.blocks.dictation} prompt={block.prompt} result={result}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={supported === 'no' || exhausted || speaking}
          onClick={speak}
          className="corner-brackets gap-2"
        >
          <Volume2Icon className={cn('size-4', speaking && 'animate-pulse')} />
          {t.library.blocks.listen}
        </Button>

        {supported === 'no' ? (
          <span className="text-destructive text-xs">{t.library.blocks.noSpeech}</span>
        ) : block.plays > 0 ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {Math.max(0, block.plays - plays)} {t.library.blocks.listensLeft}
          </span>
        ) : null}
      </div>

      <SharedTextarea
        value={value}
        disabled={locked}
        onValue={onAnswer}
        placeholder={t.library.blocks.dictationPlaceholder}
        rows={3}
        className="resize-y"
      />

      <p className="text-muted-foreground mt-2 text-xs tabular-nums">
        {words} {t.library.blocks.words}
      </p>
    </ExerciseShell>
  )
}

/* ------------------------------------------------------------------ speed round --- */

const GAP_TONE = {
  correct: 'border-emerald-500 text-emerald-700 dark:text-emerald-300',
  wrong: 'border-destructive text-destructive line-through decoration-destructive/40',
} as const

/** Gap-fills against a clock, one after another. Running out of time moves on. */
export function SpeedRoundBlock({
  block,
  answer,
  onAnswer,
  result,
  locked,
  ui,
  onUi,
  leads = true,
  t,
}: BlockProps<'speed_round'>) {
  const given = asObject(answer) as Record<string, Record<string, string>>
  // The clock is the moment the item came up, shared by the room — see the quiz.
  const [game, setGame] = useBlockState<TimedGame>(ui, onUi, IDLE_GAME, timedGameShape)
  const { started, index } = game
  const firstInput = useRef<HTMLInputElement>(null)

  const item = block.items[index]
  const finished = started && index >= block.items.length
  const review = Boolean(result) || locked || finished
  const running = started && !review
  const remaining = useCountdown(game, block.secondsPerItem, running)

  useEffect(() => {
    if (!running || !leads) return

    const left = game.startedAt + block.secondsPerItem * 1000 - Date.now()
    const timer = setTimeout(() => setGame(advanceGame(game)), Math.max(left, 0))

    return () => clearTimeout(timer)
  }, [running, leads, game, block.secondsPerItem, setGame])

  useEffect(() => {
    if (started && !review) firstInput.current?.focus()
  }, [started, review, index])

  const advance = () => setGame(advanceGame(game))

  const setGap = (itemId: string, gapId: string, value: string) =>
    onAnswer({ ...given, [itemId]: { ...(given[itemId] ?? {}), [gapId]: value } })

  if (!started) {
    return (
      <ExerciseShell label={t.library.blocks.speedRound} prompt={block.prompt} result={result}>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => setGame(startGame())}
            disabled={locked}
            className="corner-brackets"
          >
            {t.library.blocks.speedStart}
          </Button>
          <span className="text-muted-foreground text-xs tabular-nums">
            {block.items.length} × {block.secondsPerItem}
            {t.library.blocks.seconds}
          </span>
        </div>
      </ExerciseShell>
    )
  }

  if (review || !item) {
    return (
      <ExerciseShell label={t.library.blocks.speedRound} prompt={block.prompt} result={result}>
        <ul className="space-y-2">
          {block.items.map((entry) => (
            <li key={entry.id} className="rounded-md border p-3 text-[15px] leading-[2.2]">
              {entry.segments.map((segment, position) =>
                segment.kind === 'text' ? (
                  <span key={position} className="whitespace-pre-wrap">
                    {segment.text}
                  </span>
                ) : (
                  <span
                    key={segment.id}
                    className={cn(
                      'border-input mx-1 inline-block min-w-[6ch] border-b-2 px-1 text-center',
                      (() => {
                        const tone = toneFor(result, `${entry.id}:${segment.id}`)
                        return tone ? GAP_TONE[tone] : ''
                      })(),
                    )}
                  >
                    {given[entry.id]?.[segment.id] || ' '}
                  </span>
                ),
              )}
            </li>
          ))}
        </ul>
      </ExerciseShell>
    )
  }

  return (
    <ExerciseShell label={t.library.blocks.speedRound} prompt={block.prompt} result={result}>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Progress value={(remaining / block.secondsPerItem) * 100} className="h-1.5" />
          <span className="text-muted-foreground w-10 shrink-0 text-right text-xs tabular-nums">
            {remaining}
            {t.library.blocks.seconds}
          </span>
        </div>

        <p className="text-[15px] leading-[2.4]">
          <span className="text-muted-foreground mr-2 text-xs tabular-nums">
            {index + 1}/{block.items.length}
          </span>
          {item.segments.map((segment, position) =>
            segment.kind === 'text' ? (
              <span key={position} className="whitespace-pre-wrap">
                {segment.text}
              </span>
            ) : (
              <SharedField
                // The item as well as the gap: gaps are numbered from g1 inside every
                // item, so keying by the gap alone would hand the next item's box the
                // same instance — and with it the last answer, sitting in a fresh gap.
                key={`${item.id}:${segment.id}`}
                ref={
                  position === item.segments.findIndex((s) => s.kind === 'gap')
                    ? firstInput
                    : undefined
                }
                value={given[item.id]?.[segment.id] ?? ''}
                onValue={(next) => setGap(item.id, segment.id, next)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') advance()
                }}
                placeholder={segment.hint}
                aria-label={segment.hint ?? t.library.blocks.fillGaps}
                autoComplete="off"
                style={{
                  width: `${Math.max(6, (given[item.id]?.[segment.id]?.length ?? 0) + 2)}ch`,
                }}
                className="border-input focus-visible:border-primary mx-1 border-0 border-b-2 bg-transparent px-1 text-center text-[15px] outline-none"
              />
            ),
          )}
        </p>

        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={advance}
            className="corner-brackets"
          >
            {index + 1 >= block.items.length
              ? t.library.blocks.speedDone
              : t.library.blocks.speedNext}
          </Button>
        </div>
      </div>
    </ExerciseShell>
  )
}

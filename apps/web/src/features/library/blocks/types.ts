import { useEffect, useState } from 'react'
import type { BlockResult, StudentBlock } from '@tp/shared'
import type { Messages } from '@/messages'

/** One member of the student-facing union, picked by its discriminator. */
export type StudentBlockOf<T extends StudentBlock['type']> = Extract<StudentBlock, { type: T }>

/**
 * Every block is drawn the same way: it is handed what the student has done so far, a way
 * to say what changed, and — once the step has been checked — how it went. The player owns
 * all of that state, so a block component holds none of its own beyond the purely visual.
 *
 * A block that is a small machine — a card turned, a game begun — has state that is not an
 * answer. On its own it keeps that state to itself; in a live lesson the player holds it
 * too, through `ui`/`onUi`, so a card turned in one browser turns in every other.
 */
export type BlockProps<T extends StudentBlock['type']> = {
  block: StudentBlockOf<T>
  answer: unknown
  onAnswer: (value: unknown) => void
  /** Present only after the step has been marked. Absent means "not answered yet". */
  result?: BlockResult
  /** True while the answers are in flight, and after, so a mark cannot be edited away. */
  locked?: boolean
  /** The block's own state, when somebody outside keeps it. */
  ui?: unknown
  /** How to hand the block's own state outside. Absent means the block keeps it. */
  onUi?: (value: unknown) => void
  /**
   * Whether this browser takes the decisions a clock takes — moving a timed game on when
   * time runs out. One browser in a room must, and only one should.
   */
  leads?: boolean
  t: Messages
}

/**
 * A block's own state: kept here, or kept by whoever asked for it through `onUi`. Reads
 * like `useState`, so a block does not care which. Functional updates are resolved against
 * the value in hand, which is all a block needs.
 */
export function useBlockState<T>(
  ui: unknown,
  onUi: ((value: unknown) => void) | undefined,
  initial: T,
  parse: (raw: unknown) => T | null,
): [T, (next: T | ((current: T) => T)) => void] {
  const [own, setOwn] = useState(initial)
  const shared = onUi !== undefined
  const value = shared ? (parse(ui) ?? initial) : own

  const set = (next: T | ((current: T) => T)) => {
    if (!shared) {
      // React resolves an update against the latest state, which a closure may not hold.
      setOwn(next)
      return
    }

    onUi(typeof next === 'function' ? (next as (current: T) => T)(value) : next)
  }

  return [value, set]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** A parser for `useBlockState`: an object with these keys, or nothing. */
export function shape<T extends Record<string, unknown>>(guards: {
  [K in keyof T]: (value: unknown) => value is T[K]
}) {
  return (raw: unknown): T | null => {
    if (!isRecord(raw)) return null

    const out: Partial<T> = {}
    for (const key of Object.keys(guards) as (keyof T)[]) {
      const value = raw[key as string]
      if (!guards[key](value)) return null
      out[key] = value
    }

    return out as T
  }
}

export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
export const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
export const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

/* -------------------------------------------------------------- timed games --- */

/**
 * A game played against a clock: whether it has begun, which item is up, and the moment
 * it came up. The moment rather than a count, so that a room can share it — every browser
 * reads the same moment and draws the same seconds left.
 */
export type TimedGame = { started: boolean; index: number; startedAt: number }
export const IDLE_GAME: TimedGame = { started: false, index: 0, startedAt: 0 }
export const timedGameShape = shape<TimedGame>({
  started: isBoolean,
  index: isNumber,
  startedAt: isNumber,
})

/** The first item, from now. */
export const startGame = (): TimedGame => ({ started: true, index: 0, startedAt: Date.now() })
/** The next item, from now. */
export const advanceGame = (game: TimedGame): TimedGame => ({
  started: true,
  index: game.index + 1,
  startedAt: Date.now(),
})

/** How often the seconds left are redrawn. */
const COUNTDOWN_TICK_MS = 250

/** Seconds left on the current item, redrawn a few times a second while the game runs. */
export function useCountdown(game: TimedGame, seconds: number, running: boolean): number {
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (!running) return

    const tick = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS)
    return () => clearInterval(tick)
  }, [running, game.startedAt])

  if (!running) return seconds

  const elapsed = now > game.startedAt ? (now - game.startedAt) / 1000 : 0
  return Math.max(0, Math.ceil(seconds - elapsed))
}

/** Green, red or nothing. Nothing until the step has been checked. */
export type Tone = 'correct' | 'wrong' | undefined

export function toneFor(result: BlockResult | undefined, unitId: string): Tone {
  if (!result || result.manual) return undefined

  return result.parts[unitId] ? 'correct' : 'wrong'
}

/**
 * Border and background for a tappable answer row. Kept in one place because five block
 * types draw the same thing, and five slightly different greens is how a page starts to
 * look homemade.
 */
export const TONE_CLASS: Record<'correct' | 'wrong' | 'idle' | 'chosen', string> = {
  correct: 'border-emerald-500/60 bg-emerald-500/10 text-foreground',
  wrong: 'border-destructive/60 bg-destructive/10 text-foreground',
  chosen: 'border-primary bg-primary/5 text-foreground',
  idle: 'border-border hover:border-foreground/25 hover:bg-muted/50',
}

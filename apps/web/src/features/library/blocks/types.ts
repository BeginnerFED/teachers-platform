import type { BlockResult, StudentBlock } from '@tp/shared'
import type { Messages } from '@/messages'

/** One member of the student-facing union, picked by its discriminator. */
export type StudentBlockOf<T extends StudentBlock['type']> = Extract<StudentBlock, { type: T }>

/**
 * Every block is drawn the same way: it is handed what the student has done so far, a way
 * to say what changed, and — once the step has been checked — how it went. The player owns
 * all of that state, so a block component holds none of its own beyond the purely visual.
 */
export type BlockProps<T extends StudentBlock['type']> = {
  block: StudentBlockOf<T>
  answer: unknown
  onAnswer: (value: unknown) => void
  /** Present only after the step has been marked. Absent means "not answered yet". */
  result?: BlockResult
  /** True while the answers are in flight, and after, so a mark cannot be edited away. */
  locked?: boolean
  t: Messages
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

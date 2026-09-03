import type { Block, BlockType, ExerciseBlock } from './contracts/blocks'
import { isExerciseBlock } from './contracts/blocks'

/**
 * Marking, as pure functions. No I/O, no clock, no database.
 *
 * The API is the authority — a score that counts is always computed server-side from the
 * stored block, never trusted from the browser. But the player wants to tick a gap green
 * the instant it is typed, and writing that rule twice is how the two drift apart. So it
 * lives here once and both sides import it.
 */

/** What the student sent back, keyed by block type. */
export type AnswerFor<T extends BlockType> = T extends 'multiple_choice'
  ? string[]
  : T extends 'sentence_builder'
    ? string[]
    : T extends 'gap_fill' | 'matching' | 'categorize' | 'quiz_game'
      ? Record<string, string>
      : T extends 'true_false'
        ? Record<string, boolean>
        : T extends 'free_writing'
          ? string
          : never

/** Every block's answers for one step, keyed by block id. */
export type StepAnswers = Record<string, unknown>

export type BlockGrade = {
  /**
   * Null means nobody has marked it yet and no machine can: `free_writing` waits for the
   * teacher. Zero means it was marked and got nothing — a distinction worth keeping.
   */
  score: number | null
  max: number
  /** Per answerable unit, so the player can tick individual gaps rather than the block. */
  parts: Record<string, boolean>
  /** True when this block needs a human. */
  manual: boolean
}

export type BlocksGrade = {
  /** Points earned on everything a machine could mark. */
  autoScore: number
  autoMax: number
  /** Points still waiting on a teacher, so a part-marked exercise reads honestly. */
  manualMax: number
  byBlock: Record<string, BlockGrade>
}

const round2 = (value: number) => Math.round(value * 100) / 100

/**
 * Typed apostrophes are the single most common false negative in a gap-fill: a student on
 * a phone types "don’t" and the answer key says "don't". Whitespace collapses for the same
 * reason — a double space is not a wrong answer.
 */
function normaliseText(value: string, caseSensitive: boolean) {
  const cleaned = value.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()

  return caseSensitive ? cleaned : cleaned.toLocaleLowerCase('en')
}

/**
 * The ids of everything in a block that can be right or wrong. Its length is the block's
 * default weight and the denominator for partial credit; empty means the block carries no
 * marks at all, which is true of every presentation block plus flashcards and reading.
 */
export function answerableUnits(block: Block): string[] {
  switch (block.type) {
    // Marked whole. Partial credit on select-all-that-apply rewards ticking everything.
    case 'multiple_choice':
    case 'sentence_builder':
    case 'free_writing':
      return [block.id]
    case 'gap_fill':
      return block.segments.filter((s) => s.kind === 'gap').map((s) => s.id)
    case 'matching':
      return block.pairs.map((p) => p.id)
    case 'categorize':
      return block.items.map((i) => i.id)
    case 'true_false':
      return block.statements.map((s) => s.id)
    case 'quiz_game':
      return block.questions.map((q) => q.id)
    // Practice and presentation. Nothing to be wrong about.
    case 'flashcards':
    case 'reading':
    case 'heading':
    case 'text':
    case 'callout':
    case 'image':
    case 'audio':
    case 'video':
    case 'divider':
      return []
  }
}

const asStringArray = (answer: unknown): string[] =>
  Array.isArray(answer) ? answer.filter((v): v is string => typeof v === 'string') : []

const asStringMap = (answer: unknown): Record<string, string> =>
  answer !== null && typeof answer === 'object' && !Array.isArray(answer)
    ? (Object.fromEntries(
        Object.entries(answer as Record<string, unknown>).filter(([, v]) => typeof v === 'string'),
      ) as Record<string, string>)
    : {}

const asBooleanMap = (answer: unknown): Record<string, boolean> =>
  answer !== null && typeof answer === 'object' && !Array.isArray(answer)
    ? (Object.fromEntries(
        Object.entries(answer as Record<string, unknown>).filter(([, v]) => typeof v === 'boolean'),
      ) as Record<string, boolean>)
    : {}

/**
 * Which units the student got right. Deliberately forgiving about the shape of `answer`:
 * it arrives from a browser, and an unanswered block, a half-filled one and a malformed
 * one should all mark as wrong rather than throw.
 */
function correctUnits(block: ExerciseBlock, answer: unknown): Record<string, boolean> {
  switch (block.type) {
    case 'multiple_choice': {
      const chosen = new Set(asStringArray(answer))
      const key = new Set(block.correctIds)
      const exact = chosen.size === key.size && [...key].every((id) => chosen.has(id))

      return { [block.id]: exact }
    }

    case 'gap_fill': {
      const given = asStringMap(answer)

      return Object.fromEntries(
        block.segments
          .filter((s) => s.kind === 'gap')
          .map((gap) => {
            const typed = normaliseText(given[gap.id] ?? '', block.caseSensitive)

            return [
              gap.id,
              typed.length > 0 &&
                gap.answers.some((a) => normaliseText(a, block.caseSensitive) === typed),
            ]
          }),
      )
    }

    case 'matching': {
      // Matched against the right-hand *text*, not an id. The student is only ever sent a
      // shuffled list of strings for that column, so there is no id to leak the pairing —
      // and two identical right-hand cards are indistinguishable anyway, which makes
      // comparing by text the honest thing rather than a shortcut.
      const given = asStringMap(answer)

      return Object.fromEntries(
        block.pairs.map((p) => {
          const chosen = normaliseText(given[p.id] ?? '', false)

          return [p.id, chosen.length > 0 && chosen === normaliseText(p.right, false)]
        }),
      )
    }

    case 'sentence_builder': {
      const built = asStringArray(answer)
      const same =
        built.length === block.correct.length &&
        normaliseText(built.join(' '), false) === normaliseText(block.correct.join(' '), false)

      return { [block.id]: same }
    }

    case 'categorize': {
      const given = asStringMap(answer)

      return Object.fromEntries(block.items.map((i) => [i.id, given[i.id] === i.categoryId]))
    }

    case 'true_false': {
      const given = asBooleanMap(answer)

      return Object.fromEntries(block.statements.map((s) => [s.id, given[s.id] === s.isTrue]))
    }

    case 'quiz_game': {
      const given = asStringMap(answer)

      return Object.fromEntries(block.questions.map((q) => [q.id, given[q.id] === q.correctId]))
    }

    // Marked by a person, or not marked at all.
    case 'free_writing':
      return { [block.id]: false }
    case 'flashcards':
    case 'reading':
      return {}
  }
}

/** A teacher reads it; a machine cannot. */
export const isManualBlock = (block: Block) => block.type === 'free_writing'

/**
 * `points` is the block's total rather than a per-unit rate, so a five-gap exercise worth
 * two points pays 0.4 a gap. Left unset it is one point per unit, which is what a teacher
 * means when they have not thought about weighting at all.
 */
export function gradeBlock(block: Block, answer: unknown): BlockGrade {
  const units = answerableUnits(block)
  const manual = isManualBlock(block)

  if (units.length === 0) {
    return { score: 0, max: 0, parts: {}, manual: false }
  }

  const max = round2(getPoints(block) ?? units.length)

  if (manual) {
    return { score: null, max, parts: {}, manual: true }
  }

  const parts = isExerciseBlock(block) ? correctUnits(block, answer) : {}
  const right = Object.values(parts).filter(Boolean).length

  return { score: round2((max * right) / units.length), max, parts, manual: false }
}

/** Only exercise blocks carry a weight; the union does not know that without asking. */
function getPoints(block: Block): number | undefined {
  return isExerciseBlock(block) ? block.points : undefined
}

/** One step, or a whole material once its steps are flattened. */
export function gradeBlocks(blocks: Block[], answers: StepAnswers): BlocksGrade {
  const byBlock: Record<string, BlockGrade> = {}
  let autoScore = 0
  let autoMax = 0
  let manualMax = 0

  for (const block of blocks) {
    const grade = gradeBlock(block, answers[block.id])
    if (grade.max === 0) continue

    byBlock[block.id] = grade

    if (grade.manual) {
      manualMax += grade.max
    } else {
      autoScore += grade.score ?? 0
      autoMax += grade.max
    }
  }

  return {
    autoScore: round2(autoScore),
    autoMax: round2(autoMax),
    manualMax: round2(manualMax),
    byBlock,
  }
}

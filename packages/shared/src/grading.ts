import type { Block, BlockType, ExerciseBlock } from './contracts/blocks'
import { isExerciseBlock } from './contracts/blocks'

/**
 * Marking, as pure functions. No I/O, no clock, no database.
 *
 * The API is the authority — a score that counts is always computed server-side from the
 * stored block, never trusted from the browser. The student projection carries no answer
 * key, so the browser cannot mark itself; it asks. Keeping the rule in one shared module
 * means the author's preview and the student's result can never disagree.
 */

/** What the student sent back, keyed by block type. */
export type AnswerFor<T extends BlockType> = T extends 'multiple_choice'
  ? string[]
  : T extends 'sentence_builder' | 'dialogue_order'
    ? string[]
    : T extends 'gap_fill' | 'matching' | 'categorize' | 'quiz_game'
      ? Record<string, string>
      : T extends 'true_false'
        ? Record<string, boolean>
        : T extends 'free_writing' | 'dictation'
          ? string
          : T extends 'word_search'
            ? Record<string, { r: number; c: number }[]>
            : T extends 'speed_round'
              ? Record<string, Record<string, string>>
              : T extends 'anagram' | 'crossword'
                ? Record<string, string>
                : T extends 'spot_mistake'
                  ? Record<string, number>
                  : T extends 'highlight_words'
                    ? number[]
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
export function normaliseText(value: string, caseSensitive: boolean) {
  const cleaned = value.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()

  return caseSensitive ? cleaned : cleaned.toLocaleLowerCase('en')
}

/** Words as a dictation compares them: case and punctuation set aside, apostrophes kept. */
export function dictationWords(value: string): string[] {
  return normaliseText(value, false)
    .replace(/[.,!?;:"()\-–—]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Which of the expected words appear in the student's text, in order. A dropped word
 * costs that word alone rather than every word after it, which is what a position-by-
 * position comparison would charge.
 */
function matchedInOrder(expected: string[], given: string[]): boolean[] {
  const rows = expected.length
  const cols = given.length
  const lcs: number[][] = Array.from({ length: rows + 1 }, () => Array<number>(cols + 1).fill(0))

  for (let i = 1; i <= rows; i++) {
    for (let j = 1; j <= cols; j++) {
      lcs[i]![j] =
        expected[i - 1] === given[j - 1]
          ? lcs[i - 1]![j - 1]! + 1
          : Math.max(lcs[i - 1]![j]!, lcs[i]![j - 1]!)
    }
  }

  // Walk back to find which expected words took part in the longest common run.
  const matched = Array<boolean>(rows).fill(false)
  let i = rows
  let j = cols
  while (i > 0 && j > 0) {
    if (expected[i - 1] === given[j - 1]) {
      matched[i - 1] = true
      i -= 1
      j -= 1
    } else if (lcs[i - 1]![j]! >= lcs[i]![j - 1]!) {
      i -= 1
    } else {
      j -= 1
    }
  }

  return matched
}

/**
 * The ids of everything in a block that can be right or wrong. Its length is the block's
 * default weight and the denominator for partial credit; empty means the block carries no
 * marks at all, which is true of every presentation block plus the practice ones.
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
    case 'word_search':
      return block.words
    case 'dialogue_order':
      return block.lines.map((l) => l.id)
    case 'dictation':
      return dictationWords(block.text).map((_, index) => `w${index}`)
    case 'speed_round':
      return block.items.flatMap((item) =>
        item.segments.filter((s) => s.kind === 'gap').map((s) => `${item.id}:${s.id}`),
      )
    case 'anagram':
      return block.items.map((item) => item.id)
    case 'spot_mistake':
      return block.items.map((item) => item.id)
    case 'highlight_words':
      // One unit per word to find, and one for not tapping words that were not asked for:
      // without that, tapping everything would score full marks.
      return [...block.targets.map((index) => `w${index}`), 'precision']
    case 'crossword':
      return block.entries.map((entry) => entry.id)
    // Practice and presentation. Nothing to be wrong about.
    case 'flashcards':
    case 'reading':
    case 'memory_match':
    case 'hangman':
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

const asObject = (answer: unknown): Record<string, unknown> =>
  answer !== null && typeof answer === 'object' && !Array.isArray(answer)
    ? (answer as Record<string, unknown>)
    : {}

const asStringMap = (answer: unknown): Record<string, string> =>
  Object.fromEntries(
    Object.entries(asObject(answer)).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )

const asBooleanMap = (answer: unknown): Record<string, boolean> =>
  Object.fromEntries(
    Object.entries(asObject(answer)).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
    ),
  )

const cellKey = (cell: { r: number; c: number }) => `${cell.r},${cell.c}`

const asCells = (value: unknown): { r: number; c: number }[] =>
  Array.isArray(value)
    ? value.flatMap((cell) =>
        cell !== null &&
        typeof cell === 'object' &&
        typeof (cell as { r: unknown }).r === 'number' &&
        typeof (cell as { c: unknown }).c === 'number'
          ? [{ r: (cell as { r: number }).r, c: (cell as { c: number }).c }]
          : [],
      )
    : []

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

    case 'word_search': {
      // A word is found when the student's line covers exactly the cells it sits on, in
      // either direction — the same cells read backwards are the same word found.
      const given = asObject(answer)

      return Object.fromEntries(
        block.words.map((word) => {
          const placement = block.placements.find((p) => p.word === word)
          const marked = new Set(asCells(given[word]).map(cellKey))
          const wanted = new Set((placement?.cells ?? []).map(cellKey))
          const same =
            wanted.size > 0 &&
            marked.size === wanted.size &&
            [...wanted].every((k) => marked.has(k))

          return [word, same]
        }),
      )
    }

    case 'dialogue_order': {
      const given = asStringArray(answer)

      return Object.fromEntries(
        block.lines.map((line, index) => [line.id, given[index] === line.id]),
      )
    }

    case 'dictation': {
      const expected = dictationWords(block.text)
      const given = dictationWords(typeof answer === 'string' ? answer : '')
      const matched = matchedInOrder(expected, given)

      return Object.fromEntries(expected.map((_, index) => [`w${index}`, matched[index] ?? false]))
    }

    case 'speed_round': {
      const given = asObject(answer)

      return Object.fromEntries(
        block.items.flatMap((item) => {
          const typedForItem = asStringMap(given[item.id])

          return item.segments
            .filter((s) => s.kind === 'gap')
            .map((gap) => {
              const typed = normaliseText(typedForItem[gap.id] ?? '', block.caseSensitive)

              return [
                `${item.id}:${gap.id}`,
                typed.length > 0 &&
                  gap.answers.some((a) => normaliseText(a, block.caseSensitive) === typed),
              ]
            })
        }),
      )
    }

    case 'anagram': {
      const given = asStringMap(answer)

      return Object.fromEntries(
        block.items.map((item) => [
          item.id,
          normaliseText(given[item.id] ?? '', false) === normaliseText(item.word, false),
        ]),
      )
    }

    case 'spot_mistake': {
      const given = asObject(answer)

      return Object.fromEntries(
        block.items.map((item) => [item.id, Number(given[item.id]) === item.wrongIndex]),
      )
    }

    case 'highlight_words': {
      const selected = new Set(
        Array.isArray(answer) ? answer.filter((v): v is number => typeof v === 'number') : [],
      )
      const wanted = new Set(block.targets)
      const parts: Record<string, boolean> = Object.fromEntries(
        block.targets.map((index) => [`w${index}`, selected.has(index)]),
      )
      // Restraint: something was chosen, and nothing that was not asked for.
      parts.precision = selected.size > 0 && [...selected].every((index) => wanted.has(index))

      return parts
    }

    case 'crossword': {
      const given = asStringMap(answer)

      return Object.fromEntries(
        block.entries.map((entry) => [
          entry.id,
          normaliseText(given[entry.id] ?? '', false) === entry.answer.toLowerCase(),
        ]),
      )
    }

    // Marked by a person, or not marked at all.
    case 'free_writing':
      return { [block.id]: false }
    case 'flashcards':
    case 'reading':
    case 'memory_match':
    case 'hangman':
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

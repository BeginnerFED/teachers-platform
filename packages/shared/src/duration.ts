import { blockSchema, type Block, type BlockDraft } from './contracts/blocks'

/**
 * How long a lesson takes, guessed from what is in it. A teacher can always overwrite the
 * guess; this exists so that a lesson is never labelled with nothing, and so that the
 * label moves when the lesson does — a fourth reading passage should show.
 *
 * Reading speeds are for learners, not natives: a B1 student reads English at something
 * like 150 words a minute and a grammar note slower still. Exercises are costed per unit
 * a student has to decide on. Timed games cost what their clocks add up to.
 */

const words = (text: string | undefined) => (text?.trim() ? text.trim().split(/\s+/).length : 0)

/** Minutes, as a fraction. Rounding happens once, at the end, over the whole lesson. */
export function estimateBlockMinutes(block: Block): number {
  switch (block.type) {
    case 'heading':
    case 'divider':
      return 0
    case 'text':
      return words(block.text) / 150
    case 'callout':
      return 0.1 + (words(block.title) + words(block.text)) / 150
    case 'image':
      return 0.3
    case 'audio':
      return 1.5
    case 'video':
      return block.end !== undefined && block.start !== undefined && block.end > block.start
        ? (block.end - block.start) / 60
        : 3
    case 'reading':
      return words(block.passage) / 120
    case 'multiple_choice':
      return 0.5
    case 'gap_fill':
      return 0.3 * block.segments.filter((s) => s.kind === 'gap').length
    case 'matching':
      return 0.25 * block.pairs.length
    case 'sentence_builder':
      return 0.75
    case 'categorize':
      return 0.2 * block.items.length
    case 'true_false':
      return 0.25 * block.statements.length
    case 'flashcards':
      return 0.15 * block.cards.length
    case 'free_writing':
      return Math.max(3, (block.minWords ?? 40) / 12)
    case 'quiz_game':
      return 0.5 + (block.questions.length * block.secondsPerQuestion) / 60
    case 'memory_match':
      return 0.4 * block.pairs.length
    case 'word_search':
      return 0.75 * block.words.length
    case 'dialogue_order':
      return 0.3 * block.lines.length
    case 'dictation':
      return 1 + ((block.plays || 3) * words(block.text)) / 120
    case 'speed_round':
      return 0.3 + (block.items.length * block.secondsPerItem) / 60
    case 'hangman':
      return 1.5
    case 'anagram':
      return 0.5 * block.items.length
    case 'spot_mistake':
      return 0.4 * block.items.length
    case 'highlight_words':
      return 0.5 + words(block.words.join(' ')) / 150
    case 'crossword':
      return 1 + 0.6 * block.entries.length
  }
}

/**
 * Whole minutes for a lesson, from its steps as saved. Drafts that do not yet pass the
 * schema are not counted — they are not yet part of what a student would sit through.
 * Half a minute per step covers reading the title and settling in.
 */
export function estimateMinutes(steps: { blocks: BlockDraft[] }[]): number {
  let total = 0

  for (const step of steps) {
    total += 0.5

    for (const draft of step.blocks) {
      const parsed = blockSchema.safeParse(draft)
      if (parsed.success) total += estimateBlockMinutes(parsed.data)
    }
  }

  return Math.max(1, Math.round(total))
}

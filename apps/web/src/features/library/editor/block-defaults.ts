import type { BlockDraft, BlockOfType, BlockType } from '@tp/shared'
import type { Messages } from '@/messages'

/**
 * A draft of one block type: the id and type it must have, and whatever of the finished
 * shape has been filled in so far. The editors work on these; the strict schema decides
 * when one has become a block a student can be shown.
 */
export type Draft<T extends BlockType> = BlockDraft & { type: T } & Partial<
    Omit<BlockOfType<T>, 'id' | 'type'>
  >

export type EditorProps<T extends BlockType> = {
  draft: Draft<T>
  /** A partial merge. Editors never rebuild the whole block. */
  onChange: (patch: Partial<Omit<BlockOfType<T>, 'id' | 'type'>>) => void
  t: Messages
}

/** Generated in the browser: the editor has to be able to name a thing before it is saved. */
export const uid = () => crypto.randomUUID()
const short = () => uid().slice(0, 8)

/**
 * What a block looks like the moment it is added. As close to complete as it can be
 * without inventing content: a divider is finished on arrival, a multiple choice has its
 * two empty options waiting, a video has its provider set and its id blank.
 */
export function newBlockDraft(type: BlockType): BlockDraft {
  const base = { id: uid(), type }

  switch (type) {
    case 'heading':
      return { ...base, text: '', level: 2 }
    case 'text':
      return { ...base, text: '', format: 'plain' }
    case 'callout':
      return { ...base, tone: 'info', text: '' }
    case 'image':
      return { ...base, alt: '' }
    case 'audio':
      return { ...base }
    case 'video':
      return { ...base, provider: 'youtube', videoId: '' }
    case 'divider':
      return base
    case 'reading':
      return { ...base, passage: '' }
    case 'multiple_choice':
      return {
        ...base,
        prompt: '',
        options: [
          { id: short(), text: '' },
          { id: short(), text: '' },
        ],
        correctIds: [],
        multiple: false,
        shuffle: true,
      }
    case 'gap_fill':
      return { ...base, segments: [], caseSensitive: false }
    case 'matching':
      return {
        ...base,
        pairs: [
          { id: short(), left: '', right: '' },
          { id: short(), left: '', right: '' },
        ],
      }
    case 'sentence_builder':
      return { ...base, correct: [], distractors: [] }
    case 'categorize':
      return {
        ...base,
        categories: [
          { id: short(), label: '' },
          { id: short(), label: '' },
        ],
        items: [],
      }
    case 'true_false':
      return { ...base, statements: [{ id: short(), text: '', isTrue: true }] }
    case 'flashcards':
      return { ...base, cards: [{ id: short(), front: '', back: '' }] }
    case 'free_writing':
      return { ...base, prompt: '' }
    case 'quiz_game':
      return {
        ...base,
        secondsPerQuestion: 20,
        questions: [
          {
            id: short(),
            prompt: '',
            options: [
              { id: short(), text: '' },
              { id: short(), text: '' },
            ],
            correctId: '',
          },
        ],
      }
    case 'memory_match':
      return {
        ...base,
        pairs: [
          { id: short(), a: '', b: '' },
          { id: short(), a: '', b: '' },
        ],
      }
    case 'word_search':
      // The grid is built by the editor from the words as they are typed.
      return { ...base, words: [], size: 10, grid: [], placements: [] }
    case 'dialogue_order':
      return {
        ...base,
        lines: [
          { id: short(), speaker: '', text: '' },
          { id: short(), speaker: '', text: '' },
        ],
      }
    case 'dictation':
      return { ...base, text: '', rate: 0.9, plays: 3 }
    case 'speed_round':
      return {
        ...base,
        secondsPerItem: 10,
        caseSensitive: false,
        items: [{ id: short(), segments: [] }],
      }
    case 'hangman':
      return { ...base, word: '', maxMisses: 6 }
    case 'anagram':
      return { ...base, items: [{ id: short(), word: '' }] }
    case 'spot_mistake':
      return { ...base, items: [{ id: short(), words: [], wrongIndex: -1, correction: '' }] }
    case 'highlight_words':
      return { ...base, prompt: '', words: [], targets: [] }
    case 'crossword':
      return {
        ...base,
        entries: [
          { id: short(), answer: '', clue: '' },
          { id: short(), answer: '', clue: '' },
        ],
        size: 5,
        placements: [],
      }
  }
}

export const newId = short

/* --------------------------------------------------------------- gap syntax --- */

export type GapSegment =
  { kind: 'text'; text: string } | { kind: 'gap'; id: string; answers: string[]; hint?: string }

const GAP = /\[\[([^\]]*)\]\]/g

/**
 * A gap-fill is written as one piece of text with the gaps marked inline —
 * `She [[has|'s]] been here` — because that is how a teacher thinks of it: a sentence
 * with holes, not a list of holes with sentence fragments between them.
 */
export function textToSegments(text: string): GapSegment[] {
  const segments: GapSegment[] = []
  let last = 0
  let count = 0

  for (const match of text.matchAll(GAP)) {
    const at = match.index ?? 0
    if (at > last) segments.push({ kind: 'text', text: text.slice(last, at) })

    count += 1
    segments.push({
      kind: 'gap',
      id: `g${count}`,
      answers: (match[1] ?? '')
        .split('|')
        .map((answer) => answer.trim())
        .filter(Boolean),
    })

    last = at + match[0].length
  }

  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) })

  return segments
}

export function segmentsToText(segments: GapSegment[] | undefined): string {
  return (segments ?? [])
    .map((segment) => (segment.kind === 'text' ? segment.text : `[[${segment.answers.join('|')}]]`))
    .join('')
}

/** "I have never been there" → the tokens a student will be handed to reorder. */
export const splitWords = (value: string) =>
  value
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)

/** Accepts a pasted YouTube URL or a bare id and keeps only the id. */
export function extractYouTubeId(input: string): string {
  const trimmed = input.trim()
  const fromUrl = trimmed.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/)

  return fromUrl?.[1] ?? trimmed
}

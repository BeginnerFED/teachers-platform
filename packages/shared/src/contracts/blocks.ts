import { z } from 'zod'
import type { ActivityType } from '../constants'

/**
 * A block is the unit a step is built from. One definition, two consumers: the editor
 * writes blocks and the player draws them, so a new block type is a change here and
 * nowhere else in the database.
 *
 * Two families share the same canvas. Presentation blocks say something; exercise blocks
 * ask something and can be marked. They flow one under another rather than being placed
 * at coordinates, because a phone is 390px wide and a lesson built at 1440px has to
 * survive the trip.
 */

/**
 * Identifies a block, an option, a gap — anything the answer payload has to point back
 * at. Generated client-side (`crypto.randomUUID()`), never by the database: the editor
 * has to be able to name a thing before it has ever been saved.
 */
const localId = z.string().trim().min(1).max(64)

const blockBase = z.object({ id: localId })

/**
 * Anything a student can be marked on carries this. `points` is the block's total, not a
 * per-gap rate — a five-gap exercise worth 2 points gives 0.4 per gap. Left undefined it
 * defaults to one point per answerable unit, which is what a teacher expects when they
 * have not thought about weighting.
 */
const exerciseBase = blockBase.extend({
  points: z.number().min(0).max(100).optional(),
})

/* ------------------------------------------------------------------ presentation --- */

export const HEADING_LEVELS = [2, 3] as const

/** The step's own title is the h1, so headings inside it start at h2. */
export const headingBlock = blockBase.extend({
  type: z.literal('heading'),
  text: z.string().trim().min(1).max(200),
  level: z.union([z.literal(2), z.literal(3)]).default(2),
})

/**
 * `format` is a discriminator with one member on purpose. Phase 1 stores plain text;
 * adding `'rich'` later then widens a union instead of reinterpreting every row already
 * written — the migration that would otherwise be impossible to get right.
 */
export const textBlock = blockBase.extend({
  type: z.literal('text'),
  format: z.literal('plain').default('plain'),
  text: z.string().max(5000),
})

export const CALLOUT_TONES = ['info', 'tip', 'warning', 'grammar'] as const
export type CalloutTone = (typeof CALLOUT_TONES)[number]

export const calloutBlock = blockBase.extend({
  type: z.literal('callout'),
  tone: z.enum(CALLOUT_TONES).default('info'),
  title: z.string().trim().max(120).optional(),
  text: z.string().min(1).max(2000),
})

export const imageBlock = blockBase.extend({
  type: z.literal('image'),
  assetId: z.uuid(),
  /** Required, not optional: a picture with no description is invisible to some students. */
  alt: z.string().trim().min(1).max(300),
  caption: z.string().trim().max(300).optional(),
})

export const audioBlock = blockBase.extend({
  type: z.literal('audio'),
  assetId: z.uuid(),
  caption: z.string().trim().max(300).optional(),
  /** Shown behind a toggle. Listening practice is ruined if it is visible by default. */
  transcript: z.string().max(5000).optional(),
})

/**
 * Embedded, never hosted. Hosting video is the single most expensive thing this platform
 * could decide to do, and an embed is meaningfully harder to walk away with than a file.
 */
export const videoBlock = blockBase.extend({
  type: z.literal('video'),
  provider: z.literal('youtube'),
  videoId: z
    .string()
    .trim()
    .regex(/^[\w-]{11}$/, 'Not a YouTube video id'),
  /** Seconds. A teacher usually wants one minute out of the middle of a clip. */
  start: z.number().int().min(0).optional(),
  end: z.number().int().min(0).optional(),
  caption: z.string().trim().max(300).optional(),
})

export const dividerBlock = blockBase.extend({
  type: z.literal('divider'),
})

/* --------------------------------------------------------------------- exercises --- */

const choiceOption = z.object({ id: localId, text: z.string().trim().min(1).max(300) })

export const multipleChoiceBlock = exerciseBase
  .extend({
    type: z.literal('multiple_choice'),
    prompt: z.string().trim().min(1).max(1000),
    options: z.array(choiceOption).min(2).max(8),
    correctIds: z.array(localId).min(1),
    /** Select-all-that-apply. Marked as one unit: partial credit here rewards guessing. */
    multiple: z.boolean().default(false),
    shuffle: z.boolean().default(true),
    /** Shown after answering, never before. */
    explanation: z.string().trim().max(1000).optional(),
  })
  .refine((b) => b.correctIds.every((id) => b.options.some((o) => o.id === id)), {
    message: 'correctIds must all name an option',
    path: ['correctIds'],
  })
  .refine((b) => b.multiple || b.correctIds.length === 1, {
    message: 'A single-answer question needs exactly one correct option',
    path: ['correctIds'],
  })

/**
 * `kind` rather than `type` for the segments: a block already owns `type`, and two
 * discriminators with the same name one level apart is how you write a bug you cannot see.
 */
const gapSegment = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), text: z.string().max(1000) }),
  z.object({
    kind: z.literal('gap'),
    id: localId,
    /** Every spelling that counts. "colour" and "color" are both right. */
    answers: z.array(z.string().trim().min(1).max(120)).min(1).max(10),
    hint: z.string().trim().max(120).optional(),
  }),
])

export type GapSegment = z.infer<typeof gapSegment>

export const gapFillBlock = exerciseBase
  .extend({
    type: z.literal('gap_fill'),
    prompt: z.string().trim().max(1000).optional(),
    segments: z.array(gapSegment).min(1).max(60),
    caseSensitive: z.boolean().default(false),
  })
  .refine((b) => b.segments.some((s) => s.kind === 'gap'), {
    message: 'A gap-fill needs at least one gap',
    path: ['segments'],
  })

export const matchingBlock = exerciseBase.extend({
  type: z.literal('matching'),
  prompt: z.string().trim().max(1000).optional(),
  pairs: z
    .array(
      z.object({
        id: localId,
        left: z.string().trim().min(1).max(200),
        right: z.string().trim().min(1).max(200),
      }),
    )
    .min(2)
    .max(10),
})

export const sentenceBuilderBlock = exerciseBase.extend({
  type: z.literal('sentence_builder'),
  prompt: z.string().trim().max(1000).optional(),
  /** The sentence, already in order. The player shuffles it. */
  correct: z.array(z.string().trim().min(1).max(60)).min(2).max(20),
  /** Extra tokens that belong in no correct answer. Optional cruelty. */
  distractors: z.array(z.string().trim().min(1).max(60)).max(6).default([]),
})

export const categorizeBlock = exerciseBase
  .extend({
    type: z.literal('categorize'),
    prompt: z.string().trim().max(1000).optional(),
    categories: z
      .array(z.object({ id: localId, label: z.string().trim().min(1).max(80) }))
      .min(2)
      .max(5),
    items: z
      .array(
        z.object({
          id: localId,
          text: z.string().trim().min(1).max(200),
          categoryId: localId,
        }),
      )
      .min(2)
      .max(20),
  })
  .refine((b) => b.items.every((i) => b.categories.some((c) => c.id === i.categoryId)), {
    message: 'Every item must belong to one of the categories',
    path: ['items'],
  })

export const trueFalseBlock = exerciseBase.extend({
  type: z.literal('true_false'),
  prompt: z.string().trim().max(1000).optional(),
  statements: z
    .array(
      z.object({
        id: localId,
        text: z.string().trim().min(1).max(400),
        isTrue: z.boolean(),
      }),
    )
    .min(1)
    .max(10),
})

/** Practice, not assessment. Carries no marks by design. */
export const flashcardsBlock = exerciseBase.extend({
  type: z.literal('flashcards'),
  prompt: z.string().trim().max(1000).optional(),
  cards: z
    .array(
      z.object({
        id: localId,
        front: z.string().trim().min(1).max(200),
        back: z.string().trim().min(1).max(400),
        hint: z.string().trim().max(200).optional(),
      }),
    )
    .min(1)
    .max(40),
})

/**
 * A passage to read. Comprehension questions are separate blocks placed under it, which
 * is why this one carries no answers: the alternative is a second, weaker copy of
 * multiple choice living inside here.
 */
export const readingBlock = exerciseBase.extend({
  type: z.literal('reading'),
  title: z.string().trim().max(200).optional(),
  passage: z.string().min(1).max(20000),
  /** Read-along audio. The same recording the listening block would use. */
  audioAssetId: z.uuid().optional(),
})

/** The only block a machine cannot mark. A human reads it. */
export const freeWritingBlock = exerciseBase.extend({
  type: z.literal('free_writing'),
  prompt: z.string().trim().min(1).max(1000),
  minWords: z.number().int().min(1).max(2000).optional(),
  maxWords: z.number().int().min(1).max(2000).optional(),
  /** What the teacher is looking for. Shown to the student too — no secret rubrics. */
  rubric: z.string().trim().max(1000).optional(),
})

export const quizGameBlock = exerciseBase
  .extend({
    type: z.literal('quiz_game'),
    prompt: z.string().trim().max(1000).optional(),
    secondsPerQuestion: z.number().int().min(5).max(120).default(20),
    questions: z
      .array(
        z.object({
          id: localId,
          prompt: z.string().trim().min(1).max(300),
          options: z.array(choiceOption).min(2).max(4),
          correctId: localId,
        }),
      )
      .min(1)
      .max(20),
  })
  .refine((b) => b.questions.every((q) => q.options.some((o) => o.id === q.correctId)), {
    message: 'Every question needs its correct option present',
    path: ['questions'],
  })

/* ------------------------------------------------------------------------ games --- */

/** Turn over two cards, find the pair. Practice, like flashcards: finding it is the point. */
export const memoryMatchBlock = exerciseBase.extend({
  type: z.literal('memory_match'),
  prompt: z.string().trim().max(1000).optional(),
  pairs: z
    .array(
      z.object({
        id: localId,
        a: z.string().trim().min(1).max(60),
        b: z.string().trim().min(1).max(60),
      }),
    )
    .min(2)
    .max(12),
})

const gridCell = z.object({ r: z.number().int().min(0), c: z.number().int().min(0) })

/**
 * The grid is generated when the block is written and stored with it, so every student
 * gets the same puzzle and the placements — which are the answer — can stay on the server.
 * Words are upper-case letters only; the editor normalises what the teacher types.
 */
export const wordSearchBlock = exerciseBase
  .extend({
    type: z.literal('word_search'),
    prompt: z.string().trim().max(1000).optional(),
    words: z
      .array(z.string().regex(/^[A-Z]{2,12}$/))
      .min(1)
      .max(12),
    size: z.number().int().min(6).max(16),
    grid: z.array(z.array(z.string().regex(/^[A-Z]$/))),
    placements: z.array(z.object({ word: z.string(), cells: z.array(gridCell).min(2) })),
  })
  .refine((b) => b.grid.length === b.size && b.grid.every((row) => row.length === b.size), {
    message: 'The grid must be size by size',
    path: ['grid'],
  })
  .refine((b) => b.words.every((word) => b.placements.some((p) => p.word === word)), {
    message: 'Every word needs a placement',
    path: ['placements'],
  })

/** A conversation with its lines shuffled, to be put back in the order it was spoken. */
export const dialogueOrderBlock = exerciseBase.extend({
  type: z.literal('dialogue_order'),
  prompt: z.string().trim().max(1000).optional(),
  /** In the order they are spoken. The player shuffles. */
  lines: z
    .array(
      z.object({
        id: localId,
        speaker: z.string().trim().min(1).max(40),
        text: z.string().trim().min(1).max(300),
      }),
    )
    .min(2)
    .max(12),
})

/**
 * Read aloud by the browser's own voice and typed back. The text has to reach the browser
 * for that — this is the one block whose answer is, by its nature, on the client, exactly
 * as it would be inside a recording.
 */
export const dictationBlock = exerciseBase.extend({
  type: z.literal('dictation'),
  prompt: z.string().trim().max(1000).optional(),
  text: z.string().trim().min(1).max(500),
  /** Speech rate. Slower for lower levels. */
  rate: z.number().min(0.5).max(1.2).default(0.9),
  /** How many times it may be played. Zero means no limit. */
  plays: z.number().int().min(0).max(10).default(3),
})

/** Short gap-fills against a clock, one after another. */
export const speedRoundBlock = exerciseBase
  .extend({
    type: z.literal('speed_round'),
    prompt: z.string().trim().max(1000).optional(),
    secondsPerItem: z.number().int().min(5).max(60).default(10),
    caseSensitive: z.boolean().default(false),
    items: z
      .array(z.object({ id: localId, segments: z.array(gapSegment).min(1).max(30) }))
      .min(1)
      .max(20),
  })
  .refine((b) => b.items.every((item) => item.segments.some((s) => s.kind === 'gap')), {
    message: 'Every item needs a gap',
    path: ['items'],
  })

/**
 * Guess the word a letter at a time. Practice: the letters have to be revealed as they
 * are guessed, so the word is on the client, and so it carries no marks — like flashcards.
 */
export const hangmanBlock = exerciseBase.extend({
  type: z.literal('hangman'),
  prompt: z.string().trim().max(1000).optional(),
  word: z.string().regex(/^[A-Z]{2,15}$/),
  hint: z.string().trim().max(120).optional(),
  maxMisses: z.number().int().min(3).max(10).default(6),
})

/** The letters of a word, shuffled by the server; the student puts them back. */
export const anagramBlock = exerciseBase.extend({
  type: z.literal('anagram'),
  prompt: z.string().trim().max(1000).optional(),
  items: z
    .array(
      z.object({
        id: localId,
        word: z.string().regex(/^[A-Za-z][A-Za-z'-]{1,19}$/),
        hint: z.string().trim().max(120).optional(),
      }),
    )
    .min(1)
    .max(12),
})

/** A sentence with one wrong word in it. Tap the word. */
export const spotMistakeBlock = exerciseBase
  .extend({
    type: z.literal('spot_mistake'),
    prompt: z.string().trim().max(1000).optional(),
    items: z
      .array(
        z.object({
          id: localId,
          words: z.array(z.string().min(1).max(40)).min(2).max(40),
          wrongIndex: z.number().int().min(0),
          correction: z.string().trim().min(1).max(60),
        }),
      )
      .min(1)
      .max(10),
  })
  .refine((b) => b.items.every((item) => item.wrongIndex < item.words.length), {
    message: 'wrongIndex must point at one of the words',
    path: ['items'],
  })

/** "Find every adjective": tap words in a passage. Marked per target, plus one for restraint. */
export const highlightWordsBlock = exerciseBase
  .extend({
    type: z.literal('highlight_words'),
    prompt: z.string().trim().min(1).max(1000),
    words: z.array(z.string().min(1).max(40)).min(2).max(200),
    targets: z.array(z.number().int().min(0)).min(1),
  })
  .refine(
    (b) =>
      new Set(b.targets).size === b.targets.length && b.targets.every((i) => i < b.words.length),
    { message: 'targets must be distinct indexes into words', path: ['targets'] },
  )

const CROSSWORD_DIRECTIONS = ['across', 'down'] as const

/**
 * Laid out when the block is written and stored with it, like the word search. The
 * student gets the shape — where each word starts, which way it runs, how long it is —
 * and the clues; the letters stay on the server.
 */
export const crosswordBlock = exerciseBase
  .extend({
    type: z.literal('crossword'),
    prompt: z.string().trim().max(1000).optional(),
    entries: z
      .array(
        z.object({
          id: localId,
          answer: z.string().regex(/^[A-Z]{2,15}$/),
          clue: z.string().trim().min(1).max(200),
        }),
      )
      .min(2)
      .max(15),
    size: z.number().int().min(5).max(24),
    placements: z.array(
      z.object({
        id: localId,
        r: z.number().int().min(0),
        c: z.number().int().min(0),
        dir: z.enum(CROSSWORD_DIRECTIONS),
      }),
    ),
  })
  .refine(
    (b) =>
      b.entries.every((entry) => {
        const at = b.placements.find((p) => p.id === entry.id)
        if (!at) return false
        const end = at.dir === 'across' ? at.c + entry.answer.length : at.r + entry.answer.length
        return end <= b.size
      }),
    { message: 'Every entry needs a placement that fits the grid', path: ['placements'] },
  )

/* ------------------------------------------------------------------------- union --- */

export const PRESENTATION_BLOCK_TYPES = [
  'heading',
  'text',
  'callout',
  'image',
  'audio',
  'video',
  'divider',
] as const
export type PresentationBlockType = (typeof PRESENTATION_BLOCK_TYPES)[number]

export const EXERCISE_BLOCK_TYPES = [
  'multiple_choice',
  'gap_fill',
  'matching',
  'sentence_builder',
  'categorize',
  'true_false',
  'flashcards',
  'reading',
  'free_writing',
  'quiz_game',
  'memory_match',
  'word_search',
  'dialogue_order',
  'dictation',
  'speed_round',
  'hangman',
  'anagram',
  'spot_mistake',
  'highlight_words',
  'crossword',
] as const
export type ExerciseBlockType = (typeof EXERCISE_BLOCK_TYPES)[number]

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never

/**
 * Compile-time tripwire. `ACTIVITY_TYPES` and the exercise arm of the block union are two
 * lists of the same thing; the day one grows a member the other lacks, this stops being
 * assignable and `type-check` fails here rather than at runtime in front of a student.
 */
export const exerciseTypesMatchActivityTypes: Exact<ExerciseBlockType, ActivityType> = true

export const blockSchema = z.discriminatedUnion('type', [
  headingBlock,
  textBlock,
  calloutBlock,
  imageBlock,
  audioBlock,
  videoBlock,
  dividerBlock,
  multipleChoiceBlock,
  gapFillBlock,
  matchingBlock,
  sentenceBuilderBlock,
  categorizeBlock,
  trueFalseBlock,
  flashcardsBlock,
  freeWritingBlock,
  readingBlock,
  quizGameBlock,
  memoryMatchBlock,
  wordSearchBlock,
  dialogueOrderBlock,
  dictationBlock,
  speedRoundBlock,
  hangmanBlock,
  anagramBlock,
  spotMistakeBlock,
  highlightWordsBlock,
  crosswordBlock,
])

export type Block = z.infer<typeof blockSchema>
export type BlockType = Block['type']

/** Narrowed views, so a function can say which family it deals in. */
export type PresentationBlock = Extract<Block, { type: PresentationBlockType }>
export type ExerciseBlock = Extract<Block, { type: ExerciseBlockType }>
export type BlockOfType<T extends BlockType> = Extract<Block, { type: T }>

/** What a step holds. A page, not a paragraph — but not a book either. */
export const blocksSchema = z.array(blockSchema).max(60)

export function isExerciseBlock(block: Block): block is ExerciseBlock {
  return (EXERCISE_BLOCK_TYPES as readonly string[]).includes(block.type)
}

/**
 * The exercises that actually carry marks. Flashcards, a reading passage and the memory
 * game are practice — they belong on the same canvas but there is nothing in them to be
 * wrong about, so a step made only of those has nothing to check.
 */
export const GRADED_BLOCK_TYPES = EXERCISE_BLOCK_TYPES.filter(
  (
    type,
  ): type is Exclude<ExerciseBlockType, 'flashcards' | 'reading' | 'memory_match' | 'hangman'> =>
    type !== 'flashcards' && type !== 'reading' && type !== 'memory_match' && type !== 'hangman',
)

/* -------------------------------------------------------------------- drafts --- */

export const BLOCK_TYPES = [...PRESENTATION_BLOCK_TYPES, ...EXERCISE_BLOCK_TYPES] as const

/**
 * What the editor is allowed to save: a block that knows what it is and has an id, and
 * otherwise whatever the author has typed so far. A multiple-choice question is invalid
 * for the whole minute between "add block" and "tick the right answer", and refusing to
 * save during that minute is how autosave becomes a thing people turn off.
 *
 * The strict `blockSchema` still decides what a student sees. The player and the marker
 * parse with it and drop whatever does not pass, so an unfinished block sits safely in
 * the database and is simply absent from the lesson until it is finished.
 */
export const blockDraftSchema = z.looseObject({ id: localId, type: z.enum(BLOCK_TYPES) })

export type BlockDraft = z.infer<typeof blockDraftSchema>

export const blockDraftsSchema = z.array(blockDraftSchema).max(60)

/** True when the draft would be shown to a student exactly as it stands. */
export function isCompleteBlock(draft: BlockDraft): boolean {
  return blockSchema.safeParse(draft).success
}

/* ---------------------------------------------------------------- student view --- */

/**
 * What a student is allowed to receive. The answer key never reaches their browser, so
 * every field that *is* the answer is either removed or replaced by something that cannot
 * be reversed — and marking therefore always happens on the server.
 *
 * This lives in the same file as the blocks themselves on purpose: the day somebody adds
 * a `correctAnswer` field, the function that has to strip it is the next thing they read.
 */
export type StudentGapSegment =
  { kind: 'text'; text: string } | { kind: 'gap'; id: string; hint?: string }

export type StudentBlock =
  // Nothing to hide: these say things rather than ask them, or are practice.
  | PresentationBlock
  | BlockOfType<'flashcards'>
  | BlockOfType<'reading'>
  | BlockOfType<'free_writing'>
  | BlockOfType<'memory_match'>
  | BlockOfType<'dictation'>
  | Omit<BlockOfType<'multiple_choice'>, 'correctIds' | 'explanation'>
  | (Omit<BlockOfType<'gap_fill'>, 'segments'> & { segments: StudentGapSegment[] })
  | (Omit<BlockOfType<'matching'>, 'pairs'> & {
      lefts: { id: string; text: string }[]
      /** Shuffled, and carrying no id — the id would name the pair it belongs to. */
      rights: string[]
    })
  | (Omit<BlockOfType<'sentence_builder'>, 'correct' | 'distractors'> & { tokens: string[] })
  | (Omit<BlockOfType<'categorize'>, 'items'> & { items: { id: string; text: string }[] })
  | (Omit<BlockOfType<'true_false'>, 'statements'> & {
      statements: { id: string; text: string }[]
    })
  | (Omit<BlockOfType<'quiz_game'>, 'questions'> & {
      questions: { id: string; prompt: string; options: { id: string; text: string }[] }[]
    })
  | Omit<BlockOfType<'word_search'>, 'placements'>
  /** The lines, shuffled. Their ids are random and so say nothing about the order. */
  | BlockOfType<'dialogue_order'>
  | (Omit<BlockOfType<'speed_round'>, 'items'> & {
      items: { id: string; segments: StudentGapSegment[] }[]
    })
  /** Practice: the word has to be there to be revealed letter by letter. */
  | BlockOfType<'hangman'>
  | (Omit<BlockOfType<'anagram'>, 'items'> & {
      items: { id: string; letters: string[]; hint?: string }[]
    })
  | (Omit<BlockOfType<'spot_mistake'>, 'items'> & { items: { id: string; words: string[] }[] })
  | Omit<BlockOfType<'highlight_words'>, 'targets'>
  | (Omit<BlockOfType<'crossword'>, 'entries'> & {
      entries: { id: string; clue: string; length: number }[]
    })

/** Fisher–Yates. Takes its randomness as an argument so the projection stays testable. */
function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items]

  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const a = out[i]
    const b = out[j]
    if (a !== undefined && b !== undefined) {
      out[i] = b
      out[j] = a
    }
  }

  return out
}

const stripGaps = (segments: GapSegment[]): StudentGapSegment[] =>
  segments.map((s) =>
    s.kind === 'gap' ? { kind: 'gap', id: s.id, ...(s.hint ? { hint: s.hint } : {}) } : s,
  )

export function toStudentBlock(block: Block, rand: () => number = Math.random): StudentBlock {
  switch (block.type) {
    case 'multiple_choice': {
      // The option order is the author's; `shuffle` tells the player to vary it. Which
      // option is right is simply absent.
      const { correctIds: _correctIds, explanation: _explanation, ...rest } = block

      return rest
    }

    case 'gap_fill': {
      const { segments, ...rest } = block

      return { ...rest, segments: stripGaps(segments) }
    }

    case 'matching': {
      const { pairs, ...rest } = block

      return {
        ...rest,
        lefts: pairs.map((p) => ({ id: p.id, text: p.left })),
        rights: shuffled(
          pairs.map((p) => p.right),
          rand,
        ),
      }
    }

    case 'sentence_builder': {
      const { correct, distractors, ...rest } = block

      // Shuffled here rather than in the player: sending them in order is sending the
      // answer, however carefully the component promises to mix them up.
      return { ...rest, tokens: shuffled([...correct, ...distractors], rand) }
    }

    case 'categorize': {
      const { items, ...rest } = block

      return { ...rest, items: items.map((i) => ({ id: i.id, text: i.text })) }
    }

    case 'true_false': {
      const { statements, ...rest } = block

      return { ...rest, statements: statements.map((s) => ({ id: s.id, text: s.text })) }
    }

    case 'quiz_game': {
      const { questions, ...rest } = block

      return {
        ...rest,
        questions: questions.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options })),
      }
    }

    case 'word_search': {
      // The grid and the words to find are the puzzle; where the words are is the answer.
      const { placements: _placements, ...rest } = block

      return rest
    }

    case 'dialogue_order': {
      // Shuffled here for the same reason as the sentence tokens. The ids are random
      // strings, so their order in this list is all the student learns from them.
      const { lines, ...rest } = block

      return { ...rest, lines: shuffled(lines, rand) }
    }

    case 'speed_round': {
      const { items, ...rest } = block

      return {
        ...rest,
        items: items.map((item) => ({ id: item.id, segments: stripGaps(item.segments) })),
      }
    }

    case 'anagram': {
      // The letters, mixed. A shuffle that happens to leave a short word in order is
      // still a puzzle the student has to look at; it is not a leak.
      const { items, ...rest } = block

      return {
        ...rest,
        items: items.map((item) => ({
          id: item.id,
          letters: shuffled([...item.word], rand),
          ...(item.hint ? { hint: item.hint } : {}),
        })),
      }
    }

    case 'spot_mistake': {
      const { items, ...rest } = block

      return { ...rest, items: items.map((item) => ({ id: item.id, words: item.words })) }
    }

    case 'highlight_words': {
      const { targets: _targets, ...rest } = block

      return rest
    }

    case 'crossword': {
      // The shape of every word — where, which way, how long — and its clue. Not a letter.
      const { entries, ...rest } = block

      return {
        ...rest,
        entries: entries.map((entry) => ({
          id: entry.id,
          clue: entry.clue,
          length: entry.answer.length,
        })),
      }
    }

    // Flashcards, the memory game and hangman show their words by design, a passage is
    // meant to be read, a writing prompt has no key, and a dictation must be heard.
    default:
      return block
  }
}

import { describe, expect, it } from 'vitest'
import {
  BLOCK_TYPES,
  blockSchema,
  toStudentBlock,
  type Block,
  type BlockType,
} from './contracts/blocks'
import {
  applyBoardOps,
  boardOp,
  liveBlockParts,
  liveBlockValueFits,
  type LiveBoard,
} from './contracts/live'

/**
 * The browser's copy of what the database does to a board. If these two ever disagree, a
 * gesture drawn before the server confirms it would jump when the confirmation lands.
 */
describe('applyBoardOps', () => {
  it('sets a leaf, creating the parents it needs', () => {
    const next = applyBoardOps({}, [
      { t: 'set', path: ['answers', 'step-1', 'block-a'], value: ['b'] },
    ])

    expect(next).toEqual({ answers: { 'step-1': { 'block-a': ['b'] } } })
  })

  it('keeps siblings when it sets', () => {
    const board: LiveBoard = { answers: { 'step-1': { 'block-a': ['b'] } } }
    const next = applyBoardOps(board, [
      { t: 'set', path: ['answers', 'step-1', 'block-b'], value: 'typed' },
    ])

    expect(next.answers?.['step-1']).toEqual({ 'block-a': ['b'], 'block-b': 'typed' })
  })

  it('replaces a parent that is not an object, as the database does', () => {
    const next = applyBoardOps({ ui: { s: { b: 'flat' } } }, [
      { t: 'set', path: ['ui', 's', 'b', 'flipped'], value: true },
    ])

    expect(next.ui?.s).toEqual({ b: { flipped: true } })
  })

  it('unsets a leaf and leaves the rest alone', () => {
    const board: LiveBoard = { answers: { s: { a: 1, b: 2 } } }
    const next = applyBoardOps(board, [{ t: 'unset', path: ['answers', 's', 'a'] }])

    expect(next).toEqual({ answers: { s: { b: 2 } } })
  })

  it('unsetting what is not there changes nothing', () => {
    const board: LiveBoard = { answers: { s: { a: 1 } } }

    expect(applyBoardOps(board, [{ t: 'unset', path: ['results', 's'] }])).toBe(board)
    expect(applyBoardOps(board, [{ t: 'unset', path: ['answers', 's', 'zz'] }])).toBe(board)
  })

  it('applies a batch in order', () => {
    const next = applyBoardOps({}, [
      { t: 'set', path: ['ui', 's', 'b'], value: { index: 1 } },
      { t: 'set', path: ['ui', 's', 'b', 'index'], value: 2 },
      { t: 'unset', path: ['ui', 's', 'b', 'index'] },
    ])

    expect(next).toEqual({ ui: { s: { b: {} } } })
  })

  it('is idempotent, so the server echo of an optimistic change is harmless', () => {
    const ops = boardOp.array().parse([
      { t: 'set', path: ['answers', 's', 'a'], value: ['x'] },
      { t: 'unset', path: ['answers', 's', 'b'] },
    ])
    const once = applyBoardOps({ answers: { s: { b: 'gone' } } }, ops)
    const twice = applyBoardOps(once, ops)

    expect(twice).toEqual(once)
  })

  it('never mutates the board it is given', () => {
    const board: LiveBoard = { answers: { s: { a: 1 } } }
    const frozen = JSON.stringify(board)

    applyBoardOps(board, [
      { t: 'set', path: ['answers', 's', 'a'], value: 2 },
      { t: 'set', path: ['ui', 's', 'x'], value: true },
      { t: 'unset', path: ['answers', 's', 'a'] },
    ])

    expect(JSON.stringify(board)).toBe(frozen)
  })
})

/** Built through the schema so the fixtures carry the same defaults production data does. */
const block = (input: unknown): Block => blockSchema.parse(input)

const letters = (row: string) => row.split('')

/** One of every block type, as an author saves it. */
const EVERY_BLOCK: Record<BlockType, Block> = {
  heading: block({ id: 'h', type: 'heading', text: 'Title' }),
  text: block({ id: 't', type: 'text', text: 'Words' }),
  callout: block({ id: 'co', type: 'callout', text: 'Note' }),
  image: block({
    id: 'im',
    type: 'image',
    assetId: '11111111-1111-4111-8111-111111111111',
    alt: 'A cat',
  }),
  audio: block({
    id: 'au',
    type: 'audio',
    assetId: '22222222-2222-4222-8222-222222222222',
    transcript: 'Hi.',
  }),
  video: block({ id: 'vi', type: 'video', provider: 'youtube', videoId: 'dQw4w9WgXcQ' }),
  divider: block({ id: 'di', type: 'divider' }),
  multiple_choice: block({
    id: 'mc',
    type: 'multiple_choice',
    prompt: 'Pick',
    options: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ],
    correctIds: ['b'],
  }),
  gap_fill: block({
    id: 'gf',
    type: 'gap_fill',
    segments: [
      { kind: 'text', text: 'I ' },
      { kind: 'gap', id: 'g1', answers: ['am'] },
      { kind: 'text', text: ' and you ' },
      { kind: 'gap', id: 'g2', answers: ['are'] },
    ],
  }),
  matching: block({
    id: 'ma',
    type: 'matching',
    pairs: [
      { id: 'p1', left: 'cat', right: 'кіт' },
      { id: 'p2', left: 'dog', right: 'пес' },
    ],
  }),
  sentence_builder: block({ id: 'sb', type: 'sentence_builder', correct: ['I', 'am'] }),
  categorize: block({
    id: 'ca',
    type: 'categorize',
    categories: [
      { id: 'c1', label: 'One' },
      { id: 'c2', label: 'Two' },
    ],
    items: [
      { id: 'i1', text: 'apple', categoryId: 'c1' },
      { id: 'i2', text: 'water', categoryId: 'c2' },
    ],
  }),
  true_false: block({
    id: 'tf',
    type: 'true_false',
    statements: [
      { id: 's1', text: 'Yes', isTrue: true },
      { id: 's2', text: 'No', isTrue: false },
    ],
  }),
  flashcards: block({ id: 'fc', type: 'flashcards', cards: [{ id: 'f1', front: 'a', back: 'b' }] }),
  reading: block({ id: 're', type: 'reading', passage: 'Once upon a time.' }),
  free_writing: block({ id: 'fw', type: 'free_writing', prompt: 'Write' }),
  quiz_game: block({
    id: 'qz',
    type: 'quiz_game',
    questions: [
      {
        id: 'q1',
        prompt: 'Which?',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correctId: 'a',
      },
    ],
  }),
  memory_match: block({
    id: 'mm',
    type: 'memory_match',
    pairs: [
      { id: 'm1', a: 'dog', b: 'пес' },
      { id: 'm2', a: 'sun', b: 'сонце' },
    ],
  }),
  word_search: block({
    id: 'ws',
    type: 'word_search',
    words: ['CAT', 'DOG'],
    size: 6,
    grid: ['CATXQZ', 'DOGWVY', 'PLMNBR', 'KJHGFD', 'SAEUIO', 'TRWQLK'].map(letters),
    placements: [
      {
        word: 'CAT',
        cells: [
          { r: 0, c: 0 },
          { r: 0, c: 1 },
          { r: 0, c: 2 },
        ],
      },
      {
        word: 'DOG',
        cells: [
          { r: 1, c: 0 },
          { r: 1, c: 1 },
          { r: 1, c: 2 },
        ],
      },
    ],
  }),
  dialogue_order: block({
    id: 'do',
    type: 'dialogue_order',
    lines: [
      { id: 'l1', speaker: 'Ann', text: 'Hello!' },
      { id: 'l2', speaker: 'Bob', text: 'Hi!' },
    ],
  }),
  dictation: block({ id: 'dc', type: 'dictation', text: 'I have a cat.' }),
  speed_round: block({
    id: 'sr',
    type: 'speed_round',
    items: [
      { id: 'it1', segments: [{ kind: 'gap', id: 'g1', answers: ['is'] }] },
      { id: 'it2', segments: [{ kind: 'gap', id: 'g1', answers: ['are'] }] },
    ],
  }),
  hangman: block({ id: 'hm', type: 'hangman', word: 'APPLE' }),
  anagram: block({ id: 'an', type: 'anagram', items: [{ id: 'x1', word: 'planet' }] }),
  spot_mistake: block({
    id: 'sm',
    type: 'spot_mistake',
    items: [{ id: 'sm1', words: ['She', 'go'], wrongIndex: 1, correction: 'goes' }],
  }),
  highlight_words: block({
    id: 'hl',
    type: 'highlight_words',
    prompt: 'Find',
    words: ['big', 'dog'],
    targets: [0],
  }),
  crossword: block({
    id: 'cw',
    type: 'crossword',
    entries: [
      { id: 'e1', answer: 'ZEBRA', clue: 'Striped' },
      { id: 'e2', answer: 'BEAR', clue: 'Brown' },
    ],
    size: 5,
    placements: [
      { id: 'e1', r: 0, c: 0, dir: 'across' },
      { id: 'e2', r: 0, c: 2, dir: 'down' },
    ],
  }),
}

/**
 * What each player hands the board as its answer, in the shape it builds it: the keys of a
 * map are written one by one, anything else whole. Mirrors the block components.
 */
const PLAYED_ANSWERS: Partial<Record<BlockType, unknown>> = {
  multiple_choice: ['b'],
  gap_fill: { g1: 'am', g2: 'are' },
  matching: { p1: 'кіт', p2: 'пес' },
  sentence_builder: ['I', 'am'],
  categorize: { i1: 'c1', i2: 'c2' },
  true_false: { s1: true, s2: false },
  free_writing: 'An essay.',
  quiz_game: { q1: 'a' },
  word_search: { CAT: [{ r: 0, c: 0 }], DOG: [{ r: 1, c: 0 }] },
  dialogue_order: ['l1', 'l2'],
  dictation: 'I have a cat.',
  speed_round: { it1: { g1: 'is' }, it2: { g1: 'are' } },
  anagram: { x1: 'planet' },
  spot_mistake: { sm1: 1 },
  highlight_words: [0],
  crossword: { e1: 'ZEBRA', e2: 'BEAR' },
}

/** The state each small machine hands the board, in the shape its player keeps it. */
const PLAYED_UI: Partial<Record<BlockType, Record<string, unknown>>> = {
  flashcards: { index: 0, flipped: true },
  memory_match: { flipped: ['m1-a'], matched: [], moves: 1 },
  quiz_game: { started: true, index: 0, startedAt: 1 },
  speed_round: { started: true, index: 1, startedAt: 1 },
  hangman: { guessed: ['A'] },
  audio: { transcript: true },
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * The API refuses any part a block does not keep, so a key the players write and this list
 * misses would turn a real gesture into an error. Every type is pinned here.
 */
describe('liveBlockParts', () => {
  it('covers every block type there is', () => {
    expect(Object.keys(EVERY_BLOCK).sort()).toEqual([...BLOCK_TYPES].sort())
  })

  it.each(BLOCK_TYPES)('takes every answer key the %s player writes', (type) => {
    const parts = liveBlockParts(EVERY_BLOCK[type], 'answers')
    const played = PLAYED_ANSWERS[type]

    if (played === undefined) {
      // Nothing to answer, so nothing may be written under answers.
      expect(parts).toBeNull()
    } else if (isRecord(played)) {
      expect([...(parts ?? ['(none)'])].sort()).toEqual(Object.keys(played).sort())
    } else {
      // Set whole: no part of it is a place on the board of its own.
      expect(parts).toEqual([])
    }
  })

  it.each(BLOCK_TYPES)('takes exactly the state the %s player keeps', (type) => {
    const parts = liveBlockParts(EVERY_BLOCK[type], 'ui')
    const played = PLAYED_UI[type]

    if (played === undefined) expect(parts).toBeNull()
    else expect([...(parts ?? ['(none)'])].sort()).toEqual(Object.keys(played).sort())
  })

  it.each(BLOCK_TYPES)('names the same %s parts on the student projection', (type) => {
    const stored = EVERY_BLOCK[type]
    const projected = toStudentBlock(stored, () => 0.5)

    expect(liveBlockParts(projected, 'answers')).toEqual(liveBlockParts(stored, 'answers'))
    expect(liveBlockParts(projected, 'ui')).toEqual(liveBlockParts(stored, 'ui'))
  })
})

type Write = [root: 'answers' | 'ui', part: string | undefined, value: unknown]

/**
 * What a link holder might write instead of a gesture, block type by block type: keys no
 * block reads, values of the wrong kind, lists longer than any player could draw.
 */
const JUNK: Partial<Record<BlockType, Write[]>> = {
  multiple_choice: [
    ['answers', undefined, 'x'.repeat(8000)],
    ['answers', undefined, ['z']],
    ['answers', undefined, ['b', 'b']],
    ['answers', undefined, { a: true }],
    ['answers', 'a', true],
  ],
  gap_fill: [
    ['answers', undefined, { 'junk-0': 'x'.repeat(1100) }],
    ['answers', undefined, { g1: 'am', 'junk-0': 'x' }],
    ['answers', undefined, 'am'],
    ['answers', undefined, ['am']],
    ['answers', 'g1', { nested: 'am' }],
    ['answers', 'g1', 1],
    ['answers', 'g9', 'am'],
  ],
  matching: [
    ['answers', 'p1', 'not a card'],
    ['answers', 'p1', 1],
    ['answers', undefined, { p1: 'кіт', junk: 'кіт' }],
  ],
  sentence_builder: [
    ['answers', undefined, ['I', 'am', 'I']],
    ['answers', undefined, ['you']],
    ['answers', undefined, 'I am'],
    ['answers', undefined, { 0: 'I' }],
  ],
  categorize: [
    ['answers', 'i1', 'c9'],
    ['answers', undefined, { i1: 'c1', i9: 'c1' }],
  ],
  true_false: [
    ['answers', 's1', 'true'],
    ['answers', undefined, { s1: true, 'junk-0': 'x'.repeat(1100) }],
  ],
  free_writing: [
    ['answers', undefined, ['An essay.']],
    ['answers', undefined, { text: 'An essay.' }],
    ['answers', 'text', 'An essay.'],
  ],
  quiz_game: [
    ['answers', 'q1', 'z'],
    ['answers', 'q9', 'a'],
    ['ui', 'index', 2],
    ['ui', 'started', 'yes'],
    ['ui', 'startedAt', -1],
    ['ui', undefined, { started: true, junk: 1 }],
  ],
  word_search: [
    ['answers', 'CAT', [{ r: 6, c: 0 }]],
    ['answers', 'CAT', [{ r: 0, c: 0, x: 1 }]],
    ['answers', 'CAT', [{ r: 0 }]],
    ['answers', 'CAT', 'CAT'],
    ['answers', 'CAT', Array.from({ length: 7 }, (_, c) => ({ r: 0, c: c % 6 }))],
    ['answers', 'BIRD', [{ r: 0, c: 0 }]],
  ],
  dialogue_order: [
    ['answers', undefined, ['l1', 'l1']],
    ['answers', undefined, ['l9']],
  ],
  dictation: [['answers', undefined, 42]],
  speed_round: [
    ['answers', 'it1', { g9: 'is' }],
    ['answers', 'it1', { g1: 1 }],
    ['answers', 'it1', 'is'],
    ['ui', 'index', 3],
  ],
  anagram: [
    ['answers', 'x1', 'planets'],
    ['answers', 'x1', 6],
  ],
  spot_mistake: [
    ['answers', 'sm1', 2],
    ['answers', 'sm1', '1'],
    ['answers', 'sm1', 0.5],
  ],
  highlight_words: [
    ['answers', undefined, [2]],
    ['answers', undefined, [0, 0]],
    ['answers', undefined, ['0']],
  ],
  crossword: [
    ['answers', 'e1', 5],
    ['answers', 'e1', ['Z']],
    ['answers', 'e9', 'ZEBRA'],
  ],
  flashcards: [
    ['ui', undefined, { 'junk-0': 'x'.repeat(1100) }],
    ['ui', 'index', 1],
    ['ui', 'index', -1],
    ['ui', 'flipped', 'yes'],
    ['answers', undefined, { index: 0 }],
  ],
  memory_match: [
    ['ui', 'flipped', ['m1-a', 'm1-b', 'm2-a']],
    ['ui', 'flipped', ['m9-a']],
    ['ui', 'flipped', ['m1-a', 'm1-a']],
    ['ui', 'matched', ['m1', 'm1']],
    ['ui', 'moves', -1],
    ['ui', 'moves', 1.5],
  ],
  hangman: [
    ['ui', 'guessed', ['a']],
    ['ui', 'guessed', ['A', 'A']],
    ['ui', 'guessed', 'A'],
  ],
  audio: [
    ['ui', 'transcript', 1],
    ['ui', undefined, { transcript: true, open: true }],
  ],
}

/**
 * The API refuses a value no player writes, so a value a player does write and this check
 * misses would turn a real gesture into an error — and one it lets through is room on the
 * board for whoever holds the link. Both are pinned, for every block type.
 */
describe('liveBlockValueFits', () => {
  const fits = (type: BlockType, [root, part, value]: Write) =>
    liveBlockValueFits(EVERY_BLOCK[type], root, part, value)

  it.each(BLOCK_TYPES)('takes the %s answer its player writes, whole and part by part', (type) => {
    const played = PLAYED_ANSWERS[type]

    if (played === undefined) {
      // Nothing to answer, so nothing at all may be set under answers.
      expect(fits(type, ['answers', undefined, {}])).toBe(false)
      return
    }
    expect(fits(type, ['answers', undefined, played])).toBe(true)
    if (isRecord(played)) {
      for (const [part, value] of Object.entries(played)) {
        expect(fits(type, ['answers', part, value])).toBe(true)
      }
      // A reset empties the block at once.
      expect(fits(type, ['answers', undefined, {}])).toBe(true)
    }
  })

  it.each(BLOCK_TYPES)('takes the %s state its player keeps, whole and key by key', (type) => {
    const played = PLAYED_UI[type]

    if (played === undefined) {
      expect(fits(type, ['ui', undefined, {}])).toBe(false)
      return
    }
    expect(fits(type, ['ui', undefined, played])).toBe(true)
    for (const [part, value] of Object.entries(played)) {
      expect(fits(type, ['ui', part, value])).toBe(true)
    }
  })

  it.each(Object.entries(JUNK))('refuses what no %s player writes', (type, writes) => {
    for (const write of writes ?? []) {
      expect(fits(type as BlockType, write), JSON.stringify(write).slice(0, 80)).toBe(false)
    }
  })

  it('covers every block that keeps something with junk to refuse', () => {
    const keeping = BLOCK_TYPES.filter(
      (type) => PLAYED_ANSWERS[type] !== undefined || PLAYED_UI[type] !== undefined,
    )

    expect(Object.keys(JUNK).sort()).toEqual([...keeping].sort())
  })

  it('takes the most a player can lay down, and nothing past it', () => {
    // Every option ticked, every token and line placed, every word tapped.
    expect(fits('multiple_choice', ['answers', undefined, ['b', 'a']])).toBe(true)
    expect(fits('sentence_builder', ['answers', undefined, ['am', 'I']])).toBe(true)
    expect(fits('dialogue_order', ['answers', undefined, ['l2', 'l1']])).toBe(true)
    expect(fits('highlight_words', ['answers', undefined, [0, 1]])).toBe(true)
    // A row swept edge to edge; a word of tiles all used.
    const row = Array.from({ length: 6 }, (_, c) => ({ r: 0, c }))
    expect(fits('word_search', ['answers', 'CAT', row])).toBe(true)
    expect(fits('anagram', ['answers', 'x1', 'tenalp'])).toBe(true)
    // Two cards up, every pair found, the whole alphabet tried, a game run to its end.
    expect(fits('memory_match', ['ui', 'flipped', ['m1-a', 'm2-b']])).toBe(true)
    expect(fits('memory_match', ['ui', 'matched', ['m2', 'm1']])).toBe(true)
    expect(fits('hangman', ['ui', 'guessed', [...'ZYXWVUTSRQPONMLKJIHGFEDCBA']])).toBe(true)
    expect(fits('quiz_game', ['ui', 'index', 1])).toBe(true)
    expect(fits('speed_round', ['ui', 'index', 2])).toBe(true)
    // And an empty list, which is what unticking, or taking every token back, leaves.
    expect(fits('multiple_choice', ['answers', undefined, []])).toBe(true)
    expect(fits('sentence_builder', ['answers', undefined, []])).toBe(true)
  })

  it('lets a word a sentence holds twice be laid down twice, and no more', () => {
    const sentence = block({
      id: 'sb2',
      type: 'sentence_builder',
      correct: ['the', 'cat', 'saw', 'the', 'dog'],
      distractors: ['a'],
    })

    expect(
      liveBlockValueFits(sentence, 'answers', undefined, ['a', 'the', 'dog', 'saw', 'the', 'cat']),
    ).toBe(true)
    expect(liveBlockValueFits(sentence, 'answers', undefined, ['the', 'the', 'the'])).toBe(false)
  })

  it('takes what a player builds from the student projection', () => {
    const matching = toStudentBlock(EVERY_BLOCK.matching)
    const builder = toStudentBlock(EVERY_BLOCK.sentence_builder)
    const anagram = toStudentBlock(EVERY_BLOCK.anagram)
    const tiles = anagram.type === 'anagram' ? anagram.items[0] : undefined
    if (!('rights' in matching) || !('tokens' in builder) || !tiles || !('letters' in tiles)) {
      throw new Error('The projection changed shape')
    }

    // The cards are dealt as texts, the tokens and the tiles shuffled.
    for (const right of matching.rights) {
      expect(fits('matching', ['answers', 'p2', right])).toBe(true)
    }
    expect(fits('sentence_builder', ['answers', undefined, builder.tokens])).toBe(true)
    expect(fits('anagram', ['answers', 'x1', tiles.letters.join('')])).toBe(true)
  })

  it.each(BLOCK_TYPES)('measures %s values the same on the student projection', (type) => {
    const stored = EVERY_BLOCK[type]
    const projected = toStudentBlock(stored, () => 0.5)
    const writes: Write[] = [
      ['answers', undefined, PLAYED_ANSWERS[type]],
      ['ui', undefined, PLAYED_UI[type]],
      ...(JUNK[type] ?? []),
    ]

    for (const [root, part, value] of writes) {
      expect(liveBlockValueFits(projected, root, part, value)).toBe(
        liveBlockValueFits(stored, root, part, value),
      )
    }
  })

  it('takes nothing for a block that keeps nothing', () => {
    for (const type of ['text', 'reading', 'image', 'video'] as const) {
      expect(fits(type, ['answers', undefined, 'x'])).toBe(false)
      expect(fits(type, ['ui', undefined, { open: true }])).toBe(false)
    }
  })
})

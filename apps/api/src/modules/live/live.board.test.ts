import { describe, expect, it, vi } from 'vitest'
import type { BoardOp } from '@tp/shared'
import { ConflictError, ValidationError } from '../../http/errors'
import type { MaterialsRepository, MaterialStepRow } from '../materials/materials.repository'
import type { LiveInvitationsRepository } from './live-invitations.repository'
import type { LiveRepository, LiveSessionRow } from './live.repository'
import { createLiveService } from './live.service'

// The public board is open only while the host may still teach; that check is not the
// subject here.
vi.mock('../subscriptions/teaching-access', () => ({ assertHostAccess: vi.fn(async () => {}) }))

const L = (row: string) => row.split('')

/** One step with every block type a live board can hold, as an author saves them. */
const BLOCKS = [
  { id: 'text', type: 'text', text: 'Read this first.' },
  { id: 'reading', type: 'reading', passage: 'Once upon a time.' },
  {
    id: 'listen',
    type: 'audio',
    assetId: '33333333-3333-4333-8333-333333333333',
    transcript: 'Hello there.',
  },
  {
    id: 'choice',
    type: 'multiple_choice',
    prompt: 'Pick',
    options: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ],
    correctIds: ['b'],
  },
  {
    id: 'gaps',
    type: 'gap_fill',
    segments: [
      { kind: 'text', text: 'I ' },
      { kind: 'gap', id: 'g1', answers: ['am'] },
      { kind: 'gap', id: 'g2', answers: ['fine'] },
    ],
  },
  {
    id: 'pairs',
    type: 'matching',
    pairs: [
      { id: 'p1', left: 'cat', right: 'кіт' },
      { id: 'p2', left: 'dog', right: 'пес' },
    ],
  },
  { id: 'order', type: 'sentence_builder', correct: ['I', 'am'] },
  {
    id: 'sort',
    type: 'categorize',
    categories: [
      { id: 'c1', label: 'One' },
      { id: 'c2', label: 'Two' },
    ],
    items: [
      { id: 'i1', text: 'apple', categoryId: 'c1' },
      { id: 'i2', text: 'water', categoryId: 'c2' },
    ],
  },
  {
    id: 'truth',
    type: 'true_false',
    statements: [{ id: 's1', text: 'Yes', isTrue: true }],
  },
  { id: 'cards', type: 'flashcards', cards: [{ id: 'f1', front: 'a', back: 'b' }] },
  { id: 'essay', type: 'free_writing', prompt: 'Write' },
  {
    id: 'quiz',
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
  },
  {
    id: 'memory',
    type: 'memory_match',
    pairs: [
      { id: 'm1', a: 'dog', b: 'пес' },
      { id: 'm2', a: 'sun', b: 'сонце' },
    ],
  },
  {
    id: 'search',
    type: 'word_search',
    words: ['CAT'],
    size: 6,
    grid: ['CATXQZ', 'DOGWVY', 'PLMNBR', 'KJHGFD', 'SAEUIO', 'TRWQLK'].map(L),
    placements: [
      {
        word: 'CAT',
        cells: [
          { r: 0, c: 0 },
          { r: 0, c: 1 },
          { r: 0, c: 2 },
        ],
      },
    ],
  },
  {
    id: 'dialogue',
    type: 'dialogue_order',
    lines: [
      { id: 'l1', speaker: 'Ann', text: 'Hello!' },
      { id: 'l2', speaker: 'Bob', text: 'Hi!' },
    ],
  },
  { id: 'dictate', type: 'dictation', text: 'I have a cat.' },
  {
    id: 'speed',
    type: 'speed_round',
    items: [{ id: 'it1', segments: [{ kind: 'gap', id: 'g1', answers: ['is'] }] }],
  },
  { id: 'hang', type: 'hangman', word: 'APPLE' },
  { id: 'letters', type: 'anagram', items: [{ id: 'x1', word: 'planet' }] },
  {
    id: 'mistake',
    type: 'spot_mistake',
    items: [{ id: 'sm1', words: ['She', 'go'], wrongIndex: 1, correction: 'goes' }],
  },
  { id: 'highlight', type: 'highlight_words', prompt: 'Find', words: ['big', 'dog'], targets: [0] },
  {
    id: 'grid',
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
  },
]

const room = {
  id: 'room',
  teacher_id: 'teacher',
  material_id: 'material',
  status: 'active',
  board: {},
  board_version: 4,
  current_step_id: null,
} as unknown as LiveSessionRow

function setup(
  board: LiveSessionRow['board'] = {},
  announce = vi.fn().mockResolvedValue(undefined),
) {
  const live = {
    findById: vi.fn().mockResolvedValue({ ...room, board }),
    applyOps: vi.fn().mockResolvedValue({
      version: 5,
      board: {},
      current_step_id: null,
      status: 'active',
    }),
  } as unknown as LiveRepository
  const materials = {
    stepsFor: vi
      .fn()
      .mockResolvedValue([{ id: 'step', blocks: BLOCKS } as unknown as MaterialStepRow]),
  } as unknown as MaterialsRepository
  const service = createLiveService({
    live,
    materials,
    invitations: {} as LiveInvitationsRepository,
    announce,
  })
  const write = (...ops: BoardOp[]) => service.applyOps(room.id, { ops })
  return { live, write }
}

const set = (path: string[], value: unknown = 'x'): BoardOp => ({ t: 'set', path, value })

describe('the public live board', () => {
  it.each([
    // Every piece a player writes one key at a time, by block type, as the player writes it.
    ['gap fill', ['answers', 'step', 'gaps', 'g2'], 'fine'],
    ['matching', ['answers', 'step', 'pairs', 'p1'], 'кіт'],
    ['categorize', ['answers', 'step', 'sort', 'i2'], 'c2'],
    ['true or false', ['answers', 'step', 'truth', 's1'], true],
    ['quiz answer', ['answers', 'step', 'quiz', 'q1'], 'b'],
    [
      'word search',
      ['answers', 'step', 'search', 'CAT'],
      [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
        { r: 0, c: 2 },
      ],
    ],
    ['speed round', ['answers', 'step', 'speed', 'it1'], { g1: 'is' }],
    ['anagram', ['answers', 'step', 'letters', 'x1'], 'plan'],
    ['spot the mistake', ['answers', 'step', 'mistake', 'sm1'], 1],
    ['crossword', ['answers', 'step', 'grid', 'e2'], 'BEA'],
    ['flashcard state', ['ui', 'step', 'cards', 'flipped'], true],
    ['memory state', ['ui', 'step', 'memory', 'matched'], ['m2']],
    ['quiz clock', ['ui', 'step', 'quiz', 'startedAt'], 1_790_000_000_000],
    ['speed round clock', ['ui', 'step', 'speed', 'index'], 1],
    ['hangman letters', ['ui', 'step', 'hang', 'guessed'], ['E', 'A']],
    ['transcript toggle', ['ui', 'step', 'listen', 'transcript'], true],
  ])('takes a %s part', async (_label, path, value) => {
    const { live, write } = setup()

    await write(set(path, value))

    expect(live.applyOps).toHaveBeenCalledWith(room.id, [set(path, value)], undefined)
  })

  it.each([
    ['choice', ['b']],
    ['order', ['I', 'am']],
    ['dialogue', ['l2', 'l1']],
    ['highlight', [0]],
    ['essay', 'An essay.'],
    ['dictate', 'I have a cat.'],
  ])('takes a %s answer set whole', async (blockId, value) => {
    const { live, write } = setup()

    await write(set(['answers', 'step', blockId], value))

    expect(live.applyOps).toHaveBeenCalledOnce()
  })

  it.each([
    // A block kept in parts, set whole: a reset, or every part at once.
    ['gaps', 'answers', {}],
    ['gaps', 'answers', { g1: 'am', g2: 'fine' }],
    ['truth', 'answers', { s1: false }],
    ['cards', 'ui', { index: 0, flipped: true }],
    ['memory', 'ui', { flipped: ['m1-a', 'm2-b'], matched: [], moves: 3 }],
  ])('takes %s set whole under %s as its player sets it', async (blockId, root, value) => {
    const { live, write } = setup()

    await write(set([root, 'step', blockId], value))

    expect(live.applyOps).toHaveBeenCalledOnce()
  })

  it.each([
    // The values a link holder sent under real blocks, which no player writes.
    ['a gap fill carrying keys it has no gaps for', 'answers', 'gaps', { 'junk-0': 'x' }],
    ['true or false carrying junk beside an answer', 'answers', 'truth', { s1: true, junk: 'x' }],
    ['a choice as a page of text', 'answers', 'choice', 'x'.repeat(8000)],
    ['an option no question has', 'answers', 'choice', ['z']],
    ['a sentence with a word used twice', 'answers', 'order', ['I', 'I']],
    ['an essay as a list', 'answers', 'essay', ['An essay.']],
    ['a word index past the passage', 'answers', 'highlight', [7]],
    ['flashcard state carrying junk', 'ui', 'cards', { 'junk-0': 'x' }],
    ['three cards face up', 'ui', 'memory', { flipped: ['m1-a', 'm1-b', 'm2-a'] }],
  ])('refuses %s', async (_label, root, blockId, value) => {
    const { live, write } = setup()

    await expect(write(set([root, 'step', blockId], value))).rejects.toThrow(ValidationError)
    expect(live.applyOps).not.toHaveBeenCalled()
  })

  it('refuses a part holding what its player never puts there', async () => {
    const { live, write } = setup()

    for (const [path, value] of [
      [['answers', 'step', 'gaps', 'g1'], { nested: 'am' }],
      [['answers', 'step', 'pairs', 'p1'], 'a card nobody dealt'],
      [['answers', 'step', 'sort', 'i1'], 'c9'],
      [['answers', 'step', 'quiz', 'q1'], 'z'],
      [['answers', 'step', 'search', 'CAT'], [{ r: 9, c: 0 }]],
      [['answers', 'step', 'speed', 'it1'], { g9: 'is' }],
      [['answers', 'step', 'letters', 'x1'], 'planetarium'],
      [['answers', 'step', 'mistake', 'sm1'], 2],
      [['ui', 'step', 'cards', 'index'], 4],
      [
        ['ui', 'step', 'hang', 'guessed'],
        ['A', 'A'],
      ],
    ] as const) {
      await expect(write(set([...path], value))).rejects.toThrow(ValidationError)
    }
    // One stray value refuses the whole gesture, the good ops in it too.
    await expect(
      write(
        set(['answers', 'step', 'gaps', 'g1'], 'am'),
        set(['answers', 'step', 'quiz', 'q1'], 'z'),
      ),
    ).rejects.toThrow(ValidationError)
    expect(live.applyOps).not.toHaveBeenCalled()
  })

  it('refuses a part the block does not keep', async () => {
    const { live, write } = setup()

    await expect(
      write(set(['answers', 'step', 'gaps', 'junk-0'], 'x'.repeat(8000))),
    ).rejects.toThrow(ValidationError)
    await expect(write(set(['ui', 'step', 'cards', 'junk']))).rejects.toThrow(ValidationError)
    // A list is set whole; none of it is a place of its own.
    await expect(write(set(['answers', 'step', 'choice', 'a']))).rejects.toThrow(ValidationError)
    expect(live.applyOps).not.toHaveBeenCalled()
  })

  it('refuses anything under a block that keeps nothing there', async () => {
    const { live, write } = setup()

    for (const path of [
      ['answers', 'step', 'text'],
      ['answers', 'step', 'text', 'junk'],
      ['ui', 'step', 'reading'],
      ['answers', 'step', 'cards'],
      ['ui', 'step', 'gaps', 'g1'],
    ]) {
      await expect(write(set(path))).rejects.toThrow(ValidationError)
      await expect(write({ t: 'unset', path })).rejects.toThrow(ValidationError)
    }
    expect(live.applyOps).not.toHaveBeenCalled()
  })

  it('refuses a whole batch for one stray op, and anything deeper than a part', async () => {
    const { live, write } = setup()

    await expect(
      write(set(['answers', 'step', 'gaps', 'g1']), set(['answers', 'step', 'gaps', 'g9'])),
    ).rejects.toThrow(ValidationError)
    await expect(write(set(['answers', 'step', 'speed', 'it1', 'g1']))).rejects.toThrow(
      ValidationError,
    )
    await expect(write(set(['answers', 'other-step', 'gaps', 'g1']))).rejects.toThrow(
      ValidationError,
    )
    expect(live.applyOps).not.toHaveBeenCalled()
  })

  it('lets a player clear a key an earlier writer left behind', async () => {
    const { live, write } = setup()
    const reset: BoardOp[] = [
      { t: 'unset', path: ['answers', 'step', 'pairs', 'p1'] },
      { t: 'unset', path: ['answers', 'step', 'pairs', 'left-behind'] },
    ]

    await write(...reset)

    expect(live.applyOps).toHaveBeenCalledWith(room.id, reset, undefined)
  })

  it('answers a gesture only once the room has been told', async () => {
    // A serverless function may be frozen as soon as it answers.
    let told = false
    const announce = vi.fn(
      () =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            told = true
            resolve()
          }, 20),
        ),
    )
    const { write } = setup({}, announce)

    await write(set(['answers', 'step', 'gaps', 'g1']))

    expect(told).toBe(true)
  })

  it('keeps a marked step closed to answers', async () => {
    const { live, write } = setup({
      results: { step: { autoScore: 0, autoMax: 1, manualMax: 0, byBlock: {} } },
    })

    await expect(write(set(['answers', 'step', 'gaps', 'g1']))).rejects.toThrow(ConflictError)
    expect(live.applyOps).not.toHaveBeenCalled()
  })
})

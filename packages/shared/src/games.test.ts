import { describe, expect, it } from 'vitest'
import { blockSchema, toStudentBlock, type Block } from './contracts/blocks'
import { answerableUnits, dictationWords, gradeBlock } from './grading'

/** Built through the schema so the fixtures carry the same defaults production data does. */
const block = (input: unknown): Block => blockSchema.parse(input)

const memory = block({
  id: 'mm',
  type: 'memory_match',
  pairs: [
    { id: 'p1', a: 'cat', b: 'кіт' },
    { id: 'p2', a: 'dog', b: 'пес' },
  ],
})

// A 6x6 grid with CAT across row 0 and DOG down column 5.
const grid = [
  ['C', 'A', 'T', 'Q', 'W', 'D'],
  ['X', 'Y', 'Z', 'Q', 'W', 'O'],
  ['X', 'Y', 'Z', 'Q', 'W', 'G'],
  ['X', 'Y', 'Z', 'Q', 'W', 'E'],
  ['X', 'Y', 'Z', 'Q', 'W', 'E'],
  ['X', 'Y', 'Z', 'Q', 'W', 'E'],
]
const wordSearch = block({
  id: 'ws',
  type: 'word_search',
  words: ['CAT', 'DOG'],
  size: 6,
  grid,
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
        { r: 0, c: 5 },
        { r: 1, c: 5 },
        { r: 2, c: 5 },
      ],
    },
  ],
})

const dialogue = block({
  id: 'dl',
  type: 'dialogue_order',
  lines: [
    { id: 'x9k', speaker: 'Waiter', text: 'Are you ready to order?' },
    { id: 'q2m', speaker: 'Anna', text: 'Yes, the soup, please.' },
    { id: 'z7c', speaker: 'Waiter', text: 'Anything to drink?' },
  ],
})

const dictation = block({
  id: 'dc',
  type: 'dictation',
  text: "I don't think she has ever been to London.",
})

const speed = block({
  id: 'sr',
  type: 'speed_round',
  items: [
    {
      id: 'i1',
      segments: [
        { kind: 'text', text: 'She ' },
        { kind: 'gap', id: 'g1', answers: ['goes'] },
        { kind: 'text', text: ' to work.' },
      ],
    },
    {
      id: 'i2',
      segments: [
        { kind: 'text', text: 'They ' },
        { kind: 'gap', id: 'g1', answers: ['have', "'ve"] },
        { kind: 'text', text: ' left.' },
      ],
    },
  ],
})

describe('memory match', () => {
  it('is practice: no marks, and the pairs go to the student whole', () => {
    expect(answerableUnits(memory)).toEqual([])
    expect(gradeBlock(memory, undefined).max).toBe(0)
    expect(toStudentBlock(memory, () => 0)).toEqual(memory)
  })
})

describe('word search', () => {
  it('marks a word found when the marked cells are exactly where it sits', () => {
    const grade = gradeBlock(wordSearch, {
      CAT: [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
        { r: 0, c: 2 },
      ],
    })

    expect(grade.parts).toEqual({ CAT: true, DOG: false })
    expect(grade.score).toBe(1)
    expect(grade.max).toBe(2)
  })

  it('accepts the same cells swept backwards', () => {
    const grade = gradeBlock(wordSearch, {
      DOG: [
        { r: 2, c: 5 },
        { r: 1, c: 5 },
        { r: 0, c: 5 },
      ],
    })

    expect(grade.parts.DOG).toBe(true)
  })

  it('does not accept a line that overshoots or falls short', () => {
    expect(
      gradeBlock(wordSearch, {
        CAT: [
          { r: 0, c: 0 },
          { r: 0, c: 1 },
        ],
      }).parts.CAT,
    ).toBe(false)
    expect(
      gradeBlock(wordSearch, {
        CAT: [
          { r: 0, c: 0 },
          { r: 0, c: 1 },
          { r: 0, c: 2 },
          { r: 0, c: 3 },
        ],
      }).parts.CAT,
    ).toBe(false)
  })

  it('sends the puzzle but not where the words are', () => {
    const student = toStudentBlock(wordSearch, () => 0)

    expect(student).toMatchObject({ words: ['CAT', 'DOG'], size: 6 })
    expect('placements' in student).toBe(false)
  })

  it('refuses a grid that is not size by size', () => {
    expect(blockSchema.safeParse({ ...wordSearch, size: 8 }).success).toBe(false)
  })
})

describe('dialogue order', () => {
  it('marks each line by whether it landed in its place', () => {
    expect(gradeBlock(dialogue, ['x9k', 'q2m', 'z7c']).score).toBe(3)

    const swapped = gradeBlock(dialogue, ['q2m', 'x9k', 'z7c'])
    expect(swapped.parts).toEqual({ x9k: false, q2m: false, z7c: true })
    expect(swapped.score).toBe(1)
  })

  it('hands the student the lines in a different order', () => {
    // Fisher-Yates with a constant zero swaps every position with the first, which is a
    // deterministic shuffle that always moves things. (A constant near one would not: it
    // picks j = i every time and leaves the order alone.)
    const student = toStudentBlock(dialogue, () => 0) as { lines: { id: string }[] }

    expect(student.lines.map((l) => l.id).sort()).toEqual(['q2m', 'x9k', 'z7c'])
    expect(student.lines.map((l) => l.id)).not.toEqual(['x9k', 'q2m', 'z7c'])
  })
})

describe('dictation', () => {
  it('splits words the way a student types them', () => {
    expect(dictationWords("I don't think — she's here.")).toEqual([
      'i',
      "don't",
      'think',
      "she's",
      'here',
    ])
  })

  it('gives full marks for the sentence, whatever the case and punctuation', () => {
    expect(gradeBlock(dictation, "I don't think she has ever been to London.").score).toBe(9)
    expect(gradeBlock(dictation, 'i DON’T think she has ever been to london').score).toBe(9)
  })

  it('but an apostrophe is spelling, and "dont" is a different word', () => {
    expect(gradeBlock(dictation, 'i dont think she has ever been to london').score).toBe(8)
  })

  it('charges a dropped word once, not every word after it', () => {
    const grade = gradeBlock(dictation, "I don't think she ever been to London")

    // Nine expected words, "has" missing: eight right.
    expect(grade.score).toBe(8)
    expect(grade.parts.w4).toBe(false)
  })

  it('marks nothing for nothing', () => {
    expect(gradeBlock(dictation, '').score).toBe(0)
    expect(gradeBlock(dictation, undefined).score).toBe(0)
  })
})

describe('speed round', () => {
  it('marks every gap across every item', () => {
    expect(answerableUnits(speed)).toEqual(['i1:g1', 'i2:g1'])

    const grade = gradeBlock(speed, { i1: { g1: 'goes' }, i2: { g1: '’ve' } })
    expect(grade.parts).toEqual({ 'i1:g1': true, 'i2:g1': true })
    expect(grade.score).toBe(2)
  })

  it('a missed item is simply wrong', () => {
    expect(gradeBlock(speed, { i1: { g1: 'goes' } }).score).toBe(1)
  })

  it('sends the sentences with their holes and none of their answers', () => {
    const wire = JSON.stringify(toStudentBlock(speed, () => 0))

    expect(wire).not.toContain('answers')
    expect(wire).not.toContain('goes')
    expect(wire).toContain('to work.')
  })
})

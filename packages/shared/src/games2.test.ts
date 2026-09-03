import { describe, expect, it } from 'vitest'
import { blockSchema, toStudentBlock, type Block } from './contracts/blocks'
import { estimateMinutes } from './duration'
import { answerableUnits, gradeBlock } from './grading'

const block = (input: unknown): Block => blockSchema.parse(input)

const hangman = block({ id: 'hm', type: 'hangman', word: 'WAITER', hint: 'He brings the menu.' })

const anagram = block({
  id: 'an',
  type: 'anagram',
  items: [
    { id: 'a1', word: 'menu' },
    { id: 'a2', word: "don't" },
  ],
})

const spot = block({
  id: 'sp',
  type: 'spot_mistake',
  items: [
    { id: 's1', words: ['She', 'go', 'to', 'work.'], wrongIndex: 1, correction: 'goes' },
    { id: 's2', words: ['I', 'have', 'saw', 'it.'], wrongIndex: 2, correction: 'seen' },
  ],
})

const highlight = block({
  id: 'hl',
  type: 'highlight_words',
  prompt: 'Find the adjectives.',
  words: ['The', 'small', 'café', 'was', 'quiet', 'and', 'warm.'],
  targets: [1, 4, 6],
})

const crossword = block({
  id: 'cw',
  type: 'crossword',
  entries: [
    { id: 'e1', answer: 'MENU', clue: 'What you order from' },
    { id: 'e2', answer: 'NAPKIN', clue: 'Paper for your lap' },
  ],
  size: 8,
  placements: [
    { id: 'e1', r: 0, c: 0, dir: 'across' },
    { id: 'e2', r: 0, c: 2, dir: 'down' },
  ],
})

describe('hangman', () => {
  it('is practice: the word is on the client and there are no marks', () => {
    expect(answerableUnits(hangman)).toEqual([])
    expect(toStudentBlock(hangman, () => 0)).toEqual(hangman)
  })
})

describe('anagram', () => {
  it('sends the letters shuffled and never the word', () => {
    const student = toStudentBlock(anagram, () => 0) as { items: { letters: string[] }[] }

    expect(student.items[0]?.letters.slice().sort()).toEqual([...'menu'].sort())
    expect(JSON.stringify(student)).not.toContain('"word"')
  })

  it('marks each word, forgiving case and the smart apostrophe', () => {
    expect(gradeBlock(anagram, { a1: 'Menu', a2: 'don’t' }).score).toBe(2)
    expect(gradeBlock(anagram, { a1: 'mune' }).score).toBe(0)
  })
})

describe('spot the mistake', () => {
  it('marks each sentence by the tapped index', () => {
    expect(gradeBlock(spot, { s1: 1, s2: 2 }).score).toBe(2)
    expect(gradeBlock(spot, { s1: 0, s2: 2 }).parts).toEqual({ s1: false, s2: true })
  })

  it('sends the sentences without saying where the mistake is', () => {
    const wire = JSON.stringify(toStudentBlock(spot, () => 0))

    expect(wire).not.toContain('wrongIndex')
    expect(wire).not.toContain('correction')
    expect(wire).toContain('work.')
  })
})

describe('highlight words', () => {
  it('scores every target found plus one for restraint', () => {
    const grade = gradeBlock(highlight, [1, 4, 6])

    expect(grade.max).toBe(4)
    expect(grade.score).toBe(4)
  })

  it('tapping everything does not pay', () => {
    const grade = gradeBlock(highlight, [0, 1, 2, 3, 4, 5, 6])

    expect(grade.parts.precision).toBe(false)
    expect(grade.score).toBe(3)
  })

  it('a partial, careful answer keeps its restraint mark', () => {
    const grade = gradeBlock(highlight, [1, 4])

    expect(grade.parts).toEqual({ w1: true, w4: true, w6: false, precision: true })
  })

  it('sends the passage but not the targets', () => {
    expect('targets' in toStudentBlock(highlight, () => 0)).toBe(false)
  })
})

describe('crossword', () => {
  it('sends the shape and the clues, never the letters', () => {
    const student = toStudentBlock(crossword, () => 0) as {
      entries: { id: string; clue: string; length: number }[]
      placements: unknown[]
    }

    expect(student.entries).toEqual([
      { id: 'e1', clue: 'What you order from', length: 4 },
      { id: 'e2', clue: 'Paper for your lap', length: 6 },
    ])
    expect(student.placements).toHaveLength(2)
    expect(JSON.stringify(student)).not.toContain('NAPKIN')
  })

  it('marks each entry, whatever the case typed', () => {
    expect(gradeBlock(crossword, { e1: 'menu', e2: 'Napkin' }).score).toBe(2)
    expect(gradeBlock(crossword, { e1: 'menu' }).score).toBe(1)
  })

  it('refuses a placement that runs off the grid', () => {
    expect(
      blockSchema.safeParse({
        ...crossword,
        placements: [
          { id: 'e1', r: 0, c: 6, dir: 'across' },
          { id: 'e2', r: 0, c: 2, dir: 'down' },
        ],
      }).success,
    ).toBe(false)
  })
})

describe('duration', () => {
  it('counts reading at a learner pace and exercises per decision', () => {
    const steps = [
      {
        blocks: [
          block({ id: 'r', type: 'reading', passage: Array(240).fill('word').join(' ') }),
          block({
            id: 'm',
            type: 'multiple_choice',
            prompt: 'Q',
            options: [
              { id: 'a', text: 'a' },
              { id: 'b', text: 'b' },
            ],
            correctIds: ['a'],
          }),
        ],
      },
    ]

    // 0.5 for the step, 2 for 240 words at 120 a minute, 0.5 for the question.
    expect(estimateMinutes(steps)).toBe(3)
  })

  it('ignores drafts that are not yet lessons, and never says zero', () => {
    expect(estimateMinutes([{ blocks: [{ id: 'x', type: 'heading' }] }])).toBe(1)
    expect(estimateMinutes([])).toBe(1)
  })
})

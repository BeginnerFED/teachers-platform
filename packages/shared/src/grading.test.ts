import { describe, expect, it } from 'vitest'
import { blockSchema, toStudentBlock, type Block } from './contracts/blocks'
import { answerableUnits, gradeBlock, gradeBlocks } from './grading'

/** Built through the schema so the fixtures carry the same defaults production data does. */
const block = (input: unknown): Block => blockSchema.parse(input)

const multipleChoice = block({
  id: 'mc',
  type: 'multiple_choice',
  prompt: 'She ___ to school every day.',
  options: [
    { id: 'a', text: 'go' },
    { id: 'b', text: 'goes' },
    { id: 'c', text: 'going' },
  ],
  correctIds: ['b'],
  explanation: 'Third person singular takes -s.',
})

const gapFill = block({
  id: 'gf',
  type: 'gap_fill',
  segments: [
    { kind: 'text', text: 'I ' },
    { kind: 'gap', id: 'g1', answers: ["don't", 'do not'] },
    { kind: 'text', text: ' know. She ' },
    { kind: 'gap', id: 'g2', answers: ['has'] },
    { kind: 'text', text: ' arrived.' },
  ],
})

const matching = block({
  id: 'ma',
  type: 'matching',
  pairs: [
    { id: 'p1', left: 'cat', right: 'кіт' },
    { id: 'p2', left: 'dog', right: 'пес' },
    { id: 'p3', left: 'bird', right: 'птах' },
  ],
})

const sentenceBuilder = block({
  id: 'sb',
  type: 'sentence_builder',
  correct: ['I', 'have', 'never', 'been', 'there'],
  distractors: ['was'],
})

const categorize = block({
  id: 'ca',
  type: 'categorize',
  categories: [
    { id: 'c1', label: 'Countable' },
    { id: 'c2', label: 'Uncountable' },
  ],
  items: [
    { id: 'i1', text: 'apple', categoryId: 'c1' },
    { id: 'i2', text: 'water', categoryId: 'c2' },
    { id: 'i3', text: 'advice', categoryId: 'c2' },
    { id: 'i4', text: 'chair', categoryId: 'c1' },
  ],
})

const trueFalse = block({
  id: 'tf',
  type: 'true_false',
  statements: [
    { id: 's1', text: 'London is in England.', isTrue: true },
    { id: 's2', text: 'Cats can fly.', isTrue: false },
  ],
})

const quizGame = block({
  id: 'qg',
  type: 'quiz_game',
  questions: [
    {
      id: 'q1',
      prompt: 'Past of "go"?',
      options: [
        { id: 'x', text: 'goed' },
        { id: 'y', text: 'went' },
      ],
      correctId: 'y',
    },
    {
      id: 'q2',
      prompt: 'Past of "eat"?',
      options: [
        { id: 'x', text: 'ate' },
        { id: 'y', text: 'eated' },
      ],
      correctId: 'x',
    },
  ],
})

const freeWriting = block({ id: 'fw', type: 'free_writing', prompt: 'Describe your weekend.' })
const flashcards = block({
  id: 'fc',
  type: 'flashcards',
  cards: [{ id: 'c1', front: 'ubiquitous', back: 'everywhere at once' }],
})
const heading = block({ id: 'h', type: 'heading', text: 'Present Perfect' })

describe('answerableUnits', () => {
  it('counts what can be right or wrong, not what is on the page', () => {
    expect(answerableUnits(multipleChoice)).toEqual(['mc'])
    expect(answerableUnits(gapFill)).toEqual(['g1', 'g2'])
    expect(answerableUnits(matching)).toHaveLength(3)
    expect(answerableUnits(categorize)).toHaveLength(4)
    expect(answerableUnits(quizGame)).toEqual(['q1', 'q2'])
  })

  it('gives presentation blocks and practice blocks nothing to be wrong about', () => {
    expect(answerableUnits(heading)).toEqual([])
    expect(answerableUnits(flashcards)).toEqual([])
  })
})

describe('gradeBlock', () => {
  it('marks a single-answer question whole', () => {
    expect(gradeBlock(multipleChoice, ['b'])).toMatchObject({ score: 1, max: 1 })
    expect(gradeBlock(multipleChoice, ['a'])).toMatchObject({ score: 0, max: 1 })
  })

  it('wants the exact set on select-all-that-apply', () => {
    const multi = block({
      id: 'mcm',
      type: 'multiple_choice',
      prompt: 'Which are verbs?',
      multiple: true,
      options: [
        { id: 'a', text: 'run' },
        { id: 'b', text: 'blue' },
        { id: 'c', text: 'swim' },
      ],
      correctIds: ['a', 'c'],
    })

    expect(gradeBlock(multi, ['a', 'c']).score).toBe(1)
    expect(gradeBlock(multi, ['c', 'a']).score).toBe(1)
    // Half right is not half a mark here: partial credit would pay for ticking everything.
    expect(gradeBlock(multi, ['a']).score).toBe(0)
    expect(gradeBlock(multi, ['a', 'b', 'c']).score).toBe(0)
  })

  it('gives partial credit per gap', () => {
    const grade = gradeBlock(gapFill, { g1: "don't", g2: 'have' })

    expect(grade).toMatchObject({ score: 1, max: 2 })
    expect(grade.parts).toEqual({ g1: true, g2: false })
  })

  it('accepts any spelling the author listed', () => {
    expect(gradeBlock(gapFill, { g1: 'do not', g2: 'has' }).score).toBe(2)
  })

  it('forgives the phone keyboard: smart apostrophes, case and stray spaces', () => {
    expect(gradeBlock(gapFill, { g1: 'Don’t', g2: '  has  ' }).score).toBe(2)
    expect(gradeBlock(gapFill, { g1: 'do  not', g2: 'HAS' }).score).toBe(2)
  })

  it('does not forgive case when the author asked it not to', () => {
    const strict = block({
      id: 'gfs',
      type: 'gap_fill',
      caseSensitive: true,
      segments: [{ kind: 'gap', id: 'g', answers: ['London'] }],
    })

    expect(gradeBlock(strict, { g: 'London' }).score).toBe(1)
    expect(gradeBlock(strict, { g: 'london' }).score).toBe(0)
  })

  it('treats an empty gap as wrong rather than as matching an empty answer', () => {
    expect(gradeBlock(gapFill, { g1: '', g2: '   ' }).score).toBe(0)
  })

  it('marks matching against the right-hand text', () => {
    expect(gradeBlock(matching, { p1: 'кіт', p2: 'пес', p3: 'птах' }).score).toBe(3)
    expect(gradeBlock(matching, { p1: 'пес', p2: 'кіт', p3: 'птах' }).score).toBe(1)
    expect(gradeBlock(matching, { p1: '', p2: '', p3: '' }).score).toBe(0)
  })

  it('marks a built sentence whole, and ignores the distractor', () => {
    expect(gradeBlock(sentenceBuilder, ['I', 'have', 'never', 'been', 'there']).score).toBe(1)
    expect(gradeBlock(sentenceBuilder, ['I', 'have', 'been', 'never', 'there']).score).toBe(0)
    expect(gradeBlock(sentenceBuilder, ['I', 'was', 'never', 'been', 'there']).score).toBe(0)
  })

  it('marks categorising item by item', () => {
    expect(gradeBlock(categorize, { i1: 'c1', i2: 'c2', i3: 'c1', i4: 'c1' })).toMatchObject({
      score: 3,
      max: 4,
    })
  })

  it('marks true/false statement by statement, and an unanswered one is wrong', () => {
    expect(gradeBlock(trueFalse, { s1: true, s2: false }).score).toBe(2)
    expect(gradeBlock(trueFalse, { s1: true }).score).toBe(1)
  })

  it('marks a quiz question by question', () => {
    expect(gradeBlock(quizGame, { q1: 'y', q2: 'x' }).score).toBe(2)
    expect(gradeBlock(quizGame, { q1: 'x', q2: 'x' }).score).toBe(1)
  })

  it('gives dictation credit for words in order around omissions and additions', () => {
    const dictation = block({ id: 'di', type: 'dictation', text: 'The quick brown fox jumps.' })
    const grade = gradeBlock(dictation, 'THE, quick very fox jumps!')

    expect(grade).toMatchObject({ score: 4, max: 5 })
    expect(grade.parts).toEqual({ w0: true, w1: true, w2: false, w3: true, w4: true })
    expect(gradeBlock(dictation, 'fox jumps the quick brown').score).toBe(3)
  })

  it('keeps dictation marking bounded for a long answer and old oversized saved answers', () => {
    const dictation = block({ id: 'di', type: 'dictation', text: 'a '.repeat(250).trim() })
    const longButValid = `${'x '.repeat(3_500)}a`

    expect(gradeBlock(dictation, longButValid).score).toBe(1)
    expect(gradeBlock(dictation, 'a '.repeat(5_000)).score).toBe(0)
  })

  it('leaves writing for a person', () => {
    const grade = gradeBlock(freeWriting, 'I went to the cinema.')

    expect(grade.manual).toBe(true)
    // Null, not zero: nobody has marked it, which is not the same as marking it nothing.
    expect(grade.score).toBeNull()
    expect(grade.max).toBe(1)
  })

  it('carries no marks on presentation and practice blocks', () => {
    for (const b of [heading, flashcards, block({ id: 'd', type: 'divider' })]) {
      expect(gradeBlock(b, undefined)).toMatchObject({ score: 0, max: 0 })
    }
  })

  it('spreads the author-set weight across the units', () => {
    const weighted = block({ ...gapFill, id: 'gfw', points: 5 })
    const grade = gradeBlock(weighted, { g1: "don't", g2: 'nope' })

    expect(grade.max).toBe(5)
    expect(grade.score).toBe(2.5)
  })

  it('rounds to something a teacher can read', () => {
    const three = block({
      id: 'gf3',
      type: 'gap_fill',
      points: 1,
      segments: [
        { kind: 'gap', id: 'a', answers: ['x'] },
        { kind: 'gap', id: 'b', answers: ['y'] },
        { kind: 'gap', id: 'c', answers: ['z'] },
      ],
    })

    expect(gradeBlock(three, { a: 'x', b: 'y', c: 'no' }).score).toBe(0.67)
  })

  it('marks nonsense as wrong instead of throwing', () => {
    const junk: unknown[] = [undefined, null, 42, 'string', [], {}, { g1: 7 }, [[]]]

    for (const answer of junk) {
      for (const b of [multipleChoice, gapFill, matching, categorize, trueFalse, quizGame]) {
        expect(() => gradeBlock(b, answer)).not.toThrow()
        expect(gradeBlock(b, answer).score).toBe(0)
      }
    }
  })
})

describe('gradeBlocks', () => {
  const blocks = [heading, multipleChoice, gapFill, freeWriting, flashcards]

  it('totals what a machine marked and keeps what a person still owes separate', () => {
    const result = gradeBlocks(blocks, { mc: ['b'], gf: { g1: "don't", g2: 'has' } })

    expect(result.autoScore).toBe(3)
    expect(result.autoMax).toBe(3)
    // The essay is not counted as lost marks — it is counted as not marked yet.
    expect(result.manualMax).toBe(1)
  })

  it('leaves unmarkable blocks out of the report entirely', () => {
    const result = gradeBlocks(blocks, {})

    expect(Object.keys(result.byBlock).sort()).toEqual(['fw', 'gf', 'mc'])
  })

  it('an untouched step scores zero rather than being undefined', () => {
    expect(gradeBlocks(blocks, {}).autoScore).toBe(0)
  })
})

describe('toStudentBlock', () => {
  /** Deterministic, so a shuffle assertion is a fact rather than a coin toss. */
  const notRandom = () => 0

  const everything = [
    heading,
    multipleChoice,
    gapFill,
    matching,
    sentenceBuilder,
    categorize,
    trueFalse,
    quizGame,
    freeWriting,
    flashcards,
  ]

  it('sends no answer to the browser, anywhere in the payload', () => {
    const wire = JSON.stringify(everything.map((b) => toStudentBlock(b, notRandom)))

    // Every field name that is, or names, the answer.
    for (const key of ['correctIds', 'correctId', 'categoryId', 'isTrue', 'answers', 'correct']) {
      expect(wire).not.toContain(key)
    }

    // And the explanation, which gives it away in prose.
    expect(wire).not.toContain('Third person singular')
  })

  it('keeps everything the student still needs to answer', () => {
    const wire = JSON.stringify(everything.map((b) => toStudentBlock(b, notRandom)))

    for (const visible of ['goes', 'кіт', 'apple', 'Cats can fly', 'never', 'went']) {
      expect(wire).toContain(visible)
    }
  })

  it('hands back gaps to fill but not what fills them', () => {
    const student = toStudentBlock(gapFill, notRandom)

    expect(student).toMatchObject({
      type: 'gap_fill',
      segments: [
        { kind: 'text', text: 'I ' },
        { kind: 'gap', id: 'g1' },
        { kind: 'text', text: ' know. She ' },
        { kind: 'gap', id: 'g2' },
        { kind: 'text', text: ' arrived.' },
      ],
    })
  })

  it('splits matching into two columns and drops the ids from the answer side', () => {
    const student = toStudentBlock(matching, notRandom)

    expect(student).toMatchObject({
      lefts: [
        { id: 'p1', text: 'cat' },
        { id: 'p2', text: 'dog' },
        { id: 'p3', text: 'bird' },
      ],
    })
    expect(new Set((student as { rights: string[] }).rights)).toEqual(
      new Set(['кіт', 'пес', 'птах']),
    )
  })

  it('shuffles the sentence tokens rather than trusting the player to', () => {
    const student = toStudentBlock(sentenceBuilder, notRandom) as { tokens: string[] }

    expect(student.tokens).toHaveLength(6)
    expect(student.tokens).not.toEqual(['I', 'have', 'never', 'been', 'there', 'was'])
    expect([...student.tokens].sort()).toEqual(
      ['I', 'have', 'never', 'been', 'there', 'was'].sort(),
    )
  })

  it('leaves alone the blocks that have nothing to hide', () => {
    expect(toStudentBlock(heading, notRandom)).toEqual(heading)
    expect(toStudentBlock(flashcards, notRandom)).toEqual(flashcards)
    expect(toStudentBlock(freeWriting, notRandom)).toEqual(freeWriting)
  })

  it('marks the same either way — stripping does not change what is right', () => {
    // The projection is for the browser; the server still grades from the full block.
    expect(gradeBlock(matching, { p1: 'кіт', p2: 'пес', p3: 'птах' }).score).toBe(3)
  })
})

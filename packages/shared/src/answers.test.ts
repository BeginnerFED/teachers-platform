import { describe, expect, it } from 'vitest'
import { answerFingerprint, canonicalAnswer, fingerprintOf } from './answers'

describe('an answer in canonical form', () => {
  it('is the same whatever order its keys arrive in, nested ones too', () => {
    const built = { g2: 'b', g1: { z: 1, a: [2, 1] } }
    const stored = { g1: { a: [2, 1], z: 1 }, g2: 'b' }

    expect(canonicalAnswer(built)).toBe(canonicalAnswer(stored))
    expect(canonicalAnswer(built)).toBe('{"g1":{"a":[2,1],"z":1},"g2":"b"}')
  })

  it('keeps the order of a list, which is part of the answer', () => {
    expect(canonicalAnswer(['a', 'b'])).not.toBe(canonicalAnswer(['b', 'a']))
  })

  it('tells no answer apart from an empty one', () => {
    expect(canonicalAnswer(undefined)).toBe('')
    expect(canonicalAnswer('')).toBe('""')
    expect(canonicalAnswer({})).toBe('{}')
    expect(canonicalAnswer(null)).toBe('null')
  })
})

describe('the fingerprint of an answer', () => {
  it('is cyrb53 in base 36, so the browser and the server always agree on it', () => {
    // The published reference values, pinned: a change here strands every save in flight.
    expect(fingerprintOf('a')).toBe((7929297801672961).toString(36))
    expect(fingerprintOf('revenge')).toBe((4051478007546757).toString(36))
    expect(fingerprintOf('revenue')).toBe((8309097637345594).toString(36))
  })

  it('names an answer by its canonical form', () => {
    expect(answerFingerprint({ b: 1, a: 2 })).toBe(answerFingerprint({ a: 2, b: 1 }))
    expect(answerFingerprint({ a: 2, b: 1 })).toBe(fingerprintOf('{"a":2,"b":1}'))
    expect(answerFingerprint(undefined)).toBe(fingerprintOf(''))
  })

  it('tells different answers apart, a single character too', () => {
    const answers = ['went', 'want', 'Went', '', ['went'], { g1: 'went' }, { g1: 'wen' }, null]
    const names = new Set(answers.map(answerFingerprint))

    expect(names.size).toBe(answers.length)
    expect(answerFingerprint('My weekend was quiet.')).not.toBe(
      answerFingerprint('My weekend was quiet!'),
    )
  })

  it('stays short', () => {
    expect(answerFingerprint('x'.repeat(50_000))).toMatch(/^[0-9a-z]{1,11}$/)
  })
})

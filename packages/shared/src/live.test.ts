import { describe, expect, it } from 'vitest'
import { applyBoardOps, boardOp, type LiveBoard } from './contracts/live'

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

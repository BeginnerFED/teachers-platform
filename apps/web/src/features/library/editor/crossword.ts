export type CrosswordEntry = { id: string; answer: string }
export type CrosswordPlacement = { id: string; r: number; c: number; dir: 'across' | 'down' }

const CANVAS = 48
const MAX_SIZE = 24

/**
 * Lays entries into a crossword: the longest across the middle, then each next word
 * hung off a letter it shares with one already placed, perpendicular to it. Greedy and
 * plain — a real crossword compiler is a research project, and a teacher's six words do
 * not need one. Null when a word shares no usable letter with what is on the board, which
 * the editor reports as "change or drop a word".
 *
 * The rules that keep it a crossword rather than a word pile: a new word may only touch
 * the board where it crosses, the cells before and after it must be empty, and it must
 * not run alongside another word.
 */
export function generateCrossword(
  entries: CrosswordEntry[],
): { size: number; placements: CrosswordPlacement[] } | null {
  const words = entries.filter((e) => e.answer.length >= 2)
  if (words.length < 2) return null

  const ordered = [...words].sort((a, b) => b.answer.length - a.answer.length)
  const board = new Map<string, string>()
  const placed: (CrosswordPlacement & { answer: string })[] = []

  const key = (r: number, c: number) => `${r},${c}`
  const at = (r: number, c: number) => board.get(key(r, c))

  const put = (p: CrosswordPlacement & { answer: string }) => {
    ;[...p.answer].forEach((letter, i) => {
      board.set(key(p.dir === 'down' ? p.r + i : p.r, p.dir === 'across' ? p.c + i : p.c), letter)
    })
    placed.push(p)
  }

  const fits = (answer: string, r: number, c: number, dir: 'across' | 'down', crossAt: number) => {
    const cells = [...answer].map((letter, i) => ({
      letter,
      r: dir === 'down' ? r + i : r,
      c: dir === 'across' ? c + i : c,
    }))

    if (cells.some((cell) => cell.r < 0 || cell.c < 0 || cell.r >= CANVAS || cell.c >= CANVAS))
      return false

    const before = dir === 'across' ? at(r, c - 1) : at(r - 1, c)
    const last = cells[cells.length - 1]
    const after = last
      ? dir === 'across'
        ? at(last.r, last.c + 1)
        : at(last.r + 1, last.c)
      : undefined
    if (before || after) return false

    return cells.every((cell, i) => {
      const existing = at(cell.r, cell.c)
      if (existing) return existing === cell.letter && i === crossAt
      // An empty cell may not sit beside another word along the perpendicular axis, or
      // the two would read as one.
      const sideA = dir === 'across' ? at(cell.r - 1, cell.c) : at(cell.r, cell.c - 1)
      const sideB = dir === 'across' ? at(cell.r + 1, cell.c) : at(cell.r, cell.c + 1)
      return !sideA && !sideB
    })
  }

  const first = ordered[0]
  if (!first) return null
  put({
    id: first.id,
    answer: first.answer,
    r: CANVAS / 2,
    c: Math.floor((CANVAS - first.answer.length) / 2),
    dir: 'across',
  })

  for (const entry of ordered.slice(1)) {
    let done = false

    for (const anchor of placed) {
      if (done) break
      const dir = anchor.dir === 'across' ? 'down' : 'across'

      for (let i = 0; i < entry.answer.length && !done; i++) {
        for (let j = 0; j < anchor.answer.length && !done; j++) {
          if (entry.answer[i] !== anchor.answer[j]) continue

          const crossR = anchor.dir === 'down' ? anchor.r + j : anchor.r
          const crossC = anchor.dir === 'across' ? anchor.c + j : anchor.c
          const r = dir === 'down' ? crossR - i : crossR
          const c = dir === 'across' ? crossC - i : crossC

          if (fits(entry.answer, r, c, dir, i)) {
            put({ id: entry.id, answer: entry.answer, r, c, dir })
            done = true
          }
        }
      }
    }

    if (!done) return null
  }

  // Crop to what was used, square it, and refuse anything a phone could not show.
  const rows = placed.flatMap((p) => (p.dir === 'down' ? [p.r, p.r + p.answer.length - 1] : [p.r]))
  const cols = placed.flatMap((p) =>
    p.dir === 'across' ? [p.c, p.c + p.answer.length - 1] : [p.c],
  )
  const minR = Math.min(...rows)
  const minC = Math.min(...cols)
  const size = Math.max(Math.max(...rows) - minR + 1, Math.max(...cols) - minC + 1, 5)
  if (size > MAX_SIZE) return null

  return {
    size,
    placements: placed.map(({ id, r, c, dir }) => ({ id, r: r - minR, c: c - minC, dir })),
  }
}

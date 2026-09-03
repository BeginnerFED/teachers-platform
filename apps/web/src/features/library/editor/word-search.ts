import { seededRandom } from '@/lib/random'

export type Placement = { word: string; cells: { r: number; c: number }[] }

/** Upper-case letters and nothing else: what the grid can hold. */
export const normaliseWord = (input: string) => input.toUpperCase().replace(/[^A-Z]/g, '')

// Across, down, both diagonals, and all four of those backwards.
const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [1, -1],
] as const

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Lays the words into a grid and fills the rest with noise. Seeded, so the same words,
 * size and seed give the same puzzle — the editor stores the result with the block, and
 * every student then gets the puzzle the teacher looked at.
 *
 * Longest words first, since they are the hardest to fit; crossings are allowed where the
 * letters agree. Null when a word cannot be placed after a fair number of tries, which the
 * editor reports as "make the grid bigger or drop a word" rather than looping forever.
 */
export function generateWordSearch(
  words: string[],
  size: number,
  seed: number,
): { grid: string[][]; placements: Placement[] } | null {
  const rand = seededRandom(seed)
  const grid: (string | null)[][] = Array.from({ length: size }, () =>
    Array<string | null>(size).fill(null),
  )
  const placements: Placement[] = []

  const ordered = [...new Set(words)].sort((a, b) => b.length - a.length)

  for (const word of ordered) {
    if (word.length > size) return null

    let placed = false

    for (let attempt = 0; attempt < 400 && !placed; attempt++) {
      const direction = DIRECTIONS[Math.floor(rand() * DIRECTIONS.length)]
      if (!direction) continue
      const [dr, dc] = direction
      const r0 = Math.floor(rand() * size)
      const c0 = Math.floor(rand() * size)
      const rEnd = r0 + dr * (word.length - 1)
      const cEnd = c0 + dc * (word.length - 1)

      if (rEnd < 0 || rEnd >= size || cEnd < 0 || cEnd >= size) continue

      const cells: { r: number; c: number }[] = []
      let fits = true

      for (let i = 0; i < word.length; i++) {
        const r = r0 + dr * i
        const c = c0 + dc * i
        const existing = grid[r]?.[c]

        if (existing !== null && existing !== undefined && existing !== word[i]) {
          fits = false
          break
        }

        cells.push({ r, c })
      }

      if (!fits) continue

      cells.forEach((cell, i) => {
        const row = grid[cell.r]
        if (row) row[cell.c] = word[i] ?? null
      })
      placements.push({ word, cells })
      placed = true
    }

    if (!placed) return null
  }

  return {
    grid: grid.map((row) => row.map((cell) => cell ?? LETTERS[Math.floor(rand() * 26)] ?? 'A')),
    placements,
  }
}

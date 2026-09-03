/**
 * Seeded randomness for things that must come out the same on the server and in the
 * browser. A memory game shuffled with Math.random() during render is a hydration
 * mismatch; shuffled from a seed derived from the block's id, it is the same layout
 * twice — and, as a bonus, the same layout every time that student opens it.
 */

/** mulberry32: small, fast, and good enough for shuffling cards. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a, so a string can seed the generator above. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

/** Fisher–Yates over a copy. */
export function shuffleWith<T>(items: readonly T[], rand: () => number): T[] {
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

/**
 * Answers, compared the same way in the browser and on the server. A block's answer is
 * whatever JSON its player builds, and the two sides hold it with its keys in different
 * orders: the database hands an answer back in its own, the player builds it in another.
 */

/**
 * One answer as a string, whatever order its keys are in. No answer at all is the empty
 * string, which no answer can be.
 */
export function canonicalAnswer(value: unknown): string {
  if (value === undefined) return ''

  return JSON.stringify(value, (_, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : item,
  )
}

/**
 * A short name for an answer already in its canonical form: a 53-bit hash (cyrb53), written
 * in base 36. A save names the answer it was typed over this way rather than sending the
 * whole of it again; two different answers sharing a name is not a case worth planning for
 * at 53 bits. A name, not a secret.
 */
export function fingerprintOf(canonical: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57

  for (let index = 0; index < canonical.length; index++) {
    const code = canonical.charCodeAt(index)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)

  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/** The fingerprint of an answer, whatever order its keys are in. */
export function answerFingerprint(value: unknown): string {
  return fingerprintOf(canonicalAnswer(value))
}

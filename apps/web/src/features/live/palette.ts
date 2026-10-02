/**
 * Who is who in a live room, as a colour.
 *
 * Kept apart from the overlay that draws with it, and free of imports, so a screen that
 * only needs the colours — the sign-in page's product tour — does not pull the live
 * room's realtime and contract code in with them.
 */

/** Eight colours that tell people apart and stay legible on white; one per person, by id. */
export const PALETTE = [
  '#f97316',
  '#0ea5e9',
  '#22c55e',
  '#a855f7',
  '#ec4899',
  '#eab308',
  '#14b8a6',
  '#ef4444',
]

export function paletteIndex(id: string): number {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % PALETTE.length
}

export function colorFor(id: string): string {
  return PALETTE[paletteIndex(id)] ?? PALETTE[0]!
}

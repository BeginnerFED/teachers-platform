/**
 * A colour per person, worked out from their id.
 *
 * On a week where four teachers are all busy at nine, the avatars are what tell them
 * apart, and two grey circles with different letters in them do that far worse than two
 * coloured ones. Derived rather than stored so it needs no column, no migration and no
 * decision from anybody — and it stays the same for a given person on every screen.
 *
 * Deliberately separate from the block's own colour, which says whether the lesson
 * happened. One of them is about the person, the other about the session; sharing a
 * palette would make each harder to read.
 */
const TINTS = [
  'bg-sky-100 text-sky-800',
  'bg-emerald-100 text-emerald-800',
  'bg-violet-100 text-violet-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-teal-100 text-teal-800',
  'bg-indigo-100 text-indigo-800',
  'bg-lime-100 text-lime-800',
] as const

export function tintFor(id: string): string {
  // A plain sum of code points. It only has to spread a handful of people across eight
  // buckets, and anything stronger would be pretending to a precision this does not need.
  let total = 0
  for (let index = 0; index < id.length; index++) total += id.charCodeAt(index)

  return TINTS[total % TINTS.length]
}

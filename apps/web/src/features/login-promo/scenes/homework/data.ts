/**
 * What the homework chapter gives and to whom: data, not dictionary copy. The lesson is
 * the one the earlier chapters drafted, edited and taught; the students' names come from
 * the dictionary's made-up class, their addresses from the domain reserved for examples.
 */
export const LESSON = { title: 'Ordering food at a restaurant', steps: 4 } as const

export const EMAILS = {
  olya: 'olya@example.com',
  maksym: 'maksym@example.com',
  iryna: 'iryna@example.com',
} as const

/** Earlier homework already on the desk, so the new rows land on a desk in use. */
export const EARLIER = {
  anna: 'Small talk at work',
  dmytro: 'Giving directions',
} as const

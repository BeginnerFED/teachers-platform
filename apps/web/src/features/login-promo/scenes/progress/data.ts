/**
 * Оля's numbers, as the student drawer would count them once the chapters before this
 * one have happened: the homework she was just given is open, the work reviewed in the
 * feedback chapter is finished (so nothing waits for review), and two paid lessons are
 * left for the three still booked — the one thing that needs the teacher.
 *
 * Plain data with no components in it, so the server-side copy picker can read it too.
 */
export const OLYA = {
  credits: { remaining: 2 },
  lessons: { attended: 24, missed: 2, excused: 1, planned: 3 },
  homework: { assigned: 2, submitted: 0, graded: 11 },
} as const

/**
 * The platform shelf the library scene shows.
 *
 * Lesson titles are lesson content, written in English like every lesson on the platform,
 * so they live here rather than in the dictionaries. Plain data, with no imports, so both
 * the copy picker on the server and the scene in the browser can read it.
 */

/** The CEFR levels, in the order the level picker lists them (packages/shared LEVELS). */
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

export type ShelfLevel = (typeof LEVELS)[number]

/** The level the teacher picks in the scene. */
export const PICKED_LEVEL: ShelfLevel = 'B1'

export type ShelfLesson = {
  id: string
  title: string
  level: ShelfLevel
  steps: number
  minutes: number
}

/** "All levels": the platform library as it opens, newest first, every level mixed. */
export const SHELF: readonly ShelfLesson[] = [
  { id: 'greetings', title: 'Greetings and introductions', level: 'A1', steps: 3, minutes: 15 },
  {
    id: 'present-perfect',
    title: 'Present Perfect: life experiences',
    level: 'B1',
    steps: 4,
    minutes: 25,
  },
  { id: 'directions', title: 'Asking for directions in town', level: 'A2', steps: 3, minutes: 18 },
  {
    id: 'phrasal-verbs',
    title: 'Phrasal verbs with get and take',
    level: 'B2',
    steps: 4,
    minutes: 22,
  },
  { id: 'presentations', title: 'Persuasive presentations', level: 'C1', steps: 5, minutes: 30 },
  { id: 'clothes', title: 'Shopping for clothes and sizes', level: 'A2', steps: 3, minutes: 16 },
  { id: 'small-talk', title: 'Small talk with colleagues', level: 'B1', steps: 3, minutes: 20 },
  { id: 'idioms', title: 'Idioms about time and money', level: 'C2', steps: 4, minutes: 24 },
]

/** The same shelf at B1, in the same order — the two B1 lessons above among them. */
export const PICKED_SHELF: readonly ShelfLesson[] = [
  {
    id: 'present-perfect',
    title: 'Present Perfect: life experiences',
    level: 'B1',
    steps: 4,
    minutes: 25,
  },
  { id: 'complaints', title: 'Making polite complaints', level: 'B1', steps: 4, minutes: 22 },
  { id: 'small-talk', title: 'Small talk with colleagues', level: 'B1', steps: 3, minutes: 20 },
  { id: 'advice', title: 'Giving advice with should', level: 'B1', steps: 3, minutes: 18 },
  { id: 'travel', title: 'Travel plans and bookings', level: 'B1', steps: 4, minutes: 24 },
  { id: 'used-to', title: 'Used to: life then and now', level: 'B1', steps: 3, minutes: 16 },
  { id: 'phone-calls', title: 'Making phone calls at work', level: 'B1', steps: 3, minutes: 20 },
  { id: 'doctor', title: 'At the doctor’s: health problems', level: 'B1', steps: 5, minutes: 28 },
]

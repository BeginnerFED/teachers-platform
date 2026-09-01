/**
 * Domain constants shared by the web app and the API.
 * Kept deliberately small — the full data model lands with the database schema.
 */

/** Three account types: the platform admin, the teachers who pay, their students. */
export const ROLES = ['admin', 'teacher', 'student'] as const
export type Role = (typeof ROLES)[number]

/** CEFR levels every piece of content is tagged with. */
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type Level = (typeof LEVELS)[number]

/**
 * Activity types the renderer knows how to draw. An activity is stored as JSON
 * data against one of these types, so adding a lesson never means writing code.
 * Only `free_writing` needs an AI call to grade; the rest check deterministically.
 */
export const ACTIVITY_TYPES = [
  'multiple_choice',
  'gap_fill',
  'matching',
  'sentence_builder',
  'categorize',
  'true_false',
  'flashcards',
  'reading',
  'free_writing',
  'quiz_game',
] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

/**
 * Every wall-clock time in the product is this zone: a lesson at nine o'clock is nine
 * o'clock for the teacher who teaches it, not for whichever server rendered the page.
 *
 * A constant rather than a setting because the platform serves one market. It becomes a
 * column on platform_settings the day that stops being true — and Kyiv observes summer
 * time while several of its neighbours do not, so this cannot be an offset.
 */
export const PLATFORM_TIME_ZONE = 'Europe/Kyiv'

/** Ukrainian is the default; the rest are planned translations. */
export const LOCALES = ['uk', 'en', 'ru', 'pl'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'uk'

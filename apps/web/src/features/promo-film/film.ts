/**
 * The promo film's running order: twelve shots on a 120 BPM grid (a bar is 2 s), cut on
 * the downbeat. Plain data, shared by the picture, the soundtrack and the renderer.
 *
 * A shot is drawn from `start - lead` to `start + duration + tail`, so neighbours overlap
 * for their transition: the outgoing shot owns its exit, the incoming one its entrance.
 */

export const SHOT_IDS = [
  'open',
  'problem',
  'turn',
  'library',
  'draft',
  'editor',
  'live',
  'homework',
  'check',
  'schedule',
  'climax',
  'end',
] as const

export type ShotId = (typeof SHOT_IDS)[number]

export type ShotTiming = { start: number; duration: number; lead: number; tail: number }

export const SHOT_TIMES: Record<ShotId, ShotTiming> = {
  open: { start: 0, duration: 4000, lead: 0, tail: 300 },
  problem: { start: 4000, duration: 6000, lead: 300, tail: 300 },
  turn: { start: 10000, duration: 4000, lead: 300, tail: 400 },
  library: { start: 14000, duration: 4000, lead: 400, tail: 400 },
  draft: { start: 18000, duration: 4000, lead: 400, tail: 400 },
  editor: { start: 22000, duration: 4000, lead: 400, tail: 400 },
  live: { start: 26000, duration: 4000, lead: 400, tail: 400 },
  homework: { start: 30000, duration: 4000, lead: 400, tail: 400 },
  check: { start: 34000, duration: 4000, lead: 400, tail: 400 },
  schedule: { start: 38000, duration: 4000, lead: 400, tail: 400 },
  climax: { start: 42000, duration: 3000, lead: 400, tail: 300 },
  end: { start: 45000, duration: 3000, lead: 300, tail: 0 },
}

export const FILM_DURATION = 48000

/** The feature chapters, as the HUD numbers them. */
export const CHAPTERS = (
  ['library', 'draft', 'editor', 'live', 'homework', 'check', 'schedule'] as const
).map((id) => ({ id, start: SHOT_TIMES[id].start }))

export type ChapterId = (typeof CHAPTERS)[number]['id']

/** Sections of the score, so the music can build and drop with the picture. */
export const SECTIONS = [
  { id: 'intro', start: 0, end: 4000 },
  { id: 'tension', start: 4000, end: 10000 },
  { id: 'drop', start: 10000, end: 14000 },
  { id: 'groove', start: 14000, end: 42000 },
  { id: 'climax', start: 42000, end: 45000 },
  { id: 'outro', start: 45000, end: 48000 },
] as const

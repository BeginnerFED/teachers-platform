import { EXIT_LEAD_MS } from './engine/motion'

/**
 * The tour's chapters, in playing order, and how long each one lasts.
 *
 * Plain data with no components in it, so the server can read it when it picks the copy
 * and a test can read it without a browser.
 */
export const SCENE_IDS = [
  'intro',
  'library',
  'draft',
  'editor',
  'live',
  'homework',
  'feedback',
  'progress',
  'schedule',
] as const

export type SceneId = (typeof SCENE_IDS)[number]

export type SceneTiming = {
  /** Milliseconds from the scene's first frame to the next scene's first frame. */
  duration: number
  /**
   * The moment drawn as the scene's still frame — under reduced motion, after a jump
   * while paused, and in screenshots. Defaults to just before the scene starts leaving.
   */
  still?: number
}

export const TIMELINE: Record<SceneId, SceneTiming> = {
  intro: { duration: 3000 },
  library: { duration: 5400 },
  draft: { duration: 6600 },
  editor: { duration: 5600 },
  live: { duration: 6600 },
  homework: { duration: 5600 },
  feedback: { duration: 6000 },
  progress: { duration: 4800 },
  schedule: { duration: 5600 },
}

export function stillTime(id: SceneId): number {
  const { duration, still } = TIMELINE[id]
  return still ?? duration - EXIT_LEAD_MS - 40
}

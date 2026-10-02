import type { CSSProperties } from 'react'

/**
 * The house motion, as numbers.
 *
 * The same curve and durations the product uses everywhere (globals.css `rise-in`), so
 * the tour moves the way the product it is showing moves.
 */
export const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

/** Arrival: 6px up and in. */
export const RISE_MS = 280

/** Rows in a list arrive one after another, but a long list must not trickle. */
export const STAGGER_MS = 35
export const STAGGER_CAP = 8

/** A scene leaves together, a little faster than it arrived. */
export const EXIT_MS = 160

/** How long before its end a scene starts to leave. */
export const EXIT_LEAD_MS = 180

/**
 * The stage is drawn at one fixed size and zoomed to fit the panel, the way a video has
 * one resolution. Positions inside it are in these logical pixels.
 */
export const STAGE_WIDTH = 520
export const STAGE_HEIGHT = 720

/** The content column: 40px of air either side, the same rhythm as the form's `p-10`. */
export const COLUMN_WIDTH = 440

/** `animation-delay` for the nth item of a staggered arrival, starting at `base` ms. */
export function staggered(index: number, base = 0): CSSProperties {
  return { animationDelay: `${base + Math.min(index, STAGGER_CAP) * STAGGER_MS}ms` }
}

export type StagePoint = { x: number; y: number }
export type StageRect = StagePoint & { width: number; height: number }

/**
 * Where an element sits on the stage, in the stage's own logical pixels.
 *
 * The stage is zoomed, so client rectangles come back in screen pixels. The ratio is read
 * from the stage's measured width rather than its `zoom` style, which keeps the answer
 * right whichever way a browser implements zoom.
 */
export function stageRect(element: Element): StageRect | null {
  const stage = element.closest('[data-promo-stage]')
  if (!stage) return null

  // Layout offsets first: they ignore transforms, so a stage the film tilts in 3D still
  // measures in its own flat coordinates. Only an element without layout offsets (an SVG
  // part) falls back to client rectangles.
  if (element instanceof HTMLElement && stage instanceof HTMLElement) {
    let x = 0
    let y = 0
    let node: HTMLElement | null = element
    while (node && node !== stage) {
      x += node.offsetLeft
      y += node.offsetTop
      const parent: Element | null = node.offsetParent
      node = parent instanceof HTMLElement ? parent : null
    }
    if (node === stage) return { x, y, width: element.offsetWidth, height: element.offsetHeight }
  }

  const frame = stage.getBoundingClientRect()
  if (frame.width === 0) return null

  const scale = frame.width / STAGE_WIDTH
  const rect = element.getBoundingClientRect()

  return {
    x: (rect.left - frame.left) / scale,
    y: (rect.top - frame.top) / scale,
    width: rect.width / scale,
    height: rect.height / scale,
  }
}

/** The centre of an element on the stage. */
export function stageCenter(element: Element): StagePoint | null {
  const rect = stageRect(element)
  if (!rect) return null

  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

/** An eased 0–1, close to the house curve, for values that count rather than move. */
export function easeOut(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress))
  return 1 - (1 - clamped) ** 5
}

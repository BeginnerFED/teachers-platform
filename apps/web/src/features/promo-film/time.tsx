'use client'

import { createContext, useContext } from 'react'

/**
 * The promo film's clock and the arithmetic every shot animates with.
 *
 * Nothing in the film animates by itself. Every style is a function of time, read from
 * these contexts, so the same frame comes out the same way every time it is drawn — which
 * is what lets the film be rendered frame by frame into a video file.
 */

export const FPS = 30
export const WIDTH = 1080
export const HEIGHT = 1350

/** 120 beats a minute: a beat every 500 ms, a bar every 2 s. Cuts land on the grid. */
export const BEAT = 500
export const BAR = BEAT * 4

/** The brand's own orange, #ff4f01, and the darker one white text sits on. */
export const BRAND = '#ff4f01'
export const BRAND_DEEP = '#e22f00'
export const INK = '#0b0908'
export const PAPER = '#fbf7f4'

const FilmTimeContext = createContext(0)
const ShotContext = createContext<{ local: number; duration: number }>({ local: 0, duration: 0 })

export const FilmTimeProvider = FilmTimeContext.Provider
export const ShotProvider = ShotContext.Provider

/** Milliseconds since the film began. */
export function useFilmTime(): number {
  return useContext(FilmTimeContext)
}

/**
 * Milliseconds since this shot began (negative while a shot is drawn early for a
 * transition) and how long the shot lasts.
 */
export function useShot(): { local: number; duration: number } {
  return useContext(ShotContext)
}

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

export const mix = (from: number, to: number, amount: number) => from + (to - from) * amount

/** A CSS-style cubic-bezier, solved for x by Newton's method with a bisection fallback. */
export function bezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const a = (p1: number, p2: number) => 1 - 3 * p2 + 3 * p1
  const b = (p1: number, p2: number) => 3 * p2 - 6 * p1
  const c = (p1: number) => 3 * p1
  const at = (t: number, p1: number, p2: number) => ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t
  const slope = (t: number, p1: number, p2: number) =>
    3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1)

  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1

    let t = x
    for (let i = 0; i < 8; i++) {
      const error = at(t, x1, x2) - x
      if (Math.abs(error) < 1e-5) return at(t, y1, y2)
      const d = slope(t, x1, x2)
      if (Math.abs(d) < 1e-6) break
      t -= error / d
    }

    let low = 0
    let high = 1
    t = x
    for (let i = 0; i < 24; i++) {
      const value = at(t, x1, x2)
      if (Math.abs(value - x) < 1e-5) break
      if (value < x) low = t
      else high = t
      t = (low + high) / 2
    }
    return at(t, y1, y2)
  }
}

export type Easing = (x: number) => number

export const ease = {
  linear: (x: number) => x,
  /** The product's own curve: everything in the app arrives on it. */
  house: bezier(0.22, 1, 0.36, 1),
  inCubic: (x: number) => x * x * x,
  outCubic: (x: number) => 1 - (1 - x) ** 3,
  inOutCubic: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  outQuint: (x: number) => 1 - (1 - x) ** 5,
  inExpo: (x: number) => (x === 0 ? 0 : 2 ** (10 * x - 10)),
  outExpo: (x: number) => (x === 1 ? 1 : 1 - 2 ** (-10 * x)),
  inOutExpo: (x: number) =>
    x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2,
  inOutQuart: (x: number) => (x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2),
  /** Overshoots a little and settles: for things that land with weight. */
  outBack: (x: number) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
  },
} satisfies Record<string, Easing>

/** 0 → 1 across [start, start + duration], eased and clamped. */
export function progress(
  time: number,
  start: number,
  duration: number,
  easing: Easing = ease.linear,
) {
  if (duration <= 0) return time >= start ? 1 : 0
  return easing(clamp((time - start) / duration))
}

/**
 * Maps `value` through matching input/output stops, like a keyframe track. Each segment
 * can have its own easing; outside the stops the ends hold.
 */
export function interpolate(
  value: number,
  input: readonly number[],
  output: readonly number[],
  easing: Easing | readonly Easing[] = ease.linear,
): number {
  if (value <= input[0]!) return output[0]!
  const last = input.length - 1
  if (value >= input[last]!) return output[last]!

  let segment = 0
  while (segment < last - 1 && value > input[segment + 1]!) segment++

  const from = input[segment]!
  const to = input[segment + 1]!
  const curve = Array.isArray(easing) ? (easing[segment] ?? ease.linear) : (easing as Easing)
  const amount = curve(clamp((value - from) / (to - from)))

  return mix(output[segment]!, output[segment + 1]!, amount)
}

/**
 * A damped spring from 0 to 1, `elapsed` ms after it was let go. Solved in closed form, so
 * any frame can be drawn without drawing the ones before it.
 */
export function spring(
  elapsed: number,
  {
    stiffness = 170,
    damping = 22,
    mass = 1,
  }: { stiffness?: number; damping?: number; mass?: number } = {},
): number {
  if (elapsed <= 0) return 0

  const t = elapsed / 1000
  const omega = Math.sqrt(stiffness / mass)
  const zeta = damping / (2 * Math.sqrt(stiffness * mass))

  if (zeta < 1) {
    const omegaD = omega * Math.sqrt(1 - zeta * zeta)
    return (
      1 -
      Math.exp(-zeta * omega * t) *
        (Math.cos(omegaD * t) + ((zeta * omega) / omegaD) * Math.sin(omegaD * t))
    )
  }

  return 1 - Math.exp(-omega * t) * (1 + omega * t)
}

/** A seeded pseudo-random stream (mulberry32): the same seed draws the same film. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let r = Math.imul(state ^ (state >>> 15), 1 | state)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** A few seeded numbers for an item, stable across frames. */
export function randoms(seed: number, count: number): number[] {
  const next = seeded(seed)
  return Array.from({ length: count }, () => next())
}

/** Time in frames, for things that should step rather than glide (grain, flicker). */
export function frameOf(time: number): number {
  return Math.floor((time / 1000) * FPS)
}

'use client'

import { GraduationCapIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { BRAND, clamp, ease, frameOf, HEIGHT, mix, randoms, useShot, WIDTH } from '../time'

/**
 * Pieces the three brand moments share: `open` (the dot that explodes into the mark),
 * `turn` and `end` (the lockup that folds back into the dot, so the loop joins).
 */

/** The centre of the frame, where the film's first and last light sits. */
export const CENTRE = { x: WIDTH / 2, y: HEIGHT / 2 } as const

/**
 * The ember at rest. `open` starts on exactly this and `end` finishes on exactly this, with
 * the backdrop covered by ink in both, so the last frame of the loop is its first.
 */
export const EMBER_REST = { size: 10, glow: 150, heat: 0.7 } as const

/** A small hot dot of brand light: core, inner bloom and a wide soft halo. */
export function Ember({
  x = CENTRE.x,
  y = CENTRE.y,
  size = EMBER_REST.size,
  glow = EMBER_REST.glow,
  heat = EMBER_REST.heat,
}: {
  x?: number
  y?: number
  size?: number
  glow?: number
  heat?: number
}) {
  if (size <= 0.2 || heat <= 0.001) return null
  const bloom = size * 3.6

  return (
    <>
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: x - glow / 2,
          top: y - glow / 2,
          width: glow,
          height: glow,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgb(255 79 1 / ${0.3 * heat}) 0%, rgb(255 79 1 / ${0.09 * heat}) 36%, transparent 70%)`,
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: x - bloom / 2,
          top: y - bloom / 2,
          width: bloom,
          height: bloom,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgb(255 150 70 / ${0.75 * heat}) 0%, rgb(255 90 20 / ${0.28 * heat}) 34%, transparent 70%)`,
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: '50%',
          opacity: clamp(heat * 1.45),
          background: `radial-gradient(circle at 50% 42%, #fff8f2 0%, #ffc9a2 32%, #ff7a2e 66%, ${BRAND} 100%)`,
        }}
      />
    </>
  )
}

/** A band of light passing across a rounded surface (the mark), `amount` 0 → 1. */
export function Gloss({
  size,
  radius,
  amount,
  strength = 0.6,
}: {
  size: number
  radius: number
  amount: number
  strength?: number
}) {
  if (amount <= 0 || amount >= 1) return null
  const left = mix(-0.9, 1.3, amount) * size

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: radius,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -size * 0.4,
          height: size * 1.8,
          left,
          width: size * 0.42,
          background: `linear-gradient(90deg, transparent, rgb(255 255 255 / ${strength}) 50%, transparent)`,
          transform: 'rotate(20deg)',
        }}
      />
    </div>
  )
}

/**
 * The product's mark drawn exactly as `LogoMark` draws it, but able to round into a dot and
 * lose its cap: the shape the end card folds back into the ember with.
 */
export function MarkShape({
  size,
  round = 0,
  icon = 1,
  glow = 0,
  style,
}: {
  size: number
  round?: number
  icon?: number
  glow?: number
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: mix(size * 0.26, size / 2, round),
        background: `linear-gradient(145deg, #ff7a33, ${BRAND} 45%, #e22f00)`,
        display: 'grid',
        placeItems: 'center',
        boxShadow: [
          `0 ${size * 0.08}px ${size * 0.3}px rgb(255 79 1 / ${0.35 + glow * 0.4})`,
          `0 0 ${size * glow}px rgb(255 120 40 / ${0.6 * glow})`,
          'inset 0 1px 0 rgb(255 255 255 / 0.35)',
        ].join(', '),
        ...style,
      }}
    >
      {icon > 0.01 ? (
        <GraduationCapIcon
          color="white"
          strokeWidth={2}
          style={{ width: size * 0.56, height: size * 0.56, opacity: icon }}
        />
      ) : null}
    </div>
  )
}

/**
 * A flash of light from a point: white-hot at the source, warm toward the edges, screened
 * onto the frame so it brightens instead of greying. Up fast, down slower.
 */
export function LightFlash({
  at,
  x,
  y,
  rise = 40,
  fall = 460,
  peak = 1,
}: {
  at: number
  x: number
  y: number
  rise?: number
  fall?: number
  peak?: number
}) {
  const { local } = useShot()
  if (local < at) return null
  const amount =
    local < at + rise
      ? ease.outCubic(clamp((local - at) / rise))
      : 1 - ease.outCubic(clamp((local - at - rise) / fall))
  if (amount <= 0.002) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        opacity: amount * peak,
        mixBlendMode: 'screen',
        background: `radial-gradient(circle at ${x}px ${y}px, #ffffff 0%, #fff1e6 12%, #ffc49a 30%, rgb(255 120 40 / 0.85) 55%, rgb(255 79 1 / 0.5) 85%)`,
      }}
    />
  )
}

/**
 * Soft god-rays from a point: two sets of thin conic beams turning against each other,
 * masked to fade at the source and at the rim.
 */
export function Rays({
  x,
  y,
  size,
  turn = 0,
  opacity = 1,
  color = '255 120 50',
}: {
  x: number
  y: number
  size: number
  /** Degrees the beams have turned. */
  turn?: number
  opacity?: number
  /** RGB triplet, space separated. */
  color?: string
}) {
  if (opacity <= 0.003 || size <= 1) return null
  const mask =
    'radial-gradient(circle, transparent 4%, black 18%, rgb(0 0 0 / 0.55) 36%, transparent 60%)'
  const base: CSSProperties = {
    position: 'absolute',
    left: x - size / 2,
    top: y - size / 2,
    width: size,
    height: size,
    borderRadius: '50%',
    maskImage: mask,
    WebkitMaskImage: mask,
  }

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0" style={{ opacity }}>
      <div
        style={{
          ...base,
          background: `repeating-conic-gradient(from ${turn}deg at 50% 50%, rgb(${color} / 0) 0deg, rgb(${color} / 0.55) 2.2deg, rgb(${color} / 0) 4.6deg, rgb(${color} / 0) 13deg)`,
        }}
      />
      <div
        style={{
          ...base,
          background: `repeating-conic-gradient(from ${-turn * 0.7 + 5}deg at 50% 50%, rgb(${color} / 0) 0deg, rgb(${color} / 0.35) 3deg, rgb(${color} / 0) 7deg, rgb(${color} / 0) 21deg)`,
        }}
      />
    </div>
  )
}

/** A hand-held jolt after a hit: seeded per frame, decaying over `duration`. */
export function shake(local: number, at: number, duration: number, amplitude: number, seed = 1) {
  const p = (local - at) / duration
  if (p < 0 || p >= 1) return { x: 0, y: 0 }
  const [a, b] = randoms(seed * 104729 + frameOf(local), 2) as [number, number]
  const decay = (1 - p) ** 2
  return { x: (a * 2 - 1) * amplitude * decay, y: (b * 2 - 1) * amplitude * decay }
}

/** A beat's swell: up in 70 ms, back down over ~430 ms. */
export function pulseAt(local: number, at: number): number {
  if (local < at) return 0
  const up = clamp((local - at) / 70)
  const down = 1 - ease.outCubic(clamp((local - at - 70) / 430))
  return ease.outCubic(up) * down
}

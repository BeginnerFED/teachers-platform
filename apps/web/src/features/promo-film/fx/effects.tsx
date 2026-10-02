'use client'

import type { CSSProperties, ReactNode } from 'react'
import {
  BRAND,
  clamp,
  ease,
  HEIGHT,
  interpolate,
  mix,
  progress,
  randoms,
  useShot,
  WIDTH,
} from '../time'

/**
 * A burst of particles from a point, each with its own seeded direction, speed, size and
 * life. Positions are solved from time (no simulation), so any frame can be drawn alone.
 */
export function Burst({
  at,
  x,
  y,
  count = 36,
  seed = 1,
  colors = [BRAND, '#ffb58a', '#ffffff'],
  speed = [260, 900],
  size = [4, 12],
  life = [700, 1400],
  gravity = 380,
  spread = 360,
  direction = -90,
  shape = 'dot',
}: {
  at: number
  x: number
  y: number
  count?: number
  seed?: number
  colors?: string[]
  speed?: [number, number]
  size?: [number, number]
  life?: [number, number]
  gravity?: number
  /** Degrees of the cone the particles fly in; 360 for all around. */
  spread?: number
  /** Centre of the cone, degrees, 0 = right, -90 = up. */
  direction?: number
  shape?: 'dot' | 'spark' | 'square'
}) {
  const { local } = useShot()
  const elapsed = local - at
  if (elapsed < 0 || elapsed > life[1] + 50) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ overflow: 'visible' }}
    >
      {Array.from({ length: count }, (_, index) => {
        const [r1, r2, r3, r4, r5] = randoms(seed * 1000 + index, 5) as [
          number,
          number,
          number,
          number,
          number,
        ]
        const lifetime = mix(life[0], life[1], r4)
        if (elapsed > lifetime) return null

        const angle = ((direction + (r1 - 0.5) * spread) * Math.PI) / 180
        const velocity = mix(speed[0], speed[1], r2)
        const seconds = elapsed / 1000
        const drag = 1 - Math.exp(-2.2 * seconds)
        const px = x + Math.cos(angle) * velocity * (drag / 2.2)
        const py = y + Math.sin(angle) * velocity * (drag / 2.2) + 0.5 * gravity * seconds * seconds
        const fade = 1 - ease.inCubic(clamp(elapsed / lifetime))
        const s = mix(size[0], size[1], r3)
        const color = colors[Math.floor(r5 * colors.length)] ?? BRAND
        const heading =
          (Math.atan2(Math.sin(angle) * velocity + gravity * seconds, Math.cos(angle) * velocity) *
            180) /
          Math.PI

        return (
          <span
            key={index}
            style={{
              position: 'absolute',
              left: px - s / 2,
              top: py - s / 2,
              width: shape === 'spark' ? s * 3.2 : s,
              height: s,
              background: color,
              borderRadius: shape === 'square' ? 2 : 999,
              opacity: fade,
              transform: shape === 'spark' ? `rotate(${heading}deg)` : undefined,
              boxShadow: `0 0 ${s * 1.6}px ${color}`,
            }}
          />
        )
      })}
    </div>
  )
}

/** Slow motes of light drifting upward: atmosphere, never the subject. */
export function Dust({
  count = 26,
  seed = 7,
  opacity = 0.5,
}: {
  count?: number
  seed?: number
  opacity?: number
}) {
  const { local } = useShot()
  const t = local / 1000

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: count }, (_, index) => {
        const [r1, r2, r3, r4] = randoms(seed * 777 + index, 4) as [number, number, number, number]
        const speed = mix(14, 46, r3)
        const px = r1 * WIDTH + Math.sin(t * mix(0.3, 0.8, r4) + index) * 18
        const py = (((r2 * HEIGHT - t * speed) % HEIGHT) + HEIGHT) % HEIGHT
        const s = mix(1.5, 4, r4)
        return (
          <span
            key={index}
            style={{
              position: 'absolute',
              left: px,
              top: py,
              width: s,
              height: s,
              borderRadius: 999,
              background: '#ffd9c4',
              opacity: opacity * mix(0.25, 1, r3) * (0.6 + 0.4 * Math.sin(t * 2 + index)),
              boxShadow: '0 0 6px #ffb58a',
            }}
          />
        )
      })}
    </div>
  )
}

/** A full-frame flash: up fast, down slower. */
export function Flash({
  at,
  rise = 60,
  fall = 420,
  color = '#ffffff',
  peak = 1,
}: {
  at: number
  rise?: number
  fall?: number
  color?: string
  peak?: number
}) {
  const { local } = useShot()
  const amount =
    local < at
      ? 0
      : local < at + rise
        ? progress(local, at, rise, ease.outCubic)
        : 1 - progress(local, at + rise, fall, ease.outCubic)
  if (amount <= 0.001) return null
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ background: color, opacity: amount * peak }}
    />
  )
}

/**
 * Reveals its children through a growing circle, from (x, y) — the transition that
 * follows a click. `progress` is 0–1.
 */
export function CircleReveal({
  x,
  y,
  amount,
  children,
  style,
}: {
  x: number
  y: number
  amount: number
  children: ReactNode
  style?: CSSProperties
}) {
  if (amount <= 0) return null
  const radius = Math.hypot(Math.max(x, WIDTH - x), Math.max(y, HEIGHT - y)) * amount
  return (
    <div
      className="absolute inset-0"
      style={{ clipPath: `circle(${radius}px at ${x}px ${y}px)`, ...style }}
    >
      {children}
    </div>
  )
}

/**
 * The look of a whip pan: offset by `shift` px with a horizontal smear. Use for the last
 * frames of a shot leaving and the first of the next arriving.
 */
export function whip(shift: number, axis: 'x' | 'y' = 'x'): CSSProperties {
  const speed = Math.abs(shift)
  const smear = clamp(speed / 30, 0, 26)
  return {
    transform: axis === 'x' ? `translateX(${shift}px)` : `translateY(${shift}px)`,
    filter: smear > 0.3 ? `blur(${smear}px)` : undefined,
  }
}

/** A ring that expands and fades: a click, a ping, a beat. */
export function Ring({
  at,
  x,
  y,
  from = 10,
  to = 120,
  duration = 600,
  color = BRAND,
  width = 3,
}: {
  at: number
  x: number
  y: number
  from?: number
  to?: number
  duration?: number
  color?: string
  width?: number
}) {
  const { local } = useShot()
  const p = progress(local, at, duration, ease.outCubic)
  if (local < at || p >= 1) return null
  const r = mix(from, to, p)
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        border: `${width}px solid ${color}`,
        opacity: interpolate(p, [0, 0.15, 1], [0, 1, 0]),
      }}
    />
  )
}

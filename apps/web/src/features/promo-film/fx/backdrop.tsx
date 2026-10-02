'use client'

import type { CSSProperties } from 'react'
import { BRAND, frameOf, HEIGHT, INK, randoms, useFilmTime, WIDTH } from '../time'

/**
 * The film's ground: warm near-black, two slow glows of the brand colour drifting across
 * it, and a vignette. Everything else sits on this.
 */
export function Backdrop({ intensity = 1, style }: { intensity?: number; style?: CSSProperties }) {
  const t = useFilmTime() / 1000

  const ax = 30 + Math.sin(t * 0.35) * 18
  const ay = 22 + Math.cos(t * 0.27) * 12
  const bx = 72 + Math.cos(t * 0.31) * 16
  const by = 78 + Math.sin(t * 0.23) * 10

  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        background: [
          `radial-gradient(60% 45% at ${ax}% ${ay}%, rgb(255 79 1 / ${0.22 * intensity}), transparent 70%)`,
          `radial-gradient(55% 40% at ${bx}% ${by}%, rgb(255 140 60 / ${0.12 * intensity}), transparent 70%)`,
          `radial-gradient(120% 90% at 50% 50%, transparent 55%, rgb(0 0 0 / 0.55) 100%)`,
          INK,
        ].join(', '),
        ...style,
      }}
    />
  )
}

const NOISE = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`,
)

/** Film grain that changes every frame, so the picture breathes instead of sitting flat. */
export function Grain({ opacity = 0.06 }: { opacity?: number }) {
  const frame = frameOf(useFilmTime())
  const [x, y] = randoms(frame * 7919 + 13, 2)

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 mix-blend-overlay"
      style={{
        opacity,
        backgroundImage: `url("data:image/svg+xml,${NOISE}")`,
        backgroundPosition: `${Math.round(x! * 240)}px ${Math.round(y! * 240)}px`,
      }}
    />
  )
}

/** A soft light: a blurred disc of colour. */
export function Glow({
  x,
  y,
  size,
  color = BRAND,
  opacity = 0.5,
}: {
  x: number
  y: number
  size: number
  color?: string
  opacity?: number
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute rounded-full"
      style={{
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        opacity,
        background: `radial-gradient(circle, ${color} 0%, transparent 68%)`,
      }}
    />
  )
}

/** The full frame, for layers that cover everything. */
export const FULL: CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  width: WIDTH,
  height: HEIGHT,
}

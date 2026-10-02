'use client'

import { MousePointer2Icon } from 'lucide-react'
import { ease, interpolate, progress, useShot } from '../time'

export type PointerKey = { at: number; x: number; y: number }

/**
 * A pointer that travels through keyframes (shot-local ms, frame px) on the house curve,
 * and presses at the given moments with a ring. Hidden before its first key and after
 * `hideAt`.
 */
export function FilmPointer({
  keys,
  clicks = [],
  hideAt,
  size = 34,
  color = 'white',
}: {
  keys: readonly PointerKey[]
  clicks?: readonly number[]
  hideAt?: number
  size?: number
  color?: string
}) {
  const { local } = useShot()
  const first = keys[0]
  if (!first || local < first.at - 200) return null

  const times = keys.map((key) => key.at)
  const x = interpolate(
    local,
    times,
    keys.map((key) => key.x),
    ease.inOutCubic,
  )
  const y = interpolate(
    local,
    times,
    keys.map((key) => key.y),
    ease.inOutCubic,
  )

  const appear = progress(local, first.at - 200, 200, ease.outCubic)
  const vanish = hideAt === undefined ? 0 : progress(local, hideAt, 220, ease.inCubic)
  const opacity = appear * (1 - vanish)
  if (opacity <= 0.001) return null

  const press = clicks.reduce((depth, at) => {
    const p = local - at
    return p >= 0 && p < 200 ? Math.max(depth, Math.sin((p / 200) * Math.PI)) : depth
  }, 0)

  return (
    <>
      {clicks.map((at) => {
        const p = progress(local, at, 520, ease.outCubic)
        if (local < at || p >= 1) return null
        const r = 10 + p * 46
        return (
          <span
            key={at}
            aria-hidden
            style={{
              position: 'absolute',
              left:
                interpolate(
                  at,
                  times,
                  keys.map((key) => key.x),
                  ease.inOutCubic,
                ) - r,
              top:
                interpolate(
                  at,
                  times,
                  keys.map((key) => key.y),
                  ease.inOutCubic,
                ) - r,
              width: r * 2,
              height: r * 2,
              borderRadius: '50%',
              border: '3px solid rgb(255 255 255 / 0.9)',
              opacity: 1 - p,
              boxShadow: '0 0 18px rgb(255 120 40 / 0.6)',
            }}
          />
        )
      })}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: x - size * 0.16,
          top: y - size * 0.12,
          opacity,
          transform: `scale(${1 - press * 0.14})`,
          transformOrigin: '16% 12%',
          filter: 'drop-shadow(0 6px 14px rgb(0 0 0 / 0.45))',
        }}
      >
        <MousePointer2Icon
          style={{ width: size, height: size, color: '#111', fill: color }}
          strokeWidth={1.4}
        />
      </div>
    </>
  )
}

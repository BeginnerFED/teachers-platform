'use client'

import { useLayoutEffect, useMemo, useState, type CSSProperties } from 'react'
import type { PromoCopy } from '@/features/login-promo/copy'
import { createClock, SceneContext } from '@/features/login-promo/engine/clock'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/features/login-promo/engine/motion'
import { SCENE_VIEWS } from '@/features/login-promo/scenes'
import { TIMELINE, type SceneId } from '@/features/login-promo/timeline'

/**
 * A product screen from the sign-in tour, filmed: the scene's fragment (no caption), drawn
 * at the tour's own 520×720 logical size, with its clock standing at `ms`.
 *
 * The film decides what moment of the scene to show — it can hold, speed up or replay it —
 * by mapping its own time onto `ms`. Place, scale and turn it from outside with a Layer.
 *
 * The fragment sits 40px in from the top-left of the 520×720 box (the tour's column). Use
 * `crop` to show only part of it.
 */
export function Replica({
  scene,
  ms,
  copy,
  crop,
  style,
}: {
  scene: Exclude<SceneId, 'intro'>
  ms: number
  copy: PromoCopy
  /** A window onto the 520×720 box, in its logical px. */
  crop?: { x: number; y: number; width: number; height: number }
  style?: CSSProperties
}) {
  const [clock] = useState(() => createClock(TIMELINE[scene].duration, Math.max(0, ms)))
  const context = useMemo(() => ({ clock, mode: 'play' as const, bare: true }), [clock])

  // Before paint, so the frame drawn is the frame asked for.
  useLayoutEffect(() => {
    clock.set(Math.max(0, ms))
  }, [clock, ms])

  const box = crop ?? { x: 0, y: 0, width: STAGE_WIDTH, height: STAGE_HEIGHT }

  return (
    <div
      style={{
        position: 'relative',
        width: box.width,
        height: box.height,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        data-promo-stage
        className="text-foreground"
        style={{
          position: 'absolute',
          left: -box.x,
          top: -box.y,
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
        }}
      >
        <SceneContext.Provider value={context}>{SCENE_VIEWS[scene](copy)}</SceneContext.Provider>
      </div>
    </div>
  )
}

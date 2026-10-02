'use client'

import { MousePointer2Icon } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useScene } from './clock'
import { EASE, stageCenter, type StagePoint } from './motion'

/**
 * One thing a pointer does at a moment of the scene.
 *
 * `to` names an element inside the scene by its `data-anchor` attribute, measured when
 * the move starts — so a path follows the copy wherever it wraps, in any language — or
 * gives a point on the stage.
 */
export type PointerStep =
  | { at: number; appear: StagePoint }
  | { at: number; to: string | StagePoint; duration?: number }
  | { at: number; press: true }
  | { at: number; leave: true }

/** Where the arrow's tip sits inside its box, so the tip — not the corner — lands on a target. */
const TIP = { teacher: { x: 3, y: 2 }, remote: { x: 3, y: 3 } }

function resolve(target: string | StagePoint, scene: Element | null): StagePoint | null {
  if (typeof target !== 'string') return target

  const anchor = scene?.querySelector(`[data-anchor="${target}"]`)
  return anchor ? stageCenter(anchor) : null
}

function place(point: StagePoint, tip: StagePoint): string {
  return `${point.x - tip.x}px ${point.y - tip.y}px`
}

/**
 * A pointer that performs a scripted path on the scene's clock.
 *
 * The moves are Web Animations started from the clock rather than React state, so a
 * moving arrow never re-renders the scene, and the player's pause freezes them along
 * with everything else on the stage. In a still frame nothing is scripted: the arrow
 * either stays away or, given `still`, rests where the scene's last moment leaves it.
 */
export function PromoPointer({
  script,
  remote,
  still,
}: {
  script: readonly PointerStep[]
  /** Somebody else in a live room: their colour, their name, the product's own arrow. */
  remote?: { color: string; name: string }
  /** Where the arrow rests in the still frame; without it the still frame has no arrow. */
  still?: string | StagePoint
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { clock, mode } = useScene()
  const tip = remote ? TIP.remote : TIP.teacher

  // Compared by content: a script written inline in a scene is a new array on every
  // render, and restarting the path each time a cue re-renders the scene would replay it.
  const scriptKey = JSON.stringify(script)
  const stillKey = JSON.stringify(still ?? null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    const scene = element.closest('[data-promo-scene]')

    if (mode === 'still') {
      const rest = JSON.parse(stillKey) as string | StagePoint | null
      const point = rest ? resolve(rest, scene) : null
      element.style.translate = point ? place(point, tip) : ''
      element.style.opacity = point ? '1' : '0'
      return
    }

    const steps = (JSON.parse(scriptKey) as PointerStep[]).sort((a, b) => a.at - b.at)
    const started: Animation[] = []
    let next = 0
    let position: StagePoint | null = null

    const perform = (step: PointerStep) => {
      if ('appear' in step) {
        position = step.appear
        started.push(
          element.animate(
            [
              { translate: place(position, tip), opacity: 0 },
              { translate: place(position, tip), opacity: 1 },
            ],
            { duration: 200, easing: EASE, fill: 'forwards' },
          ),
        )
      } else if ('to' in step) {
        const target = resolve(step.to, scene)
        if (!target) return

        const from = position ?? target
        position = target
        started.push(
          element.animate([{ translate: place(from, tip) }, { translate: place(target, tip) }], {
            duration: step.duration ?? 500,
            easing: EASE,
            fill: 'forwards',
          }),
        )
      } else if ('press' in step) {
        started.push(
          element.animate([{ scale: 1 }, { scale: 0.92 }, { scale: 1 }], {
            duration: 180,
            easing: EASE,
          }),
        )
      } else if (position) {
        const away = { x: position.x + 12, y: position.y + 12 }
        started.push(
          element.animate(
            [
              { translate: place(position, tip), opacity: 1 },
              { translate: place(away, tip), opacity: 0 },
            ],
            { duration: 220, easing: EASE, fill: 'forwards' },
          ),
        )
      }
    }

    const run = () => {
      const time = clock.time()
      while (next < steps.length && time >= steps[next]!.at) perform(steps[next++]!)
    }

    run()
    const unsubscribe = clock.subscribe(run)

    return () => {
      unsubscribe()
      for (const animation of started) animation.cancel()
    }
  }, [clock, mode, scriptKey, stillKey, tip])

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-30 opacity-0 will-change-[translate,opacity]"
    >
      {remote ? (
        <>
          <MousePointer2Icon
            className="size-4 -rotate-12 drop-shadow-sm"
            style={{ color: remote.color, fill: remote.color }}
          />
          <span
            className="ml-3 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium text-white shadow-sm"
            style={{ backgroundColor: remote.color }}
          >
            {remote.name}
          </span>
        </>
      ) : (
        <MousePointer2Icon
          className={cn('size-5 drop-shadow-sm', 'fill-foreground text-background')}
          strokeWidth={1.5}
        />
      )}
    </div>
  )
}

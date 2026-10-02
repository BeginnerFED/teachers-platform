'use client'

import { createContext, useContext, useSyncExternalStore } from 'react'
import { easeOut } from './motion'

/**
 * Scene time, in milliseconds since the scene began.
 *
 * The player owns it and moves it once per animation frame while the tour plays. Between
 * frames the value is frozen, so every component reading it during one render sees the
 * same moment — the guarantee `useSyncExternalStore` asks of a snapshot.
 */
export type SceneClock = {
  readonly duration: number
  time(): number
  set(next: number): void
  subscribe(listener: () => void): () => void
}

export function createClock(duration: number, start = 0): SceneClock {
  let time = start
  const listeners = new Set<() => void>()

  return {
    duration,
    time: () => time,
    set(next) {
      if (next === time) return
      time = next
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/**
 * `play` runs the scene's choreography; `still` draws its finished frame and nothing
 * moves — what reduced motion, a paused chapter jump and the settled poster show.
 */
export type SceneMode = 'play' | 'still'

/**
 * `bare` draws only the product fragment, without the caption — how the promo film embeds
 * a scene as footage.
 */
export type SceneContextValue = { clock: SceneClock; mode: SceneMode; bare?: boolean }

export const SceneContext = createContext<SceneContextValue | null>(null)

export function useScene(): SceneContextValue {
  const scene = useContext(SceneContext)
  if (!scene) throw new Error('Promo scene hooks only work inside a playing scene.')

  return scene
}

/**
 * A value derived from scene time. The component re-renders only when the derived value
 * changes, so a cue that flips once costs one render, not sixty a second.
 */
function useClockValue<T extends number | boolean | string>(read: (time: number) => T): T {
  const { clock } = useScene()
  const snapshot = () => read(clock.time())

  return useSyncExternalStore(clock.subscribe, snapshot, snapshot)
}

/** True from `ms` on. */
export function useAt(ms: number): boolean {
  return useClockValue((time) => time >= ms)
}

/** How many of these moments have passed: 0 before the first, `times.length` after the last. */
export function useCue(times: readonly number[]): number {
  return useClockValue((time) => {
    let passed = 0
    for (const at of times) if (time >= at) passed++
    return passed
  })
}

/** The part of `text` typed so far: one character every `stepMs`, starting at `at`. */
export function useTyped(text: string, at: number, stepMs = 38): string {
  const count = useClockValue((time) =>
    time < at ? 0 : Math.min(text.length, Math.floor((time - at) / stepMs) + 1),
  )

  return text.slice(0, count)
}

/** A number counting from 0 up to `target` over `durationMs`, starting at `at`. */
export function useCount(target: number, at: number, durationMs = 480): number {
  return useClockValue((time) => Math.round(target * easeOut((time - at) / durationMs)))
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { BlockDraft, MaterialStep } from '@tp/shared'
import { saveStep } from '../actions'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed' | 'conflict'

type Payload = { title: string | null; blocks: BlockDraft[] }

const DEBOUNCE_MS = 800

/**
 * Saves a step a short while after it stops changing, one request at a time per step.
 *
 * Three things this has to get right. Edits that arrive while a save is in flight are not
 * lost and not sent twice: they are queued, and the queue is drained once the current save
 * returns. Every save carries the `updatedAt` the previous one came back with, which is
 * the optimistic lock — a stale one means another tab saved first, and the honest response
 * is to stop, say so, and not overwrite their work. And nothing waiting is ever thrown
 * away: leaving the page sends what is queued rather than cancelling it, which is the
 * difference between "I clicked preview" and "I lost the last thing I typed".
 */
export function useStepAutosave(materialId: string, steps: MaterialStep[]) {
  const [status, setStatus] = useState<Record<string, SaveStatus>>({})

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const inflight = useRef<Record<string, Promise<void> | undefined>>({})
  const queued = useRef<Record<string, Payload | undefined>>({})
  const locks = useRef<Record<string, string>>({})

  // Seed the locks from what the page loaded with. A step added later registers its own.
  useEffect(() => {
    for (const step of steps) {
      if (!locks.current[step.id]) locks.current[step.id] = step.updatedAt
    }
  }, [steps])

  const mark = useCallback((stepId: string, next: SaveStatus) => {
    setStatus((current) => ({ ...current, [stepId]: next }))
  }, [])

  // A loop rather than a function that calls itself: it drains whatever was queued
  // while each save was out, and there is no self-reference for a memoised callback
  // to trip over. The promise is kept so that a second caller — a flush before leaving
  // the page — can wait on the save already running instead of starting another.
  const flush = useCallback(
    (stepId: string): Promise<void> => {
      const running = inflight.current[stepId]
      if (running) return running
      if (!queued.current[stepId]) return Promise.resolve()

      clearTimeout(timers.current[stepId])

      const job = (async () => {
        try {
          for (;;) {
            const payload = queued.current[stepId]
            if (!payload) return

            queued.current[stepId] = undefined
            mark(stepId, 'saving')

            const lock = locks.current[stepId]
            const { step, error } = await saveStep(materialId, stepId, {
              title: payload.title,
              blocks: payload.blocks,
              ...(lock ? { expectedUpdatedAt: lock } : {}),
            })

            if (error === 'conflict') {
              // Somebody else won. Nothing further is sent for this step: every later save
              // would carry the same stale lock and lose the same way.
              queued.current[stepId] = undefined
              mark(stepId, 'conflict')
              return
            }

            if (error || !step) {
              mark(stepId, 'failed')
              return
            }

            locks.current[stepId] = step.updatedAt
            mark(stepId, 'saved')
          }
        } finally {
          inflight.current[stepId] = undefined
        }
      })()

      inflight.current[stepId] = job

      return job
    },
    [materialId, mark],
  )

  const schedule = useCallback(
    (stepId: string, payload: Payload) => {
      if (status[stepId] === 'conflict') return

      queued.current[stepId] = payload
      clearTimeout(timers.current[stepId])
      timers.current[stepId] = setTimeout(() => void flush(stepId), DEBOUNCE_MS)
    },
    [flush, status],
  )

  /** Everything queued or in flight, sent now and waited for. */
  const flushAll = useCallback(() => {
    const ids = new Set([...Object.keys(queued.current), ...Object.keys(inflight.current)])

    return Promise.all([...ids].map((stepId) => flush(stepId))).then(() => undefined)
  }, [flush])

  /**
   * The lock the server currently holds for a step. Called for a step created during the
   * session, and again whenever fresh steps are fetched — a page restored from the
   * browser's cache carries the locks it had when it was last shown, not the ones the
   * server has now.
   */
  const register = useCallback((step: MaterialStep) => {
    locks.current[step.id] = step.updatedAt
  }, [])

  const forget = useCallback((stepId: string) => {
    clearTimeout(timers.current[stepId])
    queued.current[stepId] = undefined
    delete locks.current[stepId]
  }, [])

  // Leaving the page sends what is waiting rather than dropping it. The component is
  // gone by the time the response comes back, which is fine: the request is what matters.
  useEffect(
    () => () => {
      void flushAll()
    },
    [flushAll],
  )

  return { status, schedule, register, forget, flushAll }
}

'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { MaterialStep } from '@tp/shared'
import { saveStep } from '../actions'
import { StepDrafts, type StepPayload } from './step-drafts'
export type { SaveStatus } from './step-drafts'

export function useStepAutosave(materialId: string, accountId: string) {
  const [drafts] = useState(
    () =>
      new StepDrafts(`lesson-draft:v1:${accountId}:${materialId}`, (id, payload) =>
        saveStep(materialId, id, payload),
      ),
  )
  const status = useSyncExternalStore(drafts.subscribe, drafts.getSnapshot, drafts.getSnapshot)
  const register = useCallback((step: MaterialStep) => drafts.register(step), [drafts])
  const schedule = useCallback(
    (id: string, payload: StepPayload) => drafts.queue(id, payload),
    [drafts],
  )
  const forget = useCallback((id: string) => drafts.forget(id), [drafts])
  useEffect(() => {
    const flush = () => {
      void drafts.flushAll().catch(() => undefined)
    }
    const leaving = (event: BeforeUnloadEvent) => {
      if (drafts.hasPending()) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('online', flush)
    window.addEventListener('focus', flush)
    window.addEventListener('beforeunload', leaving)
    return () => {
      window.removeEventListener('online', flush)
      window.removeEventListener('focus', flush)
      window.removeEventListener('beforeunload', leaving)
      flush()
    }
  }, [drafts])
  return { status, drafts, flushAll: drafts.flushAll, register, schedule, forget }
}

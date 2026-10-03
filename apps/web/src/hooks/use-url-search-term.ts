'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

type LocalSearch = { term: string; revision: number }

/**
 * Keeps a debounced search field in step with the URL without letting an older route
 * response erase characters typed after that request left. Only one local navigation is
 * sent at a time; while it is travelling, the newest search replaces the queued one.
 */
export function useUrlSearchTerm(
  urlTerm: string,
  onSubmit: (term: string) => void,
  delayMs: number,
) {
  const [term, setTermState] = useState(urlTerm)
  const termRef = useRef(urlTerm)
  const lastUrlTerm = useRef(urlTerm)
  const revision = useRef(0)
  const submittedRevision = useRef<number | null>(null)
  const inFlight = useRef<LocalSearch | null>(null)
  const queued = useRef<LocalSearch | null>(null)
  const submitRef = useRef(onSubmit)

  // Synced once React has committed rather than during render, where a write could run
  // ahead of a render React then throws away. Layout timing, so it is current before any
  // timer or click below can reach it.
  useLayoutEffect(() => {
    submitRef.current = onSubmit
  })

  const send = useCallback((request: LocalSearch) => {
    // No route change will acknowledge an already-current URL.
    if (request.term === lastUrlTerm.current) return
    inFlight.current = request
    submitRef.current(request.term)
  }, [])

  const submit = useCallback(
    (request: LocalSearch) => {
      if (submittedRevision.current === request.revision) return
      submittedRevision.current = request.revision

      if (inFlight.current) {
        queued.current = request
        return
      }

      send(request)
    },
    [send],
  )

  const setTerm = useCallback((next: string) => {
    if (next === termRef.current) return
    revision.current += 1
    submittedRevision.current = null
    termRef.current = next
    setTermState(next)
  }, [])

  const submitNow = useCallback(
    (next: string) => {
      if (next !== termRef.current) {
        revision.current += 1
        submittedRevision.current = null
        termRef.current = next
        setTermState(next)
      }
      submit({ term: next, revision: revision.current })
    },
    [submit],
  )

  useEffect(() => {
    if (urlTerm === lastUrlTerm.current) return
    lastUrlTerm.current = urlTerm

    const acknowledged = inFlight.current
    if (acknowledged?.term === urlTerm) {
      inFlight.current = null

      // Keep newer typing on screen while this older request is being acknowledged.
      if (acknowledged.revision === revision.current) {
        termRef.current = urlTerm
        setTermState(urlTerm)
      }

      const next = queued.current
      queued.current = null
      if (next && next.revision === revision.current) send(next)
      return
    }

    // Back/forward, a global-search result or another control changed the URL.
    inFlight.current = null
    queued.current = null
    revision.current += 1
    submittedRevision.current = null
    termRef.current = urlTerm
    setTermState(urlTerm)
  }, [urlTerm, send])

  // Runs again on urlTerm as well as on typing, and that is the safety net: after every
  // acknowledgement the box is weighed against the URL as it now stands, so whatever is in
  // it by then still goes out — even when it matched a queued request that the
  // acknowledgement has since dropped ("ab" queued, "abc" typed, back to "ab").
  useEffect(() => {
    // A render from before the URL effect above put the URL's term back in the box. The
    // render that shows it is on its way, and this would only queue the old term.
    if (term !== termRef.current || submittedRevision.current === revision.current) return

    // Measured against where the URL is headed, not where it is. Clearing the box while
    // "zzq" travels lands back on the URL's current term, and compared with that it looked
    // like nothing new — so nothing was queued, and "zzq" won once it arrived.
    const target = queued.current?.term ?? inFlight.current?.term ?? lastUrlTerm.current
    if (term === target) return

    const request = { term, revision: revision.current }
    const timer = setTimeout(() => submit(request), delayMs)
    return () => clearTimeout(timer)
  }, [term, urlTerm, delayMs, submit])

  return { term, setTerm, submitNow }
}

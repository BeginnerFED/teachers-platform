'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyBoardOps,
  type BoardOp,
  type LiveBoard,
  type LiveBoardEvent,
  type LiveHint,
  type LiveSessionStatus,
  type LiveSnapshot,
  type LiveStateEvent,
  type StepCheckResult,
} from '@tp/shared'
import { applyLiveOps, checkLiveStep, fetchLiveSnapshot } from './actions'

/**
 * What this browser knows about the room. `server` is the board as the API last described
 * it, at `version`; `pending` are the batches this browser has sent and not yet heard back
 * about; `draft` is what it is about to send. What is drawn is all three laid on top of
 * each other, so this browser's gesture shows immediately and stays until the server
 * confirms it.
 *
 * `version` moves only on what the API itself answered — a snapshot, or the reply to this
 * browser's own batch. Announcements and peer hints on the public channel only prompt a
 * fresh API read; a peer's claimed identity and board change cannot be verified there.
 */
type Model = {
  version: number
  server: LiveBoard
  pending: BoardOp[][]
  draft: BoardOp[]
  currentStepId: string | null
  status: LiveSessionStatus
  /** API clock minus this browser's clock, sampled at the midpoint of a snapshot request. */
  serverTimeOffsetMs: number
  /**
   * What this browser has asked the API for and not yet been told back — the host's next
   * step, the end. Laid over whatever the API says until the API says it too, so a reply
   * that set off before the request cannot pull the page back.
   */
  assumed: Partial<Pick<Model, 'currentStepId' | 'status'>>
}

type Assumable = Model['assumed']

/** A batch is one gesture; typing is many, so it waits this long for the next keystroke. */
const DRAFT_DEBOUNCE_MS = 250
/** After an announcement, a moment for the ones behind it to arrive before one re-read. */
const CONFIRM_GRACE_MS = 200
/** A public channel cannot amplify forged invalidations into an unbounded read loop. */
const CONFIRM_MIN_INTERVAL_MS = 2_000
/** A quiet re-read, in case an announcement was lost and nothing has happened since. */
const POLL_MS = 10_000
/** The API takes at most this many changes in one batch. */
const BATCH_MAX = 50

const fromSnapshot = (
  snapshot: LiveSnapshot,
  rest: Pick<Model, 'pending' | 'draft' | 'assumed'>,
  measuredAt: number,
): Model => ({
  version: snapshot.version,
  server: snapshot.board,
  currentStepId: snapshot.currentStepId,
  status: snapshot.status,
  serverTimeOffsetMs: snapshot.serverTime - measuredAt,
  ...rest,
  // The API has caught up with what was assumed: nothing left to assume.
  assumed: Object.fromEntries(
    Object.entries(rest.assumed).filter(
      ([key, value]) => snapshot[key as keyof Assumable] !== value,
    ),
  ),
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * The ops that take a block from one value to another. For a value that is a map — a gap
 * per id, a card's state by key — one op per key that changed, so two people working on
 * different parts of the same block do not write over each other. Anything else is one
 * value, set whole.
 */
function opsBetween(path: string[], previous: unknown, next: unknown): BoardOp[] {
  if (!isRecord(next)) return [{ t: 'set', path, value: next }]

  // A first answer to a block is still one key of it, not the whole block: two people
  // answering different parts at the same moment must both land.
  const was = isRecord(previous) ? previous : {}
  const ops: BoardOp[] = []
  for (const key of Object.keys(next)) {
    if (!(key in was) || JSON.stringify(was[key]) !== JSON.stringify(next[key])) {
      ops.push({ t: 'set', path: [...path, key], value: next[key] })
    }
  }
  for (const key of Object.keys(was)) {
    if (!(key in next)) ops.push({ t: 'unset', path: [...path, key] })
  }
  // A block emptied: say so once, whole, rather than key by key.
  if (Object.keys(next).length === 0 && !isRecord(previous) && previous !== undefined) {
    return [{ t: 'set', path, value: next }]
  }

  return ops
}

/** Later changes to a path replace earlier ones, so a word typed is one change, not nine. */
function coalesce(ops: BoardOp[]): BoardOp[] {
  const byPath = new Map<string, BoardOp>()
  for (const op of ops) byPath.set(JSON.stringify(op.path), op)

  return [...byPath.values()]
}

/**
 * The shared board, kept in step with the server. Public announcements only prompt a
 * bounded API read; the API's authenticated answer is what gets drawn. This browser's
 * own changes are drawn at once and sent to the API, so local gestures feel direct;
 * remote browsers take the authenticated snapshot that follows.
 */
export function useLiveBoard(
  sessionId: string,
  initial: LiveSnapshot,
  from: string,
  {
    onError,
    onOps,
  }: {
    onError: (code: string) => void
    /** This browser is about to write these: a chance to tell the others first. */
    onOps: (ops: BoardOp[]) => void
  },
) {
  const [model, setModel] = useState<Model>(() =>
    fromSnapshot(initial, { pending: [], draft: [], assumed: {} }, Date.now()),
  )
  // The truth as the handlers see it, kept in step by hand: two announcements in the same
  // tick must see each other, and a render is too late for that.
  const truth = useRef(model)
  const commit = useCallback((next: Model) => {
    truth.current = next
    setModel(next)
  }, [])

  const errorRef = useRef(onError)
  const opsRef = useRef(onOps)
  useEffect(() => {
    errorRef.current = onError
    opsRef.current = onOps
  }, [onError, onOps])

  /* -------------------------------------------------------------------- resync --- */

  const syncing = useRef<Promise<void> | null>(null)
  const syncAgain = useRef(false)

  /** Asks the API for the whole room and takes it, unless what we have is already newer. */
  const resync = useCallback(async () => {
    if (syncing.current) {
      syncAgain.current = true
      return syncing.current
    }

    const run = (async () => {
      do {
        syncAgain.current = false
        const requestedAt = Date.now()
        // A read that never reached the server is a read that found nothing; the next
        // announcement, the poll or the next join asks again.
        const snapshot = await fetchLiveSnapshot(sessionId).catch(() => null)
        const receivedAt = Date.now()
        const current = truth.current

        if (snapshot && snapshot.version >= current.version) {
          commit(
            fromSnapshot(
              snapshot,
              {
                pending: current.pending,
                draft: current.draft,
                assumed: current.assumed,
              },
              requestedAt + (receivedAt - requestedAt) / 2,
            ),
          )
        }
      } while (syncAgain.current)
    })().finally(() => {
      syncing.current = null
    })

    syncing.current = run
    return run
  }, [sessionId, commit])

  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const urgentConfirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastConfirmationAt = useRef(0)
  const lastUrgentConfirmationAt = useRef(0)
  const confirmSoon = useCallback(
    (targetVersion?: number) => {
      const now = Date.now()
      const sinceLast = now - lastConfirmationAt.current
      // A typing hint can arrive just before its debounced write and consume the ordinary
      // read. If the later API announcement names a version we still do not have, allow one
      // bounded trailing read instead of leaving the class two seconds behind.
      const urgent =
        targetVersion !== undefined &&
        targetVersion > truth.current.version &&
        sinceLast < CONFIRM_MIN_INTERVAL_MS &&
        now - lastUrgentConfirmationAt.current >= CONFIRM_MIN_INTERVAL_MS

      if (urgent) {
        if (urgentConfirmTimer.current) return
        urgentConfirmTimer.current = setTimeout(() => {
          urgentConfirmTimer.current = null
          if (confirmTimer.current) clearTimeout(confirmTimer.current)
          confirmTimer.current = null
          lastConfirmationAt.current = Date.now()
          lastUrgentConfirmationAt.current = lastConfirmationAt.current
          void resync()
        }, CONFIRM_GRACE_MS)
        return
      }

      if (confirmTimer.current || urgentConfirmTimer.current) return
      const delay = Math.max(CONFIRM_GRACE_MS, CONFIRM_MIN_INTERVAL_MS - sinceLast)
      confirmTimer.current = setTimeout(() => {
        confirmTimer.current = null
        lastConfirmationAt.current = Date.now()
        void resync()
      }, delay)
    },
    [resync],
  )

  /* ------------------------------------------------------------- announcements --- */

  const onBoard = useCallback(
    (event: LiveBoardEvent) => {
      const current = truth.current
      // Older than what the API has already told us: nothing to confirm.
      if (event.version <= current.version) return

      // A public-channel packet cannot prove that the API sent it. Treat it only as an
      // invalidation signal; timer, gather state and marks arrive from the fresh snapshot.
      confirmSoon(event.version)
    },
    [confirmSoon],
  )

  /** A peer hint is an untrusted invalidation, never a board change to draw. */
  const onHint = useCallback(
    (hint: LiveHint) => {
      if (truth.current.status !== 'active' || hint.ops.length === 0) return
      confirmSoon()
    },
    [confirmSoon],
  )

  const onState = useCallback(
    (event: LiveStateEvent) => {
      const current = truth.current
      if (event.version <= current.version) return

      // State announcements share the public channel. They wake a snapshot read but never
      // move or close the room by themselves.
      confirmSoon(event.version)
    },
    [confirmSoon],
  )

  /* ------------------------------------------------------------- own changes --- */

  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    if (draftTimer.current) clearTimeout(draftTimer.current)
    draftTimer.current = null

    const current = truth.current
    if (current.draft.length === 0) return

    // A room that has closed takes nothing more; a step that has been marked takes no
    // more answers. What was typed in the meantime is let go of quietly.
    const draft =
      current.status === 'active'
        ? current.draft.filter(
            (op) =>
              !(op.path[0] === 'answers' && op.path[1] && current.server.results?.[op.path[1]]),
          )
        : []
    if (draft.length === 0) {
      commit({ ...current, draft: [] })
      return
    }

    const batches: BoardOp[][] = []
    for (let i = 0; i < draft.length; i += BATCH_MAX) {
      batches.push(draft.slice(i, i + BATCH_MAX))
    }
    commit({ ...current, draft: [], pending: [...current.pending, ...batches] })

    for (const batch of batches) {
      void (async () => {
        // A request that never reached the server is a request that failed.
        const requestedAt = Date.now()
        const { snapshot, error } = await applyLiveOps(sessionId, batch, from).catch(() => ({
          snapshot: null,
          error: 'failed',
        }))
        const receivedAt = Date.now()
        const latest = truth.current
        const pending = latest.pending.filter((other) => other !== batch)

        if (error || !snapshot) {
          // What was drawn did not happen. Take it back, and take the server's word. A
          // room that closed, or a step that was marked, under this browser's feet is not
          // a failure worth a toast: the screen is about to say so itself.
          commit({ ...latest, pending })
          if (error !== 'not_found' && error !== 'conflict') errorRef.current(error ?? 'failed')
          void resync()
          return
        }

        commit(
          snapshot.version > latest.version
            ? fromSnapshot(
                snapshot,
                {
                  pending,
                  draft: latest.draft,
                  assumed: latest.assumed,
                },
                requestedAt + (receivedAt - requestedAt) / 2,
              )
            : { ...latest, pending },
        )
      })()
    }
  }, [sessionId, from, commit, resync])

  /**
   * Makes a change. It is on the screen before this returns; it is on its way to the
   * server at once, or — for typing — as soon as the typing pauses.
   */
  const change = useCallback(
    (ops: BoardOp[], { debounce = false } = {}) => {
      const current = truth.current
      if (current.status !== 'active') return

      commit({ ...current, draft: coalesce([...current.draft, ...ops]) })

      if (debounce) {
        if (draftTimer.current) clearTimeout(draftTimer.current)
        draftTimer.current = setTimeout(flush, DRAFT_DEBOUNCE_MS)
      } else {
        flush()
      }
    },
    [commit, flush],
  )

  /**
   * Sets a block's answer or state. What actually goes out is the difference from what is
   * on the screen now: for a map, the keys that changed, so that two people on different
   * parts of one block do not write over each other.
   */
  const setValue = useCallback(
    (
      root: 'answers' | 'ui',
      stepId: string,
      blockId: string,
      value: unknown,
      options: { debounce?: boolean } = {},
    ) => {
      const current = truth.current
      const view = applyBoardOps(current.server, [...current.pending.flat(), ...current.draft])
      const previous = view[root]?.[stepId]?.[blockId]
      const ops = opsBetween([root, stepId, blockId], previous, value)
      if (ops.length === 0) return

      // The others can start a bounded API refresh before its board announcement arrives.
      opsRef.current(ops)
      change(ops, options)
    },
    [change],
  )

  /**
   * Something this browser has asked the API for — the next step, the end. Shown now, and
   * kept shown over whatever the API says until the API says this too.
   */
  const assume = useCallback(
    (patch: Assumable) => {
      const current = truth.current
      commit({ ...current, assumed: { ...current.assumed, ...patch } })
    },
    [commit],
  )

  /**
   * The API has done what was assumed: it is now the truth, and no longer an assumption.
   * Unless a newer assumption has been made since — then this reply is about an older
   * request, and the newer one is still waiting for its own.
   */
  const confirm = useCallback(
    (patch: Assumable) => {
      const current = truth.current
      const assumed = { ...current.assumed }
      const settledNow: Assumable = {}
      for (const key of Object.keys(patch) as (keyof Assumable)[]) {
        if (assumed[key] !== undefined && assumed[key] !== patch[key]) continue
        delete assumed[key]
        Object.assign(settledNow, { [key]: patch[key] })
      }
      commit({ ...current, ...settledNow, assumed })
    },
    [commit],
  )

  /** The API refused what was assumed: forget it, and take the API's word. */
  const retract = useCallback(
    (keys: (keyof Assumable)[]) => {
      const current = truth.current
      const assumed = { ...current.assumed }
      for (const key of keys) delete assumed[key]
      commit({ ...current, assumed })
      void resync()
    },
    [commit, resync],
  )

  /**
   * Marks a step for the whole room. The API writes the answers and the marks to the
   * board and announces them; they are drawn here first so the tick appears with the
   * reply rather than a beat after it.
   */
  const check = useCallback(
    async (
      stepId: string,
      answers: Record<string, unknown>,
    ): Promise<{ result: StepCheckResult | null; error: string | null }> => {
      flush()
      const { result, error } = await checkLiveStep(sessionId, stepId, answers).catch(() => ({
        result: null,
        error: 'failed',
      }))
      if (error || !result) return { result: null, error }

      const current = truth.current
      if (!current.server.results?.[stepId]) {
        commit({
          ...current,
          server: applyBoardOps(current.server, [
            { t: 'set', path: ['answers', stepId], value: answers },
            { t: 'set', path: ['results', stepId], value: result },
          ]),
        })
      }

      return { result, error: null }
    },
    [sessionId, commit, flush],
  )

  /* --------------------------------------------------------------- housekeeping --- */

  // A tab that was asleep, and a room that has been quiet for a while, both re-read.
  useEffect(() => {
    if (model.status !== 'active') return

    const onVisible = () => {
      if (document.visibilityState === 'visible') void resync()
    }
    document.addEventListener('visibilitychange', onVisible)
    const poll = setInterval(() => void resync(), POLL_MS)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(poll)
    }
  }, [model.status, resync])

  useEffect(
    () => () => {
      if (draftTimer.current) clearTimeout(draftTimer.current)
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
      if (urgentConfirmTimer.current) clearTimeout(urgentConfirmTimer.current)
    },
    [],
  )

  const board = useMemo(
    () => applyBoardOps(model.server, [...model.pending.flat(), ...model.draft]),
    [model.server, model.pending, model.draft],
  )

  return {
    board,
    version: model.version,
    currentStepId: model.assumed.currentStepId ?? model.currentStepId,
    status: model.assumed.status ?? model.status,
    serverTimeOffsetMs: model.serverTimeOffsetMs,
    onBoard,
    onState,
    onHint,
    resync,
    change,
    setValue,
    assume,
    confirm,
    retract,
    check,
  }
}

export type LiveBoardHandle = ReturnType<typeof useLiveBoard>

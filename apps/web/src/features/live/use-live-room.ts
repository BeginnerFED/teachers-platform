'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import {
  LIVE_EVENTS,
  liveChannelFor,
  SELECTION_PARTS_MAX,
  type BoardOp,
  type LiveBoardEvent,
  type LiveCursor,
  type LiveFocus,
  type LiveHint,
  type LiveMedia,
  type LivePresence,
  type LiveSelection,
  type LiveStateEvent,
  type LiveStep,
  type LiveView,
} from '@tp/shared'
import { createClient } from '@/lib/supabase/client'

/** A pointer somebody else is holding over the lesson, and when it last moved. */
export type RemoteCursor = LiveCursor & { id: string; name: string; at: number }
/** Text somebody else has selected, and when. */
export type RemoteSelection = LiveSelection & { id: string; at: number }
/** Where somebody else's attention is, when it got there, and when they last typed. */
export type RemoteFocus = LiveFocus & { id: string; at: number; typingAt?: number }
/** Somebody in the room, and where they are. */
export type Person = LivePresence & {
  /** Whom they follow, as they last said. */
  following?: string | null
}

export type RoomState = {
  /** Everyone in the room, by participant id — including yourself. */
  people: Record<string, Person>
  /** What the others have selected, by participant id. */
  selections: Record<string, RemoteSelection>
  /** Where the others are, by participant id. */
  focuses: Record<string, RemoteFocus>
  /** The step each person was last heard to be on — kept a while after they leave. */
  steps: Record<string, string>
  status: 'connecting' | 'live' | 'reconnecting'
}

type Events = {
  /** The server says the board changed. */
  onBoard: (event: LiveBoardEvent) => void
  /** The server says the step moved or the room closed. */
  onState: (event: LiveStateEvent) => void
  /** Another browser says what it just asked the API to write. */
  onHint: (hint: LiveHint) => void
  /** Somebody's player was played, paused or moved. */
  onMedia: (media: LiveMedia) => void
  /** Somebody scrolled — of interest to whoever follows them. */
  onView: (id: string, view: LiveView) => void
  /**
   * The channel is (again) joined. Anything announced while it was not is gone, so this
   * is the moment to ask the API where the room really stands.
   */
  onJoined: () => void
}

/** What this person says about where they are. */
export type Whereabouts = { stepId: string; following: string | null }

/** A pointer that has not moved for this long is taken down. */
const CURSOR_TTL_MS = 6_000
/** A touch on a block is shown for this long; a focus lasts until they leave the box. */
const TOUCH_TTL_MS = 2_500
/** Somebody who has not typed for this long has stopped typing. */
const TYPING_TTL_MS = 1_500
/** How often a pointer may be sent: the host's a little more often, since everyone watches it. */
const CURSOR_INTERVAL_MS = { host: 50, guest: 100 } as const
/** How often a selection may be sent. */
const SELECTION_INTERVAL_MS = 100
/** How often the step somebody is on may be sent. */
const STEP_INTERVAL_MS = 100
/** How often a scroll position may be sent. */
const VIEW_INTERVAL_MS = 80
/** How long to wait before taking a channel the server closed and asking for another. */
const REOPEN_AFTER_MS = [1_000, 2_000, 5_000, 10_000, 30_000]
/** A name longer than this is not a name. */
const NAME_MAX = 60
/** A pointer leaving the lesson. */
const GONE: LiveCursor = { stepId: '', x: -1, y: -1 }

/* -------------------------------------------------------------- the registry --- */

/**
 * Realtime hands back the same channel object for the same topic while one exists, and a
 * channel that is still saying goodbye cannot be subscribed again — so a component that
 * unmounts and remounts quickly (Strict Mode, Fast Refresh, a navigation and back) would
 * otherwise inherit a channel that never joins. Removal is remembered here per topic, and
 * whoever wants the topic next waits for it to finish before asking for a fresh channel.
 *
 * When nothing is pending the channel is handed over synchronously, on purpose: an
 * `await` in between would let a second mount ask for the same topic before the first
 * had let go of it, and both would end up holding one channel.
 */
const removals = new Map<string, Promise<unknown>>()

function acquire(
  supabase: SupabaseClient,
  topic: string,
  config: { broadcast: { self: boolean }; presence: { key: string } },
  ready: (channel: RealtimeChannel) => void,
) {
  const pending = removals.get(topic)
  if (pending) {
    void pending.then(() => ready(supabase.channel(topic, { config })))
  } else {
    ready(supabase.channel(topic, { config }))
  }
}

function release(supabase: SupabaseClient, topic: string, channel: RealtimeChannel) {
  const removal = supabase
    .removeChannel(channel)
    .catch(() => undefined)
    .finally(() => {
      if (removals.get(topic) === removal) removals.delete(topic)
    })

  removals.set(topic, removal)
}

/** Sends at most once per interval, always ending with the latest value. */
function useThrottled<T>(interval: number, send: (value: T) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queued = useRef<{ value: T } | null>(null)
  const sentAt = useRef(0)
  const sender = useRef(send)
  useEffect(() => {
    sender.current = send
  }, [send])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return useCallback(
    (value: T, { now = false } = {}) => {
      const flush = (next: T) => {
        sentAt.current = Date.now()
        sender.current(next)
      }

      if (now) {
        if (timer.current) clearTimeout(timer.current)
        timer.current = null
        queued.current = null
        flush(value)
        return
      }

      const wait = interval - (Date.now() - sentAt.current)
      if (wait <= 0 && !timer.current) {
        flush(value)
        return
      }

      queued.current = { value }
      if (!timer.current) {
        timer.current = setTimeout(
          () => {
            timer.current = null
            const next = queued.current
            queued.current = null
            if (next) flush(next.value)
          },
          Math.max(wait, 0),
        )
      }
    },
    [interval],
  )
}

const isString = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/**
 * What a player elsewhere says it is doing — checked field by field, because it arrives
 * on a channel open to whoever holds the link and is about to be done to a player.
 */
function asMedia(payload: unknown): LiveMedia | null {
  const media = payload as Partial<LiveMedia> | null
  if (!media || typeof media !== 'object') return null

  const sound =
    isString(media.blockId) &&
    media.blockId.length > 0 &&
    (media.kind === 'audio' || media.kind === 'video') &&
    isString(media.from) &&
    typeof media.playing === 'boolean' &&
    isNumber(media.time) &&
    media.time >= 0 &&
    isNumber(media.rate) &&
    media.rate > 0 &&
    media.rate <= 16 &&
    isNumber(media.at)

  return sound ? (media as LiveMedia) : null
}

/* ------------------------------------------------------------------ the hook --- */

/**
 * The room over Realtime: one channel per session, named after the session's unguessable
 * id, open to whoever holds the link — signed in or not.
 *
 * Two kinds of thing travel on it. What the server announces — the board, the step, the
 * end — is the truth, versioned, and handed to the caller to apply in order. What browsers
 * send each other — pointers, selections, where a video is up to, what they have just
 * asked the server to write, which step they are on — is the moment, and is drawn as it
 * comes. Presence says who is in. Nothing here is stored.
 *
 * Nothing on the channel says who really sent it, so what a message says about a person
 * is taken only from a person presence has shown to be here, and what it says about the
 * host is taken only as far as the API agrees.
 */
export function useLiveRoom(
  sessionId: string,
  me: LivePresence,
  hostId: string,
  events: Events,
): RoomState & {
  /** Tell the room where you are and whom you follow. */
  announce: (where: Whereabouts) => void
  /** Watch every pointer in the room, outside React's state. */
  watchCursors: (listener: (cursors: Map<string, RemoteCursor>) => void) => () => void
  sendCursor: (cursor: LiveCursor | null) => void
  sendSelection: (selection: LiveSelection | null) => void
  sendFocus: (focus: LiveFocus | null) => void
  sendHint: (ops: BoardOp[]) => void
  sendMedia: (media: Omit<LiveMedia, 'from'>) => void
  sendView: (view: LiveView) => void
} {
  const [people, setPeople] = useState<Record<string, Person>>({})
  const [selections, setSelections] = useState<Record<string, RemoteSelection>>({})
  const [focuses, setFocuses] = useState<Record<string, RemoteFocus>>({})
  const [steps, setSteps] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<RoomState['status']>('connecting')

  const channel = useRef<RealtimeChannel | null>(null)
  // Pointers are kept out of React on purpose: they move ten or twenty times a second
  // per person, and this state is the state the whole lesson hangs from. Whoever draws
  // them hears about each one and writes it to the screen itself.
  const cursors = useRef(new Map<string, RemoteCursor>())
  const cursorWatchers = useRef(new Set<(cursors: Map<string, RemoteCursor>) => void>())
  // Who is here, as presence last said — the only people whose word is taken.
  const known = useRef<Record<string, Person>>({})
  // Where everyone is and whom they follow, as they have said.
  const whereabouts = useRef<Record<string, Whereabouts>>({})
  // What this person says about where they are.
  const mine = useRef<Whereabouts | null>(null)
  // The latest handlers, so the channel set up once keeps calling current ones.
  const handlers = useRef(events)
  useEffect(() => {
    handlers.current = events
  }, [events])

  /** Sent only while joined: a message pushed at a channel that is not is quietly lost. */
  const send = useCallback((event: string, payload: object) => {
    const room = channel.current
    if (!room || room.state !== 'joined') return

    void room.send({ type: 'broadcast', event, payload })
  }, [])

  // Presence is tracked once, on joining: Realtime closes the channel of a client that
  // tracks too often, and does not reopen it. Where this person is travels as a
  // broadcast instead, and is told once more to each newcomer and on every rejoin.
  const sendStepNow = useCallback(
    (where: Whereabouts) => {
      const step: LiveStep = { id: me.id, stepId: where.stepId, following: where.following }
      send(LIVE_EVENTS.step, step)
    },
    [me.id, send],
  )
  const throttledStep = useThrottled(STEP_INTERVAL_MS, sendStepNow)
  const announce = useCallback(
    (where: Whereabouts) => {
      const current = mine.current
      if (current && current.stepId === where.stepId && current.following === where.following) {
        return
      }
      mine.current = where
      throttledStep(where)
    },
    [throttledStep],
  )

  useEffect(() => {
    const supabase = createClient()
    const topic = liveChannelFor(sessionId)
    let cancelled = false
    let room: RealtimeChannel | null = null
    let reopen: ReturnType<typeof setTimeout> | null = null
    let closures = 0

    const toldOfCursors = () => {
      for (const watcher of cursorWatchers.current) watcher(cursors.current)
    }

    const without = <T>(current: Record<string, T>, id: string) => {
      if (!(id in current)) return current
      const rest = { ...current }
      delete rest[id]
      return rest
    }

    /** A person presence has shown to be here; anything said in another name is noise. */
    const here = (id: unknown): id is string => isString(id) && id in known.current

    function attach(next: RealtimeChannel) {
      // Unmounted while we waited for the last channel to leave.
      if (cancelled) {
        release(supabase, topic, next)
        return
      }

      room = next
      channel.current = next

      next
        .on('presence', { event: 'sync' }, () => {
          const state = next.presenceState<Partial<LivePresence>>()
          const people: Record<string, Person> = {}
          let newcomer = false

          for (const entries of Object.values(state)) {
            const person = entries[0]
            // What presence carries is what a browser said about itself. A name is taken;
            // a role is not — the host is the host by id.
            if (!person || !isString(person.id) || !isString(person.name)) continue
            if (person.id !== me.id && !(person.id in known.current)) newcomer = true
            const said = whereabouts.current[person.id]
            people[person.id] = {
              id: person.id,
              name: person.name.slice(0, NAME_MAX),
              role: person.id === hostId ? 'host' : 'guest',
              ...(said ? { stepId: said.stepId, following: said.following } : {}),
            }
          }

          // Whoever left took their word with them.
          for (const id of Object.keys(whereabouts.current)) {
            if (!(id in people)) delete whereabouts.current[id]
          }

          known.current = people
          setPeople(people)
          // A pointer, a selection, a name tag without a person behind it is a ghost.
          for (const id of cursors.current.keys()) {
            if (!(id in people)) cursors.current.delete(id)
          }
          toldOfCursors()
          const keep = <T>(current: Record<string, T>) =>
            Object.fromEntries(Object.entries(current).filter(([id]) => id in people))
          setSelections(keep)
          setFocuses(keep)
          // Somebody new: tell them where this person is, since presence does not say.
          if (newcomer && mine.current) throttledStep(mine.current, { now: true })
        })
        .on('broadcast', { event: LIVE_EVENTS.step }, ({ payload }) => {
          const step = payload as LiveStep
          if (!step || !here(step.id) || !isString(step.stepId)) return
          const following = isString(step.following) ? step.following : null

          whereabouts.current[step.id] = { stepId: step.stepId, following }
          setSteps((current) =>
            current[step.id] === step.stepId ? current : { ...current, [step.id]: step.stepId },
          )
          setPeople((current) => {
            const person = current[step.id]
            if (!person) return current
            if (person.stepId === step.stepId && person.following === following) return current
            return { ...current, [step.id]: { ...person, stepId: step.stepId, following } }
          })
          // What they were pointing at on the step they left is behind them.
          setFocuses((current) =>
            current[step.id] && current[step.id]!.stepId !== step.stepId
              ? without(current, step.id)
              : current,
          )
          setSelections((current) =>
            current[step.id] && current[step.id]!.stepId !== step.stepId
              ? without(current, step.id)
              : current,
          )
        })
        .on('broadcast', { event: LIVE_EVENTS.cursor }, ({ payload }) => {
          const cursor = payload as RemoteCursor
          if (!cursor || !here(cursor.id)) return

          if (cursor.x < 0) {
            if (cursors.current.delete(cursor.id)) toldOfCursors()
          } else if (Number.isFinite(cursor.x) && Number.isFinite(cursor.y)) {
            cursors.current.set(cursor.id, {
              id: cursor.id,
              name: known.current[cursor.id]?.name ?? '',
              stepId: isString(cursor.stepId) ? cursor.stepId : '',
              x: cursor.x,
              y: cursor.y,
              at: Date.now(),
            })
            toldOfCursors()
          }
        })
        .on('broadcast', { event: LIVE_EVENTS.select }, ({ payload }) => {
          const selection = payload as RemoteSelection & { gone?: boolean }
          if (!selection || !here(selection.id)) return

          if (selection.gone) setSelections((current) => without(current, selection.id))
          else if (
            isString(selection.stepId) &&
            isString(selection.blockId) &&
            Array.isArray(selection.parts) &&
            selection.parts.length > 0 &&
            selection.parts.length <= SELECTION_PARTS_MAX &&
            selection.parts.every(
              (part) =>
                part !== null &&
                typeof part === 'object' &&
                ['key', 'len', 'nth', 'start', 'end'].every((field) =>
                  Number.isFinite((part as Record<string, unknown>)[field]),
                ),
            )
          ) {
            setSelections((current) => ({
              ...current,
              [selection.id]: {
                id: selection.id,
                stepId: selection.stepId,
                blockId: selection.blockId,
                parts: selection.parts,
                at: Date.now(),
              },
            }))
          }
        })
        .on('broadcast', { event: LIVE_EVENTS.focus }, ({ payload }) => {
          const focus = payload as RemoteFocus & { gone?: boolean }
          if (!focus || !here(focus.id)) return

          if (focus.gone) {
            setFocuses((current) => without(current, focus.id))
            return
          }
          if (!isString(focus.stepId) || !isString(focus.blockId)) return
          const unit = typeof focus.unit === 'number' ? focus.unit : null
          const now = Date.now()

          if (focus.kind === 'typing') {
            // Typing is a note on a focus, not a focus of its own.
            setFocuses((current) => ({
              ...current,
              [focus.id]: {
                id: focus.id,
                stepId: focus.stepId,
                blockId: focus.blockId,
                unit,
                kind: 'focus',
                at: now,
                typingAt: now,
              },
            }))
          } else if (focus.kind === 'focus' || focus.kind === 'touch') {
            setFocuses((current) => ({
              ...current,
              [focus.id]: {
                id: focus.id,
                stepId: focus.stepId,
                blockId: focus.blockId,
                unit,
                kind: focus.kind,
                at: now,
              },
            }))
          }
        })
        .on('broadcast', { event: LIVE_EVENTS.view }, ({ payload }) => {
          const view = payload as LiveView & { id: string }
          if (
            view &&
            here(view.id) &&
            isString(view.stepId) &&
            typeof view.top === 'number' &&
            typeof view.height === 'number'
          ) {
            handlers.current.onView(view.id, {
              stepId: view.stepId,
              top: view.top,
              height: view.height,
            })
          }
        })
        .on('broadcast', { event: LIVE_EVENTS.hint }, ({ payload }) => {
          const hint = payload as LiveHint
          if (hint && Array.isArray(hint.ops) && here(hint.from) && hint.from !== me.id) {
            handlers.current.onHint(hint)
          }
        })
        .on('broadcast', { event: LIVE_EVENTS.board }, ({ payload }) => {
          const event = payload as LiveBoardEvent
          if (typeof event?.version === 'number' && Array.isArray(event.ops)) {
            handlers.current.onBoard(event)
          }
        })
        .on('broadcast', { event: LIVE_EVENTS.state }, ({ payload }) => {
          const event = payload as LiveStateEvent
          if (typeof event?.version === 'number') handlers.current.onState(event)
        })
        .on('broadcast', { event: LIVE_EVENTS.media }, ({ payload }) => {
          const media = asMedia(payload)
          if (!media || !here(media.from) || media.from === me.id) return

          // Anchored to this browser's clock rather than the sender's. The two can be
          // minutes apart, and a player told to work out where it should be by now would
          // then be sent minutes into the wrong place; the price of reading it here is
          // one message's travel, which is a fraction of a second.
          handlers.current.onMedia({ ...media, at: Date.now() })
        })
        .subscribe((state) => {
          if (state === 'SUBSCRIBED') {
            closures = 0
            setStatus('live')
            // Every join, not just the first: a rejoin after a dropped socket has lost the
            // presence, has missed whatever was announced in between, and must say again
            // where this person is.
            void next.track(me)
            if (mine.current) throttledStep(mine.current, { now: true })
            handlers.current.onJoined()
          } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
            if (cancelled) return
            setStatus('reconnecting')
            // An error or a timeout the channel retries on its own. A close is final: the
            // server hung up on this channel, and nothing will ring it again unless we do
            // — a little later each time, in case it keeps hanging up.
            if (state === 'CLOSED' && room === next && !reopen) {
              const delay = REOPEN_AFTER_MS[Math.min(closures, REOPEN_AFTER_MS.length - 1)]!
              closures += 1
              reopen = setTimeout(() => {
                reopen = null
                if (cancelled) return
                channel.current = null
                room = null
                release(supabase, topic, next)
                acquire(
                  supabase,
                  topic,
                  { broadcast: { self: false }, presence: { key: me.id } },
                  attach,
                )
              }, delay)
            }
          }
        })
    }

    acquire(supabase, topic, { broadcast: { self: false }, presence: { key: me.id } }, attach)

    // What stopped moving is taken down here, so a closed laptop does not leave a pointer
    // over the lesson for the hour. A focus or a selection stays until its owner takes it
    // back, moves on, or leaves — presence says when they leave.
    const sweep = setInterval(() => {
      const now = Date.now()
      let swept = false
      for (const [id, cursor] of cursors.current) {
        if (now - cursor.at >= CURSOR_TTL_MS) {
          cursors.current.delete(id)
          swept = true
        }
      }
      if (swept) toldOfCursors()
      setFocuses((current) => {
        let changed = false
        const next: Record<string, RemoteFocus> = {}
        for (const [id, focus] of Object.entries(current)) {
          if (focus.kind === 'touch' && now - focus.at >= TOUCH_TTL_MS) {
            changed = true
            continue
          }
          if (focus.typingAt !== undefined && now - focus.typingAt >= TYPING_TTL_MS) {
            const rest = { ...focus }
            delete rest.typingAt
            next[id] = rest
            changed = true
            continue
          }
          next[id] = focus
        }
        return changed ? next : current
      })
    }, 500)

    return () => {
      cancelled = true
      clearInterval(sweep)
      if (reopen) clearTimeout(reopen)
      channel.current = null
      if (room) release(supabase, topic, room)
    }
    // `me` is who this person is for the whole visit; a new object each render must not
    // rejoin the room.
  }, [sessionId, me, hostId, throttledStep])

  /* ------------------------------------------------------------------ pointers --- */

  const sendCursorNow = useCallback(
    (cursor: LiveCursor) => send(LIVE_EVENTS.cursor, { id: me.id, ...cursor }),
    [me.id, send],
  )
  const throttledCursor = useThrottled(CURSOR_INTERVAL_MS[me.role], sendCursorNow)
  const sendCursor = useCallback(
    // Leaving is sent at once and cancels whatever was queued.
    (cursor: LiveCursor | null) => throttledCursor(cursor ?? GONE, { now: cursor === null }),
    [throttledCursor],
  )

  /** Hear where every pointer is, without the page having to re-render to find out. */
  const watchCursors = useCallback((listener: (cursors: Map<string, RemoteCursor>) => void) => {
    cursorWatchers.current.add(listener)
    listener(cursors.current)

    return () => {
      cursorWatchers.current.delete(listener)
    }
  }, [])

  /* ---------------------------------------------------------------- selection --- */

  const sendSelectionNow = useCallback(
    (selection: LiveSelection | null) =>
      send(LIVE_EVENTS.select, selection ? { id: me.id, ...selection } : { id: me.id, gone: true }),
    [me.id, send],
  )
  const throttledSelection = useThrottled(SELECTION_INTERVAL_MS, sendSelectionNow)
  const sendSelection = useCallback(
    (selection: LiveSelection | null) => throttledSelection(selection, { now: selection === null }),
    [throttledSelection],
  )

  /* -------------------------------------------------------------------- focus --- */

  const sendFocus = useCallback(
    (focus: LiveFocus | null) =>
      send(LIVE_EVENTS.focus, focus ? { id: me.id, ...focus } : { id: me.id, gone: true }),
    [me.id, send],
  )

  /* -------------------------------------------------------------------- hints --- */

  const sendHint = useCallback(
    (ops: BoardOp[]) => {
      const hint: LiveHint = { ops, from: me.id }
      send(LIVE_EVENTS.hint, hint)
    },
    [me.id, send],
  )

  /* --------------------------------------------------------------------- media --- */

  const sendMedia = useCallback(
    (media: Omit<LiveMedia, 'from'>) => send(LIVE_EVENTS.media, { ...media, from: me.id }),
    [me.id, send],
  )

  /* ---------------------------------------------------------------------- view --- */

  const sendViewNow = useCallback(
    (view: LiveView) => send(LIVE_EVENTS.view, { id: me.id, ...view }),
    [me.id, send],
  )
  const sendView = useThrottled(VIEW_INTERVAL_MS, sendViewNow)

  return {
    people,
    watchCursors,
    selections,
    focuses,
    steps,
    status,
    announce,
    sendCursor,
    sendSelection,
    sendFocus,
    sendHint,
    sendMedia,
    sendView,
  }
}

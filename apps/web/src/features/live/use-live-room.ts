'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import {
  LIVE_EVENTS,
  LIVE_REACTION_COOLDOWN_MS,
  liveChannelFor,
  liveHandEvent,
  liveReactionEvent,
  SELECTION_PARTS_MAX,
  type BoardOp,
  type LiveBoardEvent,
  type LiveCursor,
  type LiveFocus,
  type LiveHint,
  type LiveHandEvent,
  type LivePresence,
  type LiveSelection,
  type LiveStateEvent,
  type LiveStep,
  type LiveReactionEvent,
  type LiveReactionKind,
} from '@tp/shared'
import { createClient } from '@/lib/supabase/client'

/** A pointer somebody else is holding over the lesson, and when it last moved. */
export type RemoteCursor = LiveCursor & { id: string; name: string; at: number }
/** Text somebody else has selected, and when. */
export type RemoteSelection = LiveSelection & { id: string; at: number }
/** Where somebody else's attention is, when it got there, and when they last typed. */
export type RemoteFocus = LiveFocus & { id: string; at: number; typingAt?: number }
/** A short-lived reaction, drawn once with the name presence supplied. */
export type RemoteReaction = LiveReactionEvent & { name: string; at: number }
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
  /** Raised hands survive reconnect because each browser announces its own state again. */
  hands: Record<string, true>
  /** At most the latest short-lived reaction from each participant. */
  reactions: Record<string, RemoteReaction>
  /** Whether this browser connection, rather than another tab, raised its hand. */
  ownHandRaised: boolean
  status: 'connecting' | 'live' | 'reconnecting'
}

type Events = {
  /** The server says the board changed. */
  onBoard: (event: LiveBoardEvent) => void
  /** The server says the step moved or the room closed. */
  onState: (event: LiveStateEvent) => void
  /** Another browser says what it just asked the API to write. */
  onHint: (hint: LiveHint) => void
  /**
   * The channel is (again) joined. Anything announced while it was not is gone, so this
   * is the moment to ask the API where the room really stands.
   */
  onJoined: () => void
}

/** What this person says about where they are. */
export type Whereabouts = { stepId: string; following: string | null }
type ConnectionPresence = Partial<LivePresence> & { connectionId?: string }

/** A pointer that has not moved for this long is taken down. */
const CURSOR_TTL_MS = 6_000
/** A touch on a block is shown for this long; a focus lasts until they leave the box. */
const TOUCH_TTL_MS = 2_500
/** Somebody who has not typed for this long has stopped typing. */
const TYPING_TTL_MS = 1_500
/** A reaction has enough time to rise and be read, then leaves no room state behind. */
const REACTION_TTL_MS = 3_500
/** Remember accepted and rejected event ids for the practical lifetime of a lesson. */
const REACTION_REPLAY_TTL_MS = 10 * 60_000
const REACTION_REPLAY_MAX = 1_000
/** How often a pointer may be sent: the host's a little more often, since everyone watches it. */
const CURSOR_INTERVAL_MS = { host: 50, guest: 100 } as const
/** How often a selection may be sent. */
const SELECTION_INTERVAL_MS = 100
/** How often the step somebody is on may be sent. */
const STEP_INTERVAL_MS = 100
/** How often a scroll position may be sent. */
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
/* ------------------------------------------------------------------ the hook --- */

/**
 * The room over Realtime: one channel per session, named after the session's unguessable
 * id, open to whoever holds the link — signed in or not.
 *
 * Two kinds of thing travel on it. Server announcements invalidate the board and session
 * state, which the caller refreshes from the API. Browser messages describe presence,
 * pointers, selections and where people say they are. Nothing here is stored.
 *
 * Nothing on the public channel proves who sent it. In particular, media and view packets
 * are never applied to another browser's player or scroll position. Host step and board
 * commands are taken only from the API.
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
  sendHand: (raised: boolean) => void
  /** False means a reaction was intentionally ignored by the local cooldown. */
  sendReaction: (reaction: LiveReactionKind) => boolean
} {
  const [people, setPeople] = useState<Record<string, Person>>({})
  const [selections, setSelections] = useState<Record<string, RemoteSelection>>({})
  const [focuses, setFocuses] = useState<Record<string, RemoteFocus>>({})
  const [steps, setSteps] = useState<Record<string, string>>({})
  const [hands, setHands] = useState<Record<string, true>>({})
  const [reactions, setReactions] = useState<Record<string, RemoteReaction>>({})
  const [ownHandRaised, setOwnHandRaised] = useState(false)
  const [status, setStatus] = useState<RoomState['status']>('connecting')

  const channel = useRef<RealtimeChannel | null>(null)
  // Pointers are kept out of React on purpose: they move ten or twenty times a second
  // per person, and this state is the state the whole lesson hangs from. Whoever draws
  // them hears about each one and writes it to the screen itself.
  const cursors = useRef(new Map<string, RemoteCursor>())
  const cursorWatchers = useRef(new Set<(cursors: Map<string, RemoteCursor>) => void>())
  // Who is here, as presence last said — the only people whose word is taken.
  const known = useRef<Record<string, Person>>({})
  // Every tab gets its own presence connection. Classroom signals are decorative and may
  // affect only a connection currently visible in presence; they never authorize state.
  const knownConnections = useRef<Record<string, string>>({})
  const connection = useRef<string | null>(null)
  // Where everyone is and whom they follow, as they have said.
  const whereabouts = useRef<Record<string, Whereabouts>>({})
  // What this person says about where they are.
  const mine = useRef<Whereabouts | null>(null)
  const myHand = useRef(false)
  const handConnections = useRef<Record<string, string>>({})
  const lastReactionByConnection = useRef<Record<string, number>>({})
  const seenReactionEvents = useRef(new Map<string, number>())
  const lastReactionSentAt = useRef(0)
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

  const announceHand = useCallback(
    (raised: boolean) => {
      const connectionId = connection.current
      if (!connectionId) return
      const event: LiveHandEvent = { id: me.id, connectionId, raised }
      send(LIVE_EVENTS.hand, event)
    },
    [me.id, send],
  )

  const publishHands = useCallback(() => {
    const next: Record<string, true> = {}
    for (const id of Object.values(handConnections.current)) next[id] = true
    setHands(next)
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
    const connectionId = crypto.randomUUID()
    connection.current = connectionId
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
    const hereOn = (id: string, sender: string) => knownConnections.current[sender] === id

    function attach(next: RealtimeChannel) {
      // Unmounted while we waited for the last channel to leave.
      if (cancelled) {
        release(supabase, topic, next)
        return
      }

      room = next
      channel.current = next

      const scheduleReopen = () => {
        if (cancelled || room !== next || reopen) return
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
            { broadcast: { self: false }, presence: { key: connectionId } },
            attach,
          )
        }, delay)
      }

      next
        .on('presence', { event: 'sync' }, () => {
          const state = next.presenceState<ConnectionPresence>()
          const people: Record<string, Person> = {}
          const connections: Record<string, string> = {}
          let newcomer = false

          for (const entries of Object.values(state)) {
            for (const person of entries) {
              // What presence carries is what a browser said about itself. A name is taken;
              // a role is not — the host is the host by id.
              if (
                !person ||
                !isString(person.id) ||
                !isString(person.name) ||
                !isString(person.connectionId)
              ) {
                continue
              }
              if (person.id !== me.id && !(person.id in known.current)) newcomer = true
              connections[person.connectionId] = person.id
              const said = whereabouts.current[person.id]
              people[person.id] = {
                id: person.id,
                name: person.name.slice(0, NAME_MAX),
                role: person.id === hostId ? 'host' : 'guest',
                ...(said ? { stepId: said.stepId, following: said.following } : {}),
              }
            }
          }

          // Whoever left took their word with them.
          for (const id of Object.keys(whereabouts.current)) {
            if (!(id in people)) delete whereabouts.current[id]
          }

          known.current = people
          knownConnections.current = connections
          for (const sender of Object.keys(lastReactionByConnection.current)) {
            if (!(sender in connections)) delete lastReactionByConnection.current[sender]
          }
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
          handConnections.current = Object.fromEntries(
            Object.entries(handConnections.current).filter(
              ([sender, id]) => connections[sender] === id,
            ),
          )
          publishHands()
          setReactions(keep)
          // Somebody new: tell them where this person is, since presence does not say.
          if (newcomer && mine.current) throttledStep(mine.current, { now: true })
          // A second tab has its own connection entry but may collapse into the same person
          // in the UI. Repeating a raised hand on every presence sync lets that tab learn
          // this connection's state too.
          if (myHand.current) announceHand(true)
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
        .on('broadcast', { event: LIVE_EVENTS.hand }, ({ payload }) => {
          const parsed = liveHandEvent.safeParse(payload)
          if (!parsed.success || !hereOn(parsed.data.id, parsed.data.connectionId)) return

          if (parsed.data.raised) {
            handConnections.current[parsed.data.connectionId] = parsed.data.id
          } else {
            delete handConnections.current[parsed.data.connectionId]
          }
          publishHands()
        })
        .on('broadcast', { event: LIVE_EVENTS.reaction }, ({ payload }) => {
          const parsed = liveReactionEvent.safeParse(payload)
          if (!parsed.success || !hereOn(parsed.data.id, parsed.data.connectionId)) return

          const now = Date.now()
          if (seenReactionEvents.current.has(parsed.data.eventId)) return
          if (seenReactionEvents.current.size >= REACTION_REPLAY_MAX) {
            const oldest = seenReactionEvents.current.keys().next().value
            if (oldest) seenReactionEvents.current.delete(oldest)
          }
          // Remember even a rate-limited id: replaying that same packet later must not
          // turn a deliberately ignored reaction into a fresh one.
          seenReactionEvents.current.set(parsed.data.eventId, now)
          if (
            now - (lastReactionByConnection.current[parsed.data.connectionId] ?? 0) <
            LIVE_REACTION_COOLDOWN_MS
          ) {
            return
          }
          lastReactionByConnection.current[parsed.data.connectionId] = now
          setReactions((current) => ({
            ...current,
            [parsed.data.id]: {
              ...parsed.data,
              name: known.current[parsed.data.id]?.name ?? '',
              at: now,
            },
          }))
        })
        // A public sender can claim any id. Hints only wake an API read; view and media
        // broadcasts have no receiver until their origin can be authenticated.
        .on('broadcast', { event: LIVE_EVENTS.hint }, ({ payload }) => {
          const hint = payload as LiveHint
          if (hint && Array.isArray(hint.ops) && here(hint.from) && hint.from !== me.id) {
            handlers.current.onHint(hint)
          }
        })
        .on('broadcast', { event: LIVE_EVENTS.board }, ({ payload }) => {
          const event = payload as LiveBoardEvent
          if (
            Number.isSafeInteger(event?.version) &&
            event.version >= 0 &&
            Array.isArray(event.ops) &&
            event.ops.length <= 50
          ) {
            handlers.current.onBoard(event)
          }
        })
        .on('broadcast', { event: LIVE_EVENTS.state }, ({ payload }) => {
          const event = payload as LiveStateEvent
          if (Number.isSafeInteger(event?.version) && event.version >= 0) {
            handlers.current.onState(event)
          }
        })
        .subscribe((state) => {
          if (state === 'SUBSCRIBED') {
            // Every join, not just the first: a rejoin after a dropped socket has lost the
            // presence, has missed whatever was announced in between, and must say again
            // where this person is.
            void next.track({ ...me, connectionId }).then(
              (tracking) => {
                if (cancelled || room !== next) return
                if (tracking !== 'ok') {
                  setStatus('reconnecting')
                  scheduleReopen()
                  void next.unsubscribe()
                  return
                }
                closures = 0
                setStatus('live')
                if (mine.current) throttledStep(mine.current, { now: true })
                if (myHand.current) announceHand(true)
                handlers.current.onJoined()
              },
              () => {
                if (!cancelled && room === next) {
                  setStatus('reconnecting')
                  scheduleReopen()
                  void next.unsubscribe()
                }
              },
            )
          } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
            if (cancelled) return
            setStatus('reconnecting')
            // An error or a timeout the channel retries on its own. A close is final: the
            // server hung up on this channel, and nothing will ring it again unless we do
            // — a little later each time, in case it keeps hanging up.
            if (state === 'CLOSED') scheduleReopen()
          }
        })
    }

    acquire(
      supabase,
      topic,
      { broadcast: { self: false }, presence: { key: connectionId } },
      attach,
    )

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
      setReactions((current) => {
        const fresh = Object.fromEntries(
          Object.entries(current).filter(([, reaction]) => now - reaction.at < REACTION_TTL_MS),
        )
        return Object.keys(fresh).length === Object.keys(current).length ? current : fresh
      })
      for (const [eventId, receivedAt] of seenReactionEvents.current) {
        if (now - receivedAt >= REACTION_REPLAY_TTL_MS) {
          seenReactionEvents.current.delete(eventId)
        }
      }
    }, 500)

    return () => {
      cancelled = true
      clearInterval(sweep)
      if (reopen) clearTimeout(reopen)
      channel.current = null
      if (connection.current === connectionId) connection.current = null
      if (room) release(supabase, topic, room)
    }
    // `me` is who this person is for the whole visit; a new object each render must not
    // rejoin the room.
  }, [sessionId, me, hostId, throttledStep, announceHand, publishHands])

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

  /* -------------------------------------------------------- classroom signals --- */

  const sendHand = useCallback(
    (raised: boolean) => {
      const connectionId = connection.current
      if (!connectionId) return
      myHand.current = raised
      setOwnHandRaised(raised)
      if (raised) handConnections.current[connectionId] = me.id
      else delete handConnections.current[connectionId]
      publishHands()
      announceHand(raised)
    },
    [announceHand, me.id, publishHands],
  )

  const sendReaction = useCallback(
    (reaction: LiveReactionKind) => {
      const connectionId = connection.current
      if (!connectionId) return false
      const now = Date.now()
      if (now - lastReactionSentAt.current < LIVE_REACTION_COOLDOWN_MS) return false
      lastReactionSentAt.current = now
      lastReactionByConnection.current[connectionId] = now
      const event: LiveReactionEvent = {
        id: me.id,
        connectionId,
        eventId: crypto.randomUUID(),
        reaction,
      }
      if (seenReactionEvents.current.size >= REACTION_REPLAY_MAX) {
        const oldest = seenReactionEvents.current.keys().next().value
        if (oldest) seenReactionEvents.current.delete(oldest)
      }
      seenReactionEvents.current.set(event.eventId, now)
      setReactions((current) => ({
        ...current,
        [me.id]: { ...event, name: me.name, at: now },
      }))
      send(LIVE_EVENTS.reaction, event)
      return true
    },
    [me.id, me.name, send],
  )

  return {
    people,
    watchCursors,
    selections,
    focuses,
    steps,
    hands,
    reactions,
    ownHandRaised,
    status,
    announce,
    sendCursor,
    sendSelection,
    sendFocus,
    sendHint,
    sendHand,
    sendReaction,
  }
}

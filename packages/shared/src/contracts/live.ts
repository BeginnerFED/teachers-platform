import { z } from 'zod'
import type { Enums } from '../database.types'
import type { MaterialOwner, StepCheckResult, StudentMaterial } from './materials'
import type { Level } from '../constants'

/**
 * A live lesson: a teacher opens a lesson from the library in front of their students,
 * and everyone works on one shared board. The step is the teacher's; the answers, the
 * marks and the state of every block — a card turned, a game begun — are everybody's, the
 * way one canvas is everybody's. Whoever holds the link may be in the room, signed in or
 * not.
 *
 * The board lives in the database and changes only through the API, which announces every
 * change over a Realtime channel with a version number. Browsers apply what they are told
 * in order and ask for the whole board again when they notice a gap. What is momentary —
 * pointers, who is in, where a video is up to — travels over the same channel and is
 * never stored.
 */

export const LIVE_SESSION_STATUSES = ['active', 'ended'] as const
export type LiveSessionStatus = (typeof LIVE_SESSION_STATUSES)[number]

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never

/** The Postgres enum and this list must agree. */
export const liveStatusesMatchDatabase: Exact<
  LiveSessionStatus,
  Enums<'live_session_status'>
> = true

export const liveSessionIdParam = z.object({ sessionId: z.uuid() })

export const startLiveSessionBody = z.object({ materialId: z.uuid() })
export type StartLiveSessionBody = z.infer<typeof startLiveSessionBody>

export const setLiveStepBody = z.object({ stepId: z.uuid() })
export type SetLiveStepBody = z.infer<typeof setLiveStepBody>

/** The host calls everyone to a step. */
export const gatherLiveBody = z.object({ stepId: z.uuid() })
export type GatherLiveBody = z.infer<typeof gatherLiveBody>

/**
 * Where on the board the room's own notes live — a call to gather — as opposed to a
 * step's blocks. Not a step id, so nothing that comes in through the link can write it.
 */
export const BOARD_ROOM_KEY = 'room'

/** The host's last call to gather, as written to the board. */
export type LiveGather = {
  stepId: string
  /** The API's clock when the host called. */
  at: number
}

/** The Realtime channel a session's room lives on. */
export const LIVE_CHANNEL_PREFIX = 'live:'
export const liveChannelFor = (sessionId: string) => `${LIVE_CHANNEL_PREFIX}${sessionId}`

/* -------------------------------------------------------------------- the board --- */

/**
 * One change to the board: a value set at a path, or a path cleared. Paths are short —
 * `answers.<step>.<block>`, `results.<step>`, `ui.<step>.<block>` — and the leaf value is
 * whatever the block understands, which the API does not interpret.
 */
const boardPath = z.array(z.string().min(1).max(80)).min(1).max(6)

/** A leaf is an answer or a block's state, never a document. */
export const BOARD_VALUE_MAX_BYTES = 8 * 1024

const boardValue = z.unknown().refine(
  (value) => {
    const encoded = JSON.stringify(value)
    return encoded !== undefined && encoded.length <= BOARD_VALUE_MAX_BYTES
  },
  { message: 'Too large for the board' },
)

export const boardOp = z.discriminatedUnion('t', [
  z.object({ t: z.literal('set'), path: boardPath, value: boardValue }),
  z.object({ t: z.literal('unset'), path: boardPath }),
])
export type BoardOp = z.infer<typeof boardOp>

/** A batch of changes. Small on purpose: a batch is one gesture, not a document. */
export const applyLiveOpsBody = z.object({
  ops: z.array(boardOp).min(1).max(50),
  /** Who made the gesture — shown, never trusted. */
  from: z.string().min(1).max(80).optional(),
})
export type ApplyLiveOpsBody = z.infer<typeof applyLiveOpsBody>

/** A step's answers, marked and written to the board for everyone to see. */
export const liveCheckBody = z.object({
  stepId: z.uuid(),
  answers: z.record(z.string(), z.unknown()),
})
export type LiveCheckBody = z.infer<typeof liveCheckBody>

/** The board as every browser holds it. Every key is optional: a fresh room is `{}`. */
export type LiveBoard = {
  /** By step, then by block: the answer everyone sees. */
  answers?: Record<string, Record<string, unknown>>
  /** By step: the marks, once somebody pressed "check". */
  results?: Record<string, StepCheckResult>
  /** By step, then by block: the state of a block that is not an answer. */
  ui?: Record<string, Record<string, unknown>>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const isFinite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/**
 * Whether something on the board is marks the player can draw. The board is open to
 * whoever holds the link, so what sits under `results` is not taken on trust: anything
 * that is not the shape the marker writes is treated as "not checked".
 */
export function isStepCheckResult(value: unknown): value is StepCheckResult {
  if (!isRecord(value)) return false
  if (!isFinite(value.autoScore) || !isFinite(value.autoMax) || !isFinite(value.manualMax)) {
    return false
  }
  if (!isRecord(value.byBlock)) return false

  return Object.values(value.byBlock).every(
    (block) =>
      isRecord(block) &&
      (block.score === null || isFinite(block.score)) &&
      isFinite(block.max) &&
      typeof block.manual === 'boolean' &&
      isRecord(block.parts) &&
      Object.values(block.parts).every((part) => typeof part === 'boolean') &&
      (block.explanation === undefined || typeof block.explanation === 'string'),
  )
}

/** The board's marks, keeping only what the player can draw. */
export function trustedResults(results: LiveBoard['results']): Record<string, StepCheckResult> {
  const kept: Record<string, StepCheckResult> = {}
  for (const [stepId, result] of Object.entries(results ?? {})) {
    if (isStepCheckResult(result)) kept[stepId] = result
  }

  return kept
}

/**
 * The same change the database makes, made to a board in memory — so a browser can draw a
 * gesture before the server confirms it and re-apply the server's announcement without
 * fear: `set` and `unset` land the same board however many times they land. Missing
 * parents are created as objects; a parent that is not an object is replaced by one, as
 * the database does. Never mutates what it is given.
 */
export function applyBoardOps(board: LiveBoard, ops: BoardOp[]): LiveBoard {
  let next: Record<string, unknown> = board as Record<string, unknown>

  for (const op of ops) {
    next = applyOne(next, op.path, op)
  }

  return next as LiveBoard
}

function applyOne(
  node: Record<string, unknown>,
  path: string[],
  op: BoardOp,
): Record<string, unknown> {
  const [head, ...rest] = path
  if (head === undefined) return node

  if (rest.length === 0) {
    if (op.t === 'unset') {
      if (!(head in node)) return node
      const copy = { ...node }
      delete copy[head]
      return copy
    }

    return { ...node, [head]: op.value }
  }

  const child = node[head]
  // Clearing something below a parent that is not there clears nothing.
  if (op.t === 'unset' && !isRecord(child)) return node

  const updated = applyOne(isRecord(child) ? child : {}, rest, op)
  // Nothing changed below: hand back the same board, so nothing above re-renders either.
  if (updated === child) return node

  return { ...node, [head]: updated }
}

/* ----------------------------------------------------------------- responses --- */

export type LiveSession = {
  id: string
  status: LiveSessionStatus
  material: { id: string; title: string; level: Level; stepCount: number }
  teacher: MaterialOwner
  /** Null until the host has moved off the first step. */
  currentStepId: string | null
  startedAt: string
  endedAt: string | null
}

/**
 * Where the room stands, whole: the version, the board, the step, whether it is over.
 * What a browser loads on entry, and what it asks for again whenever it notices it has
 * missed something.
 */
export type LiveSnapshot = {
  version: number
  board: LiveBoard
  currentStepId: string | null
  status: LiveSessionStatus
}

/** The room as it is handed to somebody who holds only the link. */
export type LivePublicRoom = {
  session: LiveSession
  lesson: StudentMaterial
  snapshot: LiveSnapshot
}

/** Everything one person needs to be in the room. */
export type LiveRoom = LivePublicRoom & {
  /** Whether this person drives the room or follows it. */
  role: 'host' | 'guest'
  me: { id: string; name: string }
}

/* ------------------------------------------------------------------ the wire --- */

/** The events on a room's channel. */
export const LIVE_EVENTS = {
  /** From the server: the board changed. */
  board: 'board',
  /** From the server: the step moved, or the room closed. */
  state: 'state',
  /** From a browser: a pointer moved. */
  cursor: 'cursor',
  /** From a browser: a video or audio was played, paused or moved. */
  media: 'media',
  /** From a browser: the step this person is now looking at. */
  step: 'step',
  /**
   * From a browser: what it just asked the API to write, so the others can draw it now
   * rather than when the API's announcement arrives. A hint, never the truth.
   */
  hint: 'hint',
  /** From a browser: the text somebody has selected. */
  select: 'select',
  /** From a browser: how far down the lesson somebody has scrolled, for whoever follows them. */
  view: 'view',
  /** From a browser: the block, or the box in it, somebody is in. */
  focus: 'focus',
} as const

/** Announced by the server after a batch of changes landed. */
export type LiveBoardEvent = {
  version: number
  ops: BoardOp[]
  from?: string
}

/** Announced by the server after the step moved or the room closed. */
export type LiveStateEvent = {
  version: number
  currentStepId: string | null
  status: LiveSessionStatus
}

/** What each person in the room announces about themselves. */
export type LivePresence = {
  id: string
  name: string
  role: 'host' | 'guest'
  /** Where they are, as they last said. Not carried by presence: it travels as a step broadcast. */
  stepId?: string
}

/**
 * Where somebody is now, and whom they follow. Sent on every turn of the page, once more
 * to each newcomer, and again on every rejoin.
 */
export type LiveStep = {
  id: string
  stepId: string
  following: string | null
}

/** A browser's own changes, told to the others before the API confirms them. */
export type LiveHint = {
  ops: BoardOp[]
  from: string
}

/**
 * The text somebody has selected, as offsets into the text of one block — which reads the
 * same on every screen, since every screen draws the same block.
 */
/**
 * Where somebody's window sits over the lesson, as fractions of the lesson column's height,
 * so a follower on a screen of another size lands on the same part of the page. Sent only
 * while somebody follows.
 */
export type LiveView = {
  stepId: string
  /** The top of their window, measured from the top of the lesson. */
  top: number
  /** How tall their window is. */
  height: number
}

/**
 * The text somebody has selected: which element of which block, by the element's place in
 * the block, and offsets into that element's text. The element rather than the block,
 * because a block also carries labels and buttons in the reader's language, and a
 * paragraph of the lesson reads the same on every screen while a label may not.
 */
export type LiveSelection = {
  stepId: string
  blockId: string
  /** The element's index among the block's elements, in document order; -1 for the block. */
  element: number
  start: number
  end: number
}

/**
 * Where somebody's attention is: a block they touched, or a box in it they are typing
 * in. `unit` counts the block's controls in document order.
 */
export type LiveFocus = {
  stepId: string
  blockId: string
  unit: number | null
  /** A touch fades on its own; a focus stays until they leave the box. */
  kind: 'touch' | 'focus' | 'typing'
}

/**
 * A pointer over the lesson, as fractions of the lesson column's width and height so it
 * lands in the same place on a screen of a different size.
 */
export type LiveCursor = {
  stepId: string
  x: number
  y: number
}

/**
 * What somebody's player is doing right now, anchored to their clock so everyone else can
 * work out where it must be by the time the message arrives. Not stored: it is the
 * moment, like a pointer.
 */
export type LiveMedia = {
  blockId: string
  kind: 'video' | 'audio'
  playing: boolean
  /** Position in seconds when `at` was read. */
  time: number
  rate: number
  /** The sender's Date.now() when `time` was read. */
  at: number
  from: string
}

/** How far a player may drift from the room before it is pulled back, in seconds. */
export const MEDIA_DRIFT_S = { video: 1, audio: 0.5 } as const

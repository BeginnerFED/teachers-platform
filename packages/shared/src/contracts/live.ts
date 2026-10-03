import { z } from 'zod'
import type { Enums } from '../database.types'
import type { Block, StudentBlock } from './blocks'
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

export const startLiveSessionBody = z
  .object({
    materialId: z.uuid(),
    /** When supplied, starting may only replace the room the host actually saw. */
    expectedActiveSessionId: z.uuid().nullable().optional(),
    studentIds: z.array(z.uuid()).max(50).optional(),
    lessonId: z.uuid().optional(),
    expectedLessonUpdatedAt: z.iso.datetime({ offset: true }).optional(),
    newLesson: z
      .strictObject({
        id: z.uuid(),
        durationMinutes: z.number().int().min(15).max(240).multipleOf(15),
      })
      .optional(),
  })
  .refine((body) => Boolean(body.lessonId) === Boolean(body.expectedLessonUpdatedAt))
  .refine((body) => !body.newLesson || (!body.lessonId && !!body.studentIds?.length))
export type StartLiveSessionBody = z.infer<typeof startLiveSessionBody>

export const liveInvitationResponseBody = z.object({ response: z.enum(['joined', 'declined']) })
export const readLiveInvitationsBody = z.object({ sessionIds: z.array(z.uuid()).min(1).max(50) })
export type LiveInvitationStatus = 'pending' | 'joined' | 'declined' | 'ended'
export type HostLiveInvitation = {
  student: MaterialOwner
  status: LiveInvitationStatus
  invitedAt: string
  readAt: string | null
  joinedAt: string | null
}
export type HostedLiveSession = LiveSession & { invitations: HostLiveInvitation[] }
export type StudentLiveInvitation = {
  session: LiveSession
  status: LiveInvitationStatus
  invitedAt: string
  readAt: string | null
}

export type RecentLiveMaterial = {
  material: { id: string; title: string; level: Level; stepCount: number }
  lastUsedAt: string
}

export const setLiveStepBody = z.object({ stepId: z.uuid() })
export type SetLiveStepBody = z.infer<typeof setLiveStepBody>

/** The host calls everyone to a step. */
export const gatherLiveBody = z.object({ stepId: z.uuid() })
export type GatherLiveBody = z.infer<typeof gatherLiveBody>

/** A classroom timer is short-lived room state, controlled only through the host API. */
export const LIVE_TIMER_SECONDS = { min: 5, max: 60 * 60 } as const

export const setLiveTimerBody = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('start'),
    durationSeconds: z.number().int().min(LIVE_TIMER_SECONDS.min).max(LIVE_TIMER_SECONDS.max),
    /** Timer the host saw when issuing this command; null means the room had none. */
    expectedTimerId: z.uuid().nullable(),
  }),
  z.strictObject({
    action: z.literal('stop'),
    /** Prevents a delayed stop from clearing a timer another host tab started later. */
    timerId: z.uuid(),
  }),
])
export type SetLiveTimerBody = z.infer<typeof setLiveTimerBody>

/**
 * The timer as every browser sees it. Epoch milliseconds come from the API's clock, so
 * no participant can lengthen a timer by publishing a different clock over Realtime.
 */
export const liveTimerState = z
  .strictObject({
    id: z.uuid(),
    durationSeconds: z.number().int().min(LIVE_TIMER_SECONDS.min).max(LIVE_TIMER_SECONDS.max),
    startedAt: z.number().int().nonnegative(),
    endsAt: z.number().int().positive(),
  })
  .refine((timer) => timer.endsAt === timer.startedAt + timer.durationSeconds * 1_000, {
    message: 'Timer clocks do not match its duration',
    path: ['endsAt'],
  })
export type LiveTimerState = z.infer<typeof liveTimerState>

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
 * whatever the block understands. The API holds it to the shape the block's player writes
 * (`liveBlockValueFits`) and leaves what it means to the block.
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** Whether a value is one a player writes at a given place on the board. */
type Fits = (value: unknown) => boolean

const isText: Fits = (value) => typeof value === 'string'
const isFlag: Fits = (value) => typeof value === 'boolean'
/** A count, or a moment on a clock: a whole number, never below zero. */
const isWhole: Fits = (value) => Number.isSafeInteger(value) && (value as number) >= 0
/** A position among `count` things. */
const below =
  (count: number): Fits =>
  (value) =>
    isWhole(value) && (value as number) < count
const oneOf =
  (allowed: readonly unknown[]): Fits =>
  (value) =>
    allowed.includes(value)
const textUpTo =
  (length: number): Fits =>
  (value) =>
    typeof value === 'string' && value.length <= length
const listOf =
  (fits: Fits, max: number): Fits =>
  (value) =>
    Array.isArray(value) && value.length <= max && value.every(fits)

/**
 * A list drawn from `pool`, each thing in it at most as often as the pool holds it: the
 * options ticked, the tokens laid down, the letters tried. A player can lay down only what
 * is still on the table, so a list that takes more cannot have come from one.
 */
const drawnFrom =
  (pool: readonly unknown[], max = pool.length): Fits =>
  (value) => {
    if (!Array.isArray(value) || value.length > max) return false

    const left = [...pool]
    return value.every((item) => {
      const at = left.indexOf(item)
      if (at === -1) return false
      left.splice(at, 1)
      return true
    })
  }

/** An object with no keys but these, each holding what its key says. */
const keyed =
  (shape: ReadonlyMap<string, Fits>): Fits =>
  (value) =>
    isRecord(value) && Object.entries(value).every(([key, held]) => shape.get(key)?.(held) ?? false)

/** One cell of a grid `size` wide, named the way the player names one. */
const cellOf = (size: number): Fits => {
  const inGrid = below(size)
  return (value) =>
    isRecord(value) && Object.keys(value).length === 2 && inGrid(value.r) && inGrid(value.c)
}

/**
 * What a block keeps on the board under `answers` or `ui`, as its player writes it: one
 * value only ever set whole, or parts set one at a time — so two people on different parts
 * of one block do not write over each other — each holding what its player puts in it.
 */
type LiveShape = { whole: Fits } | { parts: ReadonlyMap<string, Fits> }

const whole = (fits: Fits): LiveShape => ({ whole: fits })
/** One part per id, each holding the same kind of thing. */
const each = (ids: readonly string[], fits: Fits): LiveShape => ({
  parts: new Map(ids.map((id) => [id, fits])),
})
/** One part per item, each holding what that item takes. */
const byItem = <T extends { id: string }>(
  items: readonly T[],
  fits: (item: T) => Fits,
): LiveShape => ({ parts: new Map(items.map((item) => [item.id, fits(item)])) })
/** A small machine's state, by the keys its player sets. */
const machine = (state: Record<string, Fits>): LiveShape => ({
  parts: new Map(Object.entries(state)),
})
/**
 * A game against the clock: whether it has begun, which item is up — one past the last
 * once it is over — and the moment that item came up.
 */
const timedGame = (items: number) =>
  machine({ started: isFlag, index: below(items + 1), startedAt: isWhole })

const idsOf = (list: readonly { id: string }[]) => list.map((item) => item.id)
const gapIdsOf = (segments: readonly ({ kind: 'text' } | { kind: 'gap'; id: string })[]) =>
  segments.flatMap((segment) => (segment.kind === 'gap' ? [segment.id] : []))
const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']

/** The state each small machine keeps, by the keys its player sets. */
function uiShape(block: Block | StudentBlock): LiveShape | null {
  switch (block.type) {
    case 'flashcards':
      return machine({ index: below(block.cards.length), flipped: isFlag })
    case 'memory_match':
      return machine({
        // A card is named by its pair and its side, and two at most are face up at once.
        flipped: drawnFrom(
          block.pairs.flatMap((pair) => [`${pair.id}-a`, `${pair.id}-b`]),
          2,
        ),
        matched: drawnFrom(idsOf(block.pairs)),
        moves: isWhole,
      })
    case 'quiz_game':
      return timedGame(block.questions.length)
    case 'speed_round':
      return timedGame(block.items.length)
    case 'hangman':
      return machine({ guessed: drawnFrom(LETTERS) })
    case 'audio':
      return machine({ transcript: isFlag })
    default:
      return null
  }
}

/** What each block takes as its answer: whole, or one part per gap, pair, item or word. */
function answerShape(block: Block | StudentBlock): LiveShape | null {
  switch (block.type) {
    // A list or a text, set whole.
    case 'multiple_choice':
      return whole(drawnFrom(idsOf(block.options)))
    case 'sentence_builder':
      return whole(
        drawnFrom('tokens' in block ? block.tokens : [...block.correct, ...block.distractors]),
      )
    case 'dialogue_order':
      return whole(drawnFrom(idsOf(block.lines)))
    case 'highlight_words':
      return whole(drawnFrom(block.words.map((_, index) => index)))
    // Typed, so as long as a value on the board may be.
    case 'free_writing':
    case 'dictation':
      return whole(isText)
    case 'gap_fill':
      return each(gapIdsOf(block.segments), isText)
    case 'matching':
      // A left holds the text of the card put beside it: the cards carry no ids.
      return 'pairs' in block
        ? each(idsOf(block.pairs), oneOf(block.pairs.map((pair) => pair.right)))
        : each(idsOf(block.lefts), oneOf(block.rights))
    case 'categorize':
      return each(idsOf(block.items), oneOf(idsOf(block.categories)))
    case 'true_false':
      return each(idsOf(block.statements), isFlag)
    case 'quiz_game':
      return byItem(block.questions, (question) => oneOf(idsOf(question.options)))
    case 'word_search':
      // The cells swept across the grid, which run no longer than the grid is wide.
      return each(block.words, listOf(cellOf(block.size), block.size))
    case 'speed_round':
      return byItem(block.items, (item) =>
        keyed(new Map(gapIdsOf(item.segments).map((id) => [id, isText]))),
      )
    case 'anagram':
      // Laid from the word's own tiles, so never longer than the word.
      return byItem<(typeof block.items)[number]>(block.items, (item) =>
        textUpTo('word' in item ? item.word.length : item.letters.length),
      )
    case 'spot_mistake':
      return byItem(block.items, (item) => below(item.words.length))
    case 'crossword':
      return each(idsOf(block.entries), isText)
    // Practice and presentation: nothing to answer.
    case 'flashcards':
    case 'memory_match':
    case 'hangman':
    case 'reading':
    case 'heading':
    case 'text':
    case 'callout':
    case 'image':
    case 'audio':
    case 'video':
    case 'divider':
      return null
  }
}

const shapeOf = (block: Block | StudentBlock, root: 'answers' | 'ui') =>
  root === 'ui' ? uiShape(block) : answerShape(block)

/**
 * What a block keeps on the board under `answers` or `ui`, and in which pieces. Null means
 * nothing at all — a passage, a picture, an answer that is not a machine's. Otherwise the
 * keys a browser writes one at a time, so two people on different parts of one block do
 * not write over each other; an empty list means the value is only ever set whole.
 *
 * The players write these keys and the API takes nothing else, so a gesture always lands
 * and a link holder cannot fill the room's board with keys no block will ever read. Works
 * on the stored block and on the student's projection of it alike: the ids survive it.
 */
export function liveBlockParts(
  block: Block | StudentBlock,
  root: 'answers' | 'ui',
): readonly string[] | null {
  const shape = shapeOf(block, root)
  if (shape === null) return null

  return 'whole' in shape ? [] : [...shape.parts.keys()]
}

/**
 * Whether a value is one the block's player writes there: the block whole when `part` is
 * missing, or one of the parts it keeps. A block kept in parts is set whole only as an
 * object of those parts. Lists are drawn from the block's own options, tokens, lines and
 * letters, and run no longer than the block allows; typed text is as long as the board
 * takes. So a link holder can neither tuck keys no block reads inside a whole value nor
 * grow a list no player could have drawn, and a real gesture — made from a board that
 * holds only such values — always fits. Measured against the stored block or the
 * student's projection alike; a lesson cannot be edited while a room is open on it.
 */
export function liveBlockValueFits(
  block: Block | StudentBlock,
  root: 'answers' | 'ui',
  part: string | undefined,
  value: unknown,
): boolean {
  const shape = shapeOf(block, root)
  if (shape === null) return false
  if ('whole' in shape) return part === undefined && shape.whole(value)
  if (part === undefined) return keyed(shape.parts)(value)

  return shape.parts.get(part)?.(value) ?? false
}

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
  calendarLesson: { id: string; scheduledAt: string } | null
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
  /** API epoch at serialization, used to keep classroom clocks aligned across devices. */
  serverTime: number
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
  /** From a browser: the step this person is now looking at. */
  step: 'step',
  /**
   * From a browser: what it just asked the API to write, so the others can draw it now
   * rather than when the API's announcement arrives. A hint, never the truth.
   */
  hint: 'hint',
  /** From a browser: the text somebody has selected. */
  select: 'select',
  /** From a browser: the block, or the box in it, somebody is in. */
  focus: 'focus',
  /** From a browser: whether that participant currently has their hand raised. */
  hand: 'hand',
  /** From a browser: one short-lived classroom reaction. */
  reaction: 'reaction',
} as const

/** The invalidation shape the API broadcasts after a batch of changes landed. */
export type LiveBoardEvent = {
  version: number
  ops: BoardOp[]
  from?: string
}

/** The invalidation shape the API broadcasts after the step moved or the room closed. */
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

/* ------------------------------------------------------- classroom signals --- */

/**
 * Authenticated people use UUIDs and link guests use `guest-<uuid>`. The channel is
 * public, so these values are decorative presence claims rather than authorization.
 * The schema keeps both parts bounded and safe to draw.
 */
const liveParticipantId = z.string().min(1).max(80)
const liveConnectionId = z.uuid()

export const liveHandEvent = z.strictObject({
  id: liveParticipantId,
  connectionId: liveConnectionId,
  raised: z.boolean(),
})
export type LiveHandEvent = z.infer<typeof liveHandEvent>

export const LIVE_REACTIONS = ['thumbs_up', 'clap', 'heart', 'celebrate'] as const
export type LiveReactionKind = (typeof LIVE_REACTIONS)[number]

/** A receiver may accept at most one reaction per active browser connection in this interval. */
export const LIVE_REACTION_COOLDOWN_MS = 700

export const liveReactionEvent = z.strictObject({
  id: liveParticipantId,
  connectionId: liveConnectionId,
  eventId: z.uuid(),
  reaction: z.enum(LIVE_REACTIONS),
})
export type LiveReactionEvent = z.infer<typeof liveReactionEvent>

/**
 * Where somebody is now, and whom they follow. Sent on every turn of the page, once more
 * to each newcomer, and again on every rejoin.
 */
export type LiveStep = {
  id: string
  /** The presence connection it is sent from, as with a hand or a reaction. */
  connectionId: string
  stepId: string
  following: string | null
}

/**
 * Pointers, selections and focus carry the sender's presence connection the same way, so
 * a browser that never joined the room cannot speak in somebody else's name.
 */
export type LiveSender = { id: string; connectionId: string }

/** A browser's own changes, told to the others before the API confirms them. */
export type LiveHint = {
  ops: BoardOp[]
  from: string
}

/**
 * One piece of a selection: an element of the block, named by a fingerprint of the text it
 * holds rather than by where it sits, and offsets into that text.
 *
 * By the text, because the frame around a lesson — labels, buttons, hints — is written in
 * the reader's language and a screen may draw a control another screen does not, so
 * counting elements or characters from the top of a block would put the same words in two
 * different places.
 */
export type LiveSelectionPart = {
  /** A fingerprint of the element's text. */
  key: number
  /** How long that text is, so two unlike texts do not pass for one. */
  len: number
  /** Which of the block's identical texts this is. */
  nth: number
  start: number
  end: number
}

/** At most this many pieces travel; a longer selection is drawn as far as they go. */
export const SELECTION_PARTS_MAX = 12

/**
 * The text somebody has selected, in one piece per element it runs through — a selection
 * that runs from a question into an answer is two.
 */
export type LiveSelection = {
  stepId: string
  blockId: string
  parts: LiveSelectionPart[]
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

/** A host player command. Identity and timestamp are assigned by the API. */
export const setLiveMediaBody = z.strictObject({
  blockId: z.string().trim().min(1).max(64),
  kind: z.enum(['video', 'audio']),
  playing: z.boolean(),
  time: z
    .number()
    .finite()
    .min(0)
    .max(24 * 60 * 60),
  rate: z.number().finite().min(0.25).max(4),
})
export type SetLiveMediaBody = z.infer<typeof setLiveMediaBody>

/** The authenticated host command persisted on the room board. */
export const liveMediaState = setLiveMediaBody.extend({
  at: z.number().int().nonnegative(),
  from: z.string().min(1).max(80),
})

/** How far a player may drift from the room before it is pulled back, in seconds. */
export const MEDIA_DRIFT_S = { video: 1, audio: 0.5 } as const

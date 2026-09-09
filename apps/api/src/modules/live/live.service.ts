import {
  LIVE_EVENTS,
  liveChannelFor,
  BOARD_ROOM_KEY,
  type ApplyLiveOpsBody,
  type BoardOp,
  type GatherLiveBody,
  type LiveGather,
  type LiveBoard,
  type LiveBoardEvent,
  type LiveCheckBody,
  type LivePublicRoom,
  type LiveRoom,
  type LiveSession,
  type LiveSnapshot,
  type LiveStateEvent,
  type SetLiveStepBody,
  type StartLiveSessionBody,
  type StepCheckResult,
} from '@tp/shared'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../http/errors'
import { broadcast } from './announce.repository'
import { markStep } from '../materials/marking'
import { parseBlocks, toStudentMaterial } from '../materials/materials.mapper'
import { materialsRepository, type MaterialsRepository } from '../materials/materials.repository'
import { canRead, type Viewer } from '../materials/materials.service'
import {
  liveRepository,
  type LiveBoardRow,
  type LiveRepository,
  type LiveSessionRow,
} from './live.repository'

export type LiveServiceDeps = {
  live: LiveRepository
  materials: Pick<MaterialsRepository, 'findById' | 'stepsFor' | 'findStep'>
  /** How the room is told. Injected so a test can listen instead of Realtime. */
  announce: typeof broadcast
}

/** The board column, read as the shape every browser holds. */
const asBoard = (json: unknown): LiveBoard =>
  json && typeof json === 'object' && !Array.isArray(json) ? (json as LiveBoard) : {}

function toSnapshot(row: LiveSessionRow): LiveSnapshot {
  return {
    version: row.board_version,
    board: asBoard(row.board),
    currentStepId: row.current_step_id,
    status: row.status,
  }
}

export function toLiveSession(row: LiveSessionRow): LiveSession {
  return {
    id: row.id,
    status: row.status,
    material: {
      id: row.material?.id ?? row.material_id,
      title: row.material?.title ?? '',
      level: row.material?.level ?? 'A1',
      stepCount: row.material?.material_steps[0]?.count ?? 0,
    },
    teacher: row.teacher
      ? { id: row.teacher.id, fullName: row.teacher.full_name, email: row.teacher.email }
      : { id: row.teacher_id, fullName: null, email: '' },
    currentStepId: row.current_step_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  }
}

/** The name a person goes by in the room. */
function nameOf(row: { full_name: string | null; email: string } | null, fallback: string) {
  return row?.full_name ?? row?.email ?? fallback
}

export function createLiveService({ live, materials, announce }: LiveServiceDeps) {
  /** Everyone in the room hears that the board changed — from here, never from a browser. */
  const announceBoard = (sessionId: string, event: LiveBoardEvent) =>
    announce([{ topic: liveChannelFor(sessionId), event: LIVE_EVENTS.board, payload: event }])

  /** Everyone in the room hears that the step moved or the room closed. */
  const announceState = (sessionId: string, row: LiveSessionRow) => {
    const event: LiveStateEvent = {
      version: row.board_version,
      currentStepId: row.current_step_id,
      status: row.status,
    }

    return announce([
      { topic: liveChannelFor(sessionId), event: LIVE_EVENTS.state, payload: event },
    ])
  }

  /** Writes a batch to the board and tells the room. The room hears the same ops it sent. */
  async function change(sessionId: string, ops: BoardOp[], from?: string): Promise<LiveBoardRow> {
    const row = await live.applyOps(sessionId, ops)
    void announceBoard(sessionId, { version: row.version, ops, ...(from ? { from } : {}) })

    return row
  }

  /**
   * Who may be in the room. While it is open, whoever holds the link — the link is the
   * invitation, and a student the host forgot to attach should not be turned away at the
   * door in front of the class. Once it is over, only the host and an administrator may
   * still look at it. Anyone else is told there is no such room, which is the library's
   * rule too.
   */
  async function admitted(sessionId: string, viewer: Viewer): Promise<LiveSessionRow> {
    const row = await live.findById(sessionId)
    if (!row) throw new NotFoundError('No such live lesson')

    if (row.teacher_id === viewer.id || viewer.role === 'admin') return row
    if (row.status === 'active') return row

    throw new NotFoundError('No such live lesson')
  }

  /** An open room, for somebody who holds only its link. A closed one is not there. */
  async function open(sessionId: string): Promise<LiveSessionRow> {
    const row = await live.findById(sessionId)
    if (!row || row.status !== 'active') throw new NotFoundError('No such live lesson')

    return row
  }

  async function hosted(sessionId: string, viewer: Viewer): Promise<LiveSessionRow> {
    const row = await admitted(sessionId, viewer)

    if (row.teacher_id !== viewer.id) {
      throw new ForbiddenError('Only the teacher running this lesson can do that')
    }

    return row
  }

  return {
    /**
     * Opens a room on a lesson the teacher can see. A teacher runs one class at a time,
     * so any room they still have open is closed first rather than left as a ghost the
     * students' home page keeps inviting them into.
     */
    async start(body: StartLiveSessionBody, viewer: Viewer): Promise<LiveSession> {
      const material = await materials.findById(body.materialId)

      if (!material || material.deleted_at || !canRead(material, viewer)) {
        throw new NotFoundError('No such material')
      }

      // Closed the way a room is closed, so whoever is still in it hears so at once.
      const previous = await live.activeOf(viewer.id)
      if (previous) {
        const closed = await live.advance(previous.id, {
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        if (closed) void announceState(previous.id, closed)
      }
      await live.endAllOf(viewer.id)

      return toLiveSession(
        await live.insert({ material_id: body.materialId, teacher_id: viewer.id }),
      )
    },

    /** The host's open room, if any — so a lesson's page can say "continue" instead of "start". */
    async mine(viewer: Viewer): Promise<LiveSession | null> {
      const row = await live.activeOf(viewer.id)

      return row ? toLiveSession(row) : null
    },

    /** The rooms a student could walk into right now. */
    async joinable(viewer: Viewer): Promise<LiveSession[]> {
      return (await live.joinableBy(viewer.id)).map(toLiveSession)
    },

    /** Everything one person needs to be in the room, host or guest. */
    async room(sessionId: string, viewer: Viewer, me: { name: string }): Promise<LiveRoom> {
      const row = await admitted(sessionId, viewer)

      const material = await materials.findById(row.material_id)
      if (!material) throw new NotFoundError('The lesson behind this room is gone')

      const steps = await materials.stepsFor(row.material_id)

      return {
        session: toLiveSession(row),
        // The student's projection for everyone. The host is showing the lesson, not
        // marking it, and a room where one screen holds the answer key is a room where
        // one screen must never be shared.
        lesson: toStudentMaterial(material, steps),
        snapshot: toSnapshot(row),
        role: row.teacher_id === viewer.id ? 'host' : 'guest',
        me: { id: viewer.id, name: me.name },
      }
    },

    /**
     * The room for whoever holds the link and nothing else: the lesson as a student sees
     * it, and where the room stands. Their name is theirs to give in the browser.
     */
    async publicRoom(sessionId: string): Promise<LivePublicRoom> {
      const row = await open(sessionId)

      const material = await materials.findById(row.material_id)
      if (!material) throw new NotFoundError('The lesson behind this room is gone')

      const session = toLiveSession(row)

      return {
        // The teacher's name is the room's; their address is not for somebody with no
        // account and a forwarded link.
        session: { ...session, teacher: { ...session.teacher, email: '' } },
        lesson: toStudentMaterial(material, await materials.stepsFor(row.material_id)),
        snapshot: toSnapshot(row),
      }
    },

    /**
     * Where the room stands, whole. Answered for closed rooms too, because a browser that
     * was in the room when it closed asks this to learn that it did — but a closed room
     * hands over only that: what the class typed is not left on an open door for anyone
     * who finds the link later.
     */
    async snapshot(sessionId: string): Promise<LiveSnapshot> {
      const row = await live.findById(sessionId)
      if (!row) throw new NotFoundError('No such live lesson')

      const snapshot = toSnapshot(row)

      return row.status === 'active' ? snapshot : { ...snapshot, board: {} }
    },

    /**
     * A batch of changes to the shared board, from anyone in the room: an answer picked,
     * a card turned, a game begun. Only while the room is open, and only to the answers
     * and the state of blocks that are actually in the lesson: whoever holds the link may
     * work on the board, not rewrite the marks or plant something the players would
     * choke on. The API does not judge the values — a block understands its own — but it
     * is the only one who writes them, and the only one who says so.
     */
    async applyOps(sessionId: string, body: ApplyLiveOpsBody): Promise<LiveSnapshot> {
      const row = await open(sessionId)

      const blocksByStep = new Map(
        (await materials.stepsFor(row.material_id)).map((step) => [
          step.id,
          new Set(parseBlocks(step.blocks).map((block) => block.id)),
        ]),
      )
      const marked = asBoard(row.board).results ?? {}
      for (const op of body.ops) {
        // A block whole, or one part of it: answers.<step>.<block>[.<part>].
        const [root, stepId, blockId, ...deeper] = op.path
        const known = root === 'answers' || root === 'ui'
        const onBoard = stepId !== undefined && blockId !== undefined && deeper.length <= 1
        if (!known || !onBoard || !blocksByStep.get(stepId)?.has(blockId)) {
          throw new ValidationError('That is not a place on this board')
        }
        // Once a step is marked its answers are what was marked.
        if (root === 'answers' && marked[stepId]) {
          throw new ConflictError('This step has been marked')
        }
      }

      const applied = await change(row.id, body.ops, body.from)

      return {
        version: applied.version,
        board: asBoard(applied.board),
        currentStepId: applied.current_step_id,
        status: applied.status,
      }
    },

    /**
     * Marks a step and writes the marks to the board, so that everyone in the room sees
     * the same ticks and crosses and nobody can answer that step any more. The host's
     * call, since it locks everybody's answers — and the marks say things about the
     * answer key that a guest with the link has no business asking. The answers marked
     * are the room's, as the host's browser held them.
     */
    async check(sessionId: string, body: LiveCheckBody, viewer: Viewer): Promise<StepCheckResult> {
      const row = await hosted(sessionId, viewer)
      if (row.status !== 'active') throw new ConflictError('This live lesson has ended')

      const step = await materials.findStep(row.material_id, body.stepId)
      if (!step) throw new NotFoundError('No such step')

      // The board's own answers, as they stand this instant, over what the host's screen
      // showed: a tap that landed a moment ago, whose announcement is still on its way to
      // the host, is not lost for being late.
      const answers = { ...body.answers, ...(asBoard(row.board).answers?.[body.stepId] ?? {}) }
      const result = markStep(parseBlocks(step.blocks), answers)

      await change(row.id, [
        { t: 'set', path: ['answers', body.stepId], value: answers },
        { t: 'set', path: ['results', body.stepId], value: result },
      ])

      return result
    },

    /** The host moved. Remembered so that a late joiner, or a refresh, lands on the same step. */
    async setStep(sessionId: string, body: SetLiveStepBody, viewer: Viewer): Promise<LiveSession> {
      const row = await hosted(sessionId, viewer)

      if (row.status !== 'active') throw new ConflictError('This live lesson has ended')

      const step = await materials.findStep(row.material_id, body.stepId)
      if (!step) throw new NotFoundError('No such step')

      const updated = await live.advance(row.id, { current_step_id: body.stepId })
      if (!updated) throw new NotFoundError('No such live lesson')

      void announceState(row.id, updated)

      return toLiveSession(updated)
    },

    /**
     * The host calls everyone to a step. Written to the board rather than shouted on the
     * channel, because the channel is open to whoever holds the link and a call that
     * moves a whole class must come from the one person allowed to make it.
     */
    async gather(sessionId: string, body: GatherLiveBody, viewer: Viewer): Promise<LiveGather> {
      const row = await hosted(sessionId, viewer)
      if (row.status !== 'active') throw new ConflictError('This live lesson has ended')

      const step = await materials.findStep(row.material_id, body.stepId)
      if (!step) throw new NotFoundError('No such step')

      const call: LiveGather = { stepId: body.stepId, at: Date.now() }
      await change(row.id, [{ t: 'set', path: ['ui', BOARD_ROOM_KEY, 'gather'], value: call }])

      return call
    },

    async end(sessionId: string, viewer: Viewer): Promise<LiveSession> {
      const row = await hosted(sessionId, viewer)

      if (row.status !== 'active') throw new ConflictError('This live lesson has already ended')

      const updated = await live.advance(row.id, {
        status: 'ended',
        ended_at: new Date().toISOString(),
      })
      if (!updated) throw new NotFoundError('No such live lesson')

      void announceState(row.id, updated)

      return toLiveSession(updated)
    },
  }
}

export type LiveService = ReturnType<typeof createLiveService>

export const liveService = createLiveService({
  live: liveRepository,
  materials: materialsRepository,
  announce: broadcast,
})

export { nameOf }

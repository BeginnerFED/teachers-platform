import { randomUUID } from 'node:crypto'
import {
  LIVE_EVENTS,
  liveBlockParts,
  liveBlockValueFits,
  liveChannelFor,
  liveTimerState,
  BOARD_ROOM_KEY,
  type ApplyLiveOpsBody,
  type BoardOp,
  type GatherLiveBody,
  type LiveGather,
  type LiveMedia,
  type LiveBoard,
  type LiveBoardEvent,
  type LiveCheckBody,
  type LivePublicRoom,
  type LiveRoom,
  type LiveSession,
  type RecentLiveMaterial,
  type LiveSnapshot,
  type LiveStateEvent,
  type SetLiveStepBody,
  type StartLiveSessionBody,
  type HostedLiveSession,
  type StudentLiveInvitation,
  type StepCheckResult,
  type SetLiveTimerBody,
  type SetLiveMediaBody,
  type LiveTimerState,
} from '@tp/shared'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../http/errors'
import { broadcast } from './announce.repository'
import { toLiveSession } from './live.mapper'
import {
  liveInvitationsRepository,
  type LiveInvitationsRepository,
} from './live-invitations.repository'
import { markStep } from '../materials/marking'
import { assertHostAccess } from '../subscriptions/teaching-access'
import { parseBlocks, toStudentMaterial } from '../materials/materials.mapper'
import { materialsRepository, type MaterialsRepository } from '../materials/materials.repository'
import { canRead, type Viewer } from '../materials/materials.service'
import {
  liveRepository,
  type LiveBoardRow,
  type LiveBoardGuards,
  type LiveRepository,
  type LiveSessionRow,
} from './live.repository'

export type LiveServiceDeps = {
  live: LiveRepository
  materials: Pick<MaterialsRepository, 'findById' | 'stepsFor' | 'findStep'>
  /** How the room is told. Injected so a test can listen instead of Realtime. */
  announce: typeof broadcast
  invitations: LiveInvitationsRepository
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
    serverTime: Date.now(),
  }
}

/** The name a person goes by in the room. */
function nameOf(row: { full_name: string | null; email: string } | null, fallback: string) {
  return row?.full_name ?? row?.email ?? fallback
}

export function createLiveService({ live, materials, announce, invitations }: LiveServiceDeps) {
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

  /**
   * Writes a batch to the board and tells the room. The room hears the same ops it sent.
   *
   * The announcement is waited for, within its own short bound, before anything answers:
   * a serverless function may be frozen the moment its response is sent, and a message
   * still on its way would then reach the room only with the next poll. Broadcast absorbs
   * a failed delivery, because the database write has already won.
   */
  async function change(
    sessionId: string,
    ops: BoardOp[],
    from?: string,
    guards?: LiveBoardGuards,
  ): Promise<LiveBoardRow> {
    const row = await live.applyOps(sessionId, ops, guards)
    await announceBoard(sessionId, {
      version: row.version,
      ops,
      ...(from ? { from } : {}),
    })

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
    if (row.status === 'active') {
      await assertHostAccess(row.teacher_id)
      return row
    }

    throw new NotFoundError('No such live lesson')
  }

  /** An open room, for somebody who holds only its link. A closed one is not there. */
  async function open(sessionId: string): Promise<LiveSessionRow> {
    const row = await live.findById(sessionId)
    if (!row || row.status !== 'active') throw new NotFoundError('No such live lesson')

    await assertHostAccess(row.teacher_id)

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
      // The RPC checks both versions under its lock and recognizes an identical
      // calendar launch retried after a lost response.
      const id = await invitations.start({
        teacherId: viewer.id,
        materialId: body.materialId,
        expectedId: body.expectedActiveSessionId ?? null,
        checkExpected: body.expectedActiveSessionId !== undefined,
        studentIds: body.studentIds,
        lessonId: body.lessonId,
        expectedLessonUpdatedAt: body.expectedLessonUpdatedAt,
        newLesson: body.newLesson,
      })
      if (previous && previous.id !== id) {
        const closed = await live.findById(previous.id)
        if (closed) await announceState(previous.id, closed)
      }
      const opened = await live.findById(id)
      if (!opened) throw new NotFoundError('The new live lesson is unavailable')
      return toLiveSession(opened)
    },

    /** The host's open room, if any — so a lesson's page can say "continue" instead of "start". */
    async mine(viewer: Viewer): Promise<HostedLiveSession | null> {
      const row = await live.activeOf(viewer.id)

      return row ? { ...toLiveSession(row), invitations: await invitations.forHost(row.id) } : null
    },

    async recentMaterials(viewer: Viewer): Promise<RecentLiveMaterial[]> {
      const rows = await live.recentMaterialsOf(viewer.id, 40)
      const seen = new Set<string>()
      const result: RecentLiveMaterial[] = []
      for (const { material, started_at } of rows) {
        if (!material || material.deleted_at || seen.has(material.id)) continue
        if (
          material.owner_id !== viewer.id &&
          !(material.visibility === 'platform' && material.status === 'published')
        )
          continue
        seen.add(material.id)
        result.push({
          material: {
            id: material.id,
            title: material.title,
            level: material.level,
            stepCount: material.material_steps[0]?.count ?? 0,
          },
          lastUsedAt: started_at,
        })
        if (result.length === 6) break
      }
      return result
    },

    /** The rooms a student could walk into right now. */
    async joinable(viewer: Viewer): Promise<LiveSession[]> {
      return (await invitations.forStudent(viewer.id)).map((invitation) => invitation.session)
    },

    studentInvitations(viewer: Viewer): Promise<StudentLiveInvitation[]> {
      return invitations.forStudent(viewer.id)
    },

    async readInvitations(sessionIds: string[], viewer: Viewer): Promise<void> {
      await invitations.read(viewer.id, sessionIds)
    },

    async respondToInvitation(
      sessionId: string,
      response: 'joined' | 'declined',
      viewer: Viewer,
    ): Promise<void> {
      const row = await live.findById(sessionId)
      if (!row || row.status !== 'active') throw new NotFoundError('This lesson has ended')
      if (!(await invitations.respond(viewer.id, sessionId, response)))
        throw new NotFoundError('No invitation to this lesson')
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
      if (row.status === 'active') await assertHostAccess(row.teacher_id)

      const snapshot = toSnapshot(row)

      return row.status === 'active' ? snapshot : { ...snapshot, board: {} }
    },

    /**
     * A batch of changes to the shared board, from anyone in the room: an answer picked,
     * a card turned, a game begun. Only while the room is open, and only to the answers
     * and the state that blocks in the lesson actually keep, in the shape their players
     * write them: whoever holds the link may work on the board, not rewrite the marks,
     * plant something the players would choke on, or fill the room's board with keys no
     * block will ever read. The API does not mark the values — that is the host's call —
     * but it is the only one who writes them, and the only one who says so.
     */
    async applyOps(sessionId: string, body: ApplyLiveOpsBody): Promise<LiveSnapshot> {
      const row = await open(sessionId)

      const blocksByStep = new Map(
        (await materials.stepsFor(row.material_id)).map((step) => [
          step.id,
          new Map(parseBlocks(step.blocks).map((block) => [block.id, block])),
        ]),
      )
      const marked = asBoard(row.board).results ?? {}
      for (const op of body.ops) {
        // A block whole, or one of the parts it keeps: answers.<step>.<block>[.<part>].
        // Clearing can only shrink the board, so any part of a block that keeps parts may
        // be cleared — a key left behind earlier must not make a player's reset fail.
        const [root, stepId = '', blockId = '', part, ...deeper] = op.path
        const block = blocksByStep.get(stepId)?.get(blockId)
        if (!block || (root !== 'answers' && root !== 'ui')) {
          throw new ValidationError('That is not a place on this board')
        }
        const parts = liveBlockParts(block, root)
        const placed =
          parts !== null &&
          deeper.length === 0 &&
          (part === undefined || parts.includes(part) || (op.t === 'unset' && parts.length > 0))
        if (!placed) {
          throw new ValidationError('That is not a place on this board')
        }
        // What is set there is what the block's player sets there: a whole value carries
        // no key the block does not keep, and no list runs longer than a player could
        // draw. How large one block may grow altogether is the database's to hold.
        if (op.t === 'set' && !liveBlockValueFits(block, root, part, op.value)) {
          throw new ValidationError('That is not what this block keeps')
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
        serverTime: Date.now(),
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
      let row = await hosted(sessionId, viewer)
      if (row.status !== 'active') throw new ConflictError('This live lesson has ended')

      const step = await materials.findStep(row.material_id, body.stepId)
      if (!step) throw new NotFoundError('No such step')

      // Grade the exact board revision committed by the RPC. If a student's answer lands
      // during marking, re-read and grade that newer revision instead of locking stale work.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (row.status !== 'active') throw new ConflictError('This live lesson has ended')
        if (asBoard(row.board).results?.[body.stepId]) {
          throw new ConflictError('This step has already been marked')
        }
        const answers = { ...body.answers, ...(asBoard(row.board).answers?.[body.stepId] ?? {}) }
        // Marking locks the step for the whole room, so nobody can answer it any more and every
        // correction can be shown, as the board always did.
        const result = markStep(parseBlocks(step.blocks), answers, true)

        try {
          await change(
            row.id,
            [
              { t: 'set', path: ['answers', body.stepId], value: answers },
              { t: 'set', path: ['results', body.stepId], value: result },
            ],
            undefined,
            { expectedVersion: row.board_version, markedStepId: body.stepId },
          )
          return result
        } catch (error) {
          if (!(error instanceof ConflictError) || attempt === 2) throw error
          const latest = await live.findById(row.id)
          if (!latest) throw new NotFoundError('No such live lesson')
          row = latest
        }
      }
      throw new ConflictError('The live board changed')
    },

    /**
     * The host moved. Remembered so that a late joiner, or a refresh, lands on the same step.
     * Answered with the board version the move landed at: the host's other screens move
     * too, and this one must be able to tell a snapshot read before its move from one read
     * after it.
     */
    async setStep(
      sessionId: string,
      body: SetLiveStepBody,
      viewer: Viewer,
    ): Promise<LiveSession & Pick<LiveSnapshot, 'version'>> {
      const row = await hosted(sessionId, viewer)

      if (row.status !== 'active') throw new ConflictError('This live lesson has ended')

      const step = await materials.findStep(row.material_id, body.stepId)
      if (!step) throw new NotFoundError('No such step')

      const transition = await live.setStepActive(row.id, body.stepId)
      if (!transition) throw new NotFoundError('No such live lesson')
      const updated: LiveSessionRow = {
        ...row,
        board_version: transition.version,
        current_step_id: transition.current_step_id,
        status: transition.status,
        ended_at: transition.ended_at,
      }

      await announceState(row.id, updated)

      return { ...toLiveSession(updated), version: updated.board_version }
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

    /**
     * Starts or clears the classroom timer. It lives under the room's existing board so
     * late joiners and reconnecting browsers see the same deadline. Only this host API
     * writes it; direct browser broadcasts can never impersonate the teacher's timer.
     */
    async setTimer(
      sessionId: string,
      body: SetLiveTimerBody,
      viewer: Viewer,
    ): Promise<LiveTimerState | null> {
      const row = await hosted(sessionId, viewer)
      if (row.status !== 'active') throw new ConflictError('This live lesson has ended')
      const parsedTimer = liveTimerState.safeParse(asBoard(row.board).ui?.[BOARD_ROOM_KEY]?.timer)
      const currentTimer = parsedTimer.success ? parsedTimer.data : null

      if (body.action === 'stop') {
        if (currentTimer?.id !== body.timerId) {
          throw new ConflictError('The classroom timer has already changed')
        }
        await change(row.id, [{ t: 'unset', path: ['ui', BOARD_ROOM_KEY, 'timer'] }], undefined, {
          guardTimer: true,
          expectedTimerId: body.timerId,
        })
        return null
      }

      if ((currentTimer?.id ?? null) !== body.expectedTimerId) {
        throw new ConflictError('The classroom timer has already changed')
      }

      const startedAt = Date.now()
      const timer: LiveTimerState = {
        id: randomUUID(),
        durationSeconds: body.durationSeconds,
        startedAt,
        endsAt: startedAt + body.durationSeconds * 1_000,
      }
      await change(
        row.id,
        [{ t: 'set', path: ['ui', BOARD_ROOM_KEY, 'timer'], value: timer }],
        undefined,
        { guardTimer: true, expectedTimerId: body.expectedTimerId },
      )

      return timer
    },

    /**
     * The host controls shared playback through the authenticated API. Keeping the latest
     * command on the board makes it verifiable and lets a late joiner catch up without
     * trusting a browser broadcast that can claim somebody else's id.
     */
    async setMedia(sessionId: string, body: SetLiveMediaBody, viewer: Viewer): Promise<LiveMedia> {
      const row = await hosted(sessionId, viewer)
      if (row.status !== 'active') throw new ConflictError('This live lesson has ended')

      const found = (await materials.stepsFor(row.material_id))
        .flatMap((step) => parseBlocks(step.blocks))
        .find((block) => block.id === body.blockId)
      const matches =
        found?.type === body.kind ||
        (body.kind === 'audio' && found?.type === 'reading' && Boolean(found.audioAssetId))
      if (!matches) throw new NotFoundError('No such media block')

      const media: LiveMedia = { ...body, from: viewer.id, at: Date.now() }
      await change(row.id, [{ t: 'set', path: ['ui', BOARD_ROOM_KEY, 'media'], value: media }])
      return media
    },

    async end(sessionId: string, viewer: Viewer): Promise<LiveSession> {
      const row = await hosted(sessionId, viewer)

      if (row.status !== 'active') return toLiveSession(row)

      const transition = await live.end(row.id)
      if (!transition) throw new NotFoundError('No such live lesson')
      const updated: LiveSessionRow = {
        ...row,
        board_version: transition.version,
        current_step_id: transition.current_step_id,
        status: transition.status,
        ended_at: transition.ended_at,
      }

      await announceState(row.id, updated)

      return toLiveSession(updated)
    },
  }
}

export type LiveService = ReturnType<typeof createLiveService>

export const liveService = createLiveService({
  live: liveRepository,
  materials: materialsRepository,
  announce: broadcast,
  invitations: liveInvitationsRepository,
})

export { nameOf }

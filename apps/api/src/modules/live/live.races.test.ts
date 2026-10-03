import { describe, expect, it, vi } from 'vitest'
import { ConflictError } from '../../http/errors'
import type { MaterialsRepository, MaterialStepRow } from '../materials/materials.repository'
import type { LiveInvitationsRepository } from './live-invitations.repository'
import type { LiveRepository, LiveSessionRow } from './live.repository'
import { createLiveService } from './live.service'

const initial = {
  id: 'room',
  teacher_id: 'teacher',
  material_id: 'material',
  status: 'active',
  board: {},
  board_version: 4,
} as LiveSessionRow

function service(live: LiveRepository, materials?: MaterialsRepository) {
  return createLiveService({
    live,
    materials:
      materials ??
      ({
        findStep: vi
          .fn()
          .mockResolvedValue({ id: 'step', blocks: [] } as unknown as MaterialStepRow),
      } as unknown as MaterialsRepository),
    invitations: {} as LiveInvitationsRepository,
    announce: vi.fn().mockResolvedValue(undefined),
  })
}

describe('live board concurrency', () => {
  it('marks the answer that arrived while the teacher was checking', async () => {
    const latest = {
      ...initial,
      board_version: 5,
      board: { answers: { step: { choice: 'new answer' } } },
    } as LiveSessionRow
    const live = {
      findById: vi.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(latest),
      applyOps: vi
        .fn()
        .mockRejectedValueOnce(new ConflictError('The live board changed'))
        .mockResolvedValueOnce({ version: 6, board: latest.board, status: 'active' }),
    } as unknown as LiveRepository

    await service(live).check(
      initial.id,
      { stepId: 'step', answers: { choice: 'old answer' } },
      { id: 'teacher', role: 'teacher' },
    )

    expect(live.applyOps).toHaveBeenNthCalledWith(
      2,
      initial.id,
      expect.arrayContaining([
        expect.objectContaining({ path: ['answers', 'step'], value: { choice: 'new answer' } }),
      ]),
      { expectedVersion: 5, markedStepId: 'step' },
    )
  })

  it('passes the timer expected id to the locked board write', async () => {
    const live = {
      findById: vi.fn().mockResolvedValue(initial),
      applyOps: vi.fn().mockResolvedValue({ version: 5, board: {}, status: 'active' }),
    } as unknown as LiveRepository

    await service(live).setTimer(
      initial.id,
      { action: 'start', durationSeconds: 60, expectedTimerId: null },
      { id: 'teacher', role: 'teacher' },
    )

    expect(live.applyOps).toHaveBeenCalledWith(initial.id, expect.any(Array), {
      guardTimer: true,
      expectedTimerId: null,
    })
  })

  it('publishes only a real media block through the host board', async () => {
    const live = {
      findById: vi.fn().mockResolvedValue(initial),
      applyOps: vi.fn().mockResolvedValue({ version: 5, board: {}, status: 'active' }),
    } as unknown as LiveRepository
    const materials = {
      stepsFor: vi.fn().mockResolvedValue([
        {
          blocks: [{ id: 'class-audio', type: 'audio', assetId: crypto.randomUUID() }],
        } as unknown as MaterialStepRow,
      ]),
    } as unknown as MaterialsRepository

    const result = await service(live, materials).setMedia(
      initial.id,
      { blockId: 'class-audio', kind: 'audio', playing: true, time: 3, rate: 1 },
      { id: 'teacher', role: 'teacher' },
    )

    expect(result).toMatchObject({ blockId: 'class-audio', from: 'teacher', playing: true })
    expect(live.applyOps).toHaveBeenCalledWith(
      initial.id,
      [expect.objectContaining({ path: ['ui', 'room', 'media'] })],
      undefined,
    )
  })

  it('moves the class through the guarded session transition', async () => {
    const live = {
      findById: vi.fn().mockResolvedValue(initial),
      setStepActive: vi.fn().mockResolvedValue({
        version: 5,
        current_step_id: 'step',
        status: 'active',
        ended_at: null,
      }),
    } as unknown as LiveRepository

    const result = await service(live).setStep(
      initial.id,
      { stepId: 'step' },
      { id: 'teacher', role: 'teacher' },
    )

    expect(live.setStepActive).toHaveBeenCalledWith(initial.id, 'step')
    // The version lets the host's browser tell a snapshot read before the move from one after.
    expect(result).toMatchObject({ currentStepId: 'step', status: 'active', version: 5 })
  })

  it('answers a move and an end only once the room has been told', async () => {
    // A serverless function may be frozen as soon as it answers; a message still on its
    // way would reach the class with the next poll instead of now.
    const told: string[] = []
    const announce = vi.fn(
      (messages: { payload: unknown }[]) =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            told.push(JSON.stringify(messages[0]?.payload))
            resolve()
          }, 20),
        ),
    )
    const transition = { version: 5, current_step_id: 'step', status: 'active', ended_at: null }
    const live = {
      findById: vi.fn().mockResolvedValue(initial),
      setStepActive: vi.fn().mockResolvedValue(transition),
      end: vi.fn().mockResolvedValue({ ...transition, version: 6, status: 'ended' }),
    } as unknown as LiveRepository
    const rooms = createLiveService({
      live,
      materials: {
        findStep: vi.fn().mockResolvedValue({ id: 'step', blocks: [] }),
      } as unknown as MaterialsRepository,
      invitations: {} as LiveInvitationsRepository,
      announce,
    })
    const teacher = { id: 'teacher', role: 'teacher' } as const

    await rooms.setStep(initial.id, { stepId: 'step' }, teacher)
    expect(told).toHaveLength(1)

    await rooms.end(initial.id, teacher)
    expect(told).toHaveLength(2)
    expect(told[1]).toContain('"status":"ended"')
  })

  it('ends the class through the atomic session transition', async () => {
    const endedAt = '2026-09-22T12:00:00.000Z'
    const live = {
      findById: vi.fn().mockResolvedValue(initial),
      end: vi.fn().mockResolvedValue({
        version: 5,
        current_step_id: null,
        status: 'ended',
        ended_at: endedAt,
      }),
    } as unknown as LiveRepository

    const result = await service(live).end(initial.id, { id: 'teacher', role: 'teacher' })

    expect(live.end).toHaveBeenCalledWith(initial.id)
    expect(result).toMatchObject({ status: 'ended', endedAt })
  })
})

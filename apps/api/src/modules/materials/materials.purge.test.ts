import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AssetsRepository } from '../assets/assets.repository'
import type { AssignmentsRepository } from '../assignments/assignments.repository'
import type { LiveRepository } from '../live/live.repository'
import { logger } from '../../lib/logger'
import type { MaterialRow, MaterialsRepository } from './materials.repository'
import { createMaterialsService } from './materials.service'

afterEach(() => vi.restoreAllMocks())

describe('purging a binned lesson', () => {
  it('keeps its files if a restore wins the race', async () => {
    const row = {
      id: 'material',
      owner_id: 'teacher',
      deleted_at: '2026-09-20T10:00:00.000Z',
    } as MaterialRow
    const materials = {
      listBinned: vi.fn().mockResolvedValue([row]),
      leasePurgeJobs: vi.fn().mockResolvedValue([]),
      claimBinnedForPurge: vi.fn().mockResolvedValue(false),
    } as unknown as MaterialsRepository
    const assets = {
      deleteFolder: vi.fn(),
    } as unknown as AssetsRepository

    const service = createMaterialsService({
      materials,
      assets,
      assignments: {} as AssignmentsRepository,
      live: {} as LiveRepository,
    })

    await expect(
      service.purgeBinned({ materialIds: ['material'] }, { id: 'teacher', role: 'teacher' }),
    ).resolves.toEqual({ deleted: 0 })
    expect(materials.claimBinnedForPurge).toHaveBeenCalledWith(row.id, row.owner_id, row.deleted_at)
    expect(assets.deleteFolder).not.toHaveBeenCalled()
  })

  it('checks frozen-homework references after the database claim commits', async () => {
    const row = {
      id: 'material',
      owner_id: 'teacher',
      deleted_at: '2026-09-20T10:00:00.000Z',
    } as MaterialRow
    const job = {
      material_id: row.id,
      owner_id: row.owner_id,
      attempts: 0,
      created_at: new Date().toISOString(),
      lease_token: 'lease',
    }
    const materials = {
      listBinned: vi.fn().mockResolvedValue([row]),
      leasePurgeJobs: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([job]),
      claimBinnedForPurge: vi.fn().mockResolvedValue(true),
      preparePurgeJob: vi.fn().mockResolvedValue(['material/asset.png']),
      deferPurgeJob: vi.fn(),
      finishPurgeJob: vi.fn(),
    } as unknown as MaterialsRepository
    const assets = {
      deleteFolder: vi.fn().mockResolvedValue(0),
    } as unknown as AssetsRepository

    const service = createMaterialsService({
      materials,
      assets,
      assignments: {} as AssignmentsRepository,
      live: {} as LiveRepository,
    })

    await expect(
      service.purgeBinned({ materialIds: ['material'] }, { id: 'teacher', role: 'teacher' }),
    ).resolves.toEqual({ deleted: 1 })
    expect(materials.preparePurgeJob).toHaveBeenCalledWith(job)
    expect(assets.deleteFolder).toHaveBeenCalledWith(row.id, ['material/asset.png'])
    expect(materials.deferPurgeJob).toHaveBeenCalledWith(job, expect.any(String))
    expect(materials.finishPurgeJob).not.toHaveBeenCalled()
  })

  it('keeps a durable cleanup job when Storage is temporarily unavailable', async () => {
    const row = {
      id: 'material',
      owner_id: 'teacher',
      deleted_at: '2026-09-20T10:00:00.000Z',
    } as MaterialRow
    const job = {
      material_id: row.id,
      owner_id: row.owner_id,
      attempts: 0,
      created_at: new Date().toISOString(),
      lease_token: 'lease',
    }
    const materials = {
      listBinned: vi.fn().mockResolvedValue([row]),
      leasePurgeJobs: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([job]),
      claimBinnedForPurge: vi.fn().mockResolvedValue(true),
      preparePurgeJob: vi.fn().mockResolvedValue([]),
      deferPurgeJob: vi.fn(),
      finishPurgeJob: vi.fn(),
    } as unknown as MaterialsRepository
    const assets = {
      deleteFolder: vi.fn().mockRejectedValue(new Error('storage unavailable')),
    } as unknown as AssetsRepository
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined)

    const service = createMaterialsService({
      materials,
      assets,
      assignments: {} as AssignmentsRepository,
      live: {} as LiveRepository,
    })

    await expect(
      service.purgeBinned({ materialIds: ['material'] }, { id: 'teacher', role: 'teacher' }),
    ).resolves.toEqual({ deleted: 1 })
    expect(materials.deferPurgeJob).toHaveBeenCalledWith(
      job,
      expect.any(String),
      'storage unavailable',
    )
    expect(materials.finishPurgeJob).not.toHaveBeenCalled()
  })

  it('finishes a leased job only after Storage confirms the folder is clean', async () => {
    const row = {
      id: 'material',
      owner_id: 'teacher',
      deleted_at: '2026-09-20T10:00:00.000Z',
    } as MaterialRow
    const job = {
      material_id: row.id,
      owner_id: row.owner_id,
      attempts: 2,
      created_at: new Date(Date.now() - 5 * 60 * 60_000).toISOString(),
      lease_token: 'lease',
    }
    const materials = {
      listBinned: vi.fn().mockResolvedValue([row]),
      leasePurgeJobs: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([job]),
      claimBinnedForPurge: vi.fn().mockResolvedValue(true),
      preparePurgeJob: vi.fn().mockResolvedValue([]),
      deferPurgeJob: vi.fn(),
      finishPurgeJob: vi.fn().mockResolvedValue(true),
    } as unknown as MaterialsRepository
    const assets = {
      deleteFolder: vi.fn().mockResolvedValue(3),
    } as unknown as AssetsRepository

    const service = createMaterialsService({
      materials,
      assets,
      assignments: {} as AssignmentsRepository,
      live: {} as LiveRepository,
    })

    await expect(
      service.purgeBinned({ materialIds: ['material'] }, { id: 'teacher', role: 'teacher' }),
    ).resolves.toEqual({ deleted: 1 })
    expect(materials.preparePurgeJob).toHaveBeenCalledWith(job)
    expect(assets.deleteFolder).toHaveBeenCalledWith(row.id, [])
    expect(materials.finishPurgeJob).toHaveBeenCalledWith(job)
    expect(materials.deferPurgeJob).not.toHaveBeenCalled()
  })

  it('keeps one delayed sweep for uploads signed shortly before deletion', async () => {
    const row = {
      id: 'material',
      owner_id: 'teacher',
      deleted_at: '2026-09-22T09:00:00.000Z',
    } as MaterialRow
    const job = {
      material_id: row.id,
      owner_id: row.owner_id,
      attempts: 0,
      created_at: new Date().toISOString(),
      lease_token: 'lease',
    }
    const materials = {
      listBinned: vi.fn().mockResolvedValue([row]),
      leasePurgeJobs: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([job]),
      claimBinnedForPurge: vi.fn().mockResolvedValue(true),
      preparePurgeJob: vi.fn().mockResolvedValue([]),
      deferPurgeJob: vi.fn().mockResolvedValue(true),
      finishPurgeJob: vi.fn(),
    } as unknown as MaterialsRepository
    const assets = { deleteFolder: vi.fn().mockResolvedValue(0) } as unknown as AssetsRepository

    const service = createMaterialsService({
      materials,
      assets,
      assignments: {} as AssignmentsRepository,
      live: {} as LiveRepository,
    })

    await expect(
      service.purgeBinned({ materialIds: ['material'] }, { id: 'teacher', role: 'teacher' }),
    ).resolves.toEqual({ deleted: 1 })
    expect(materials.deferPurgeJob).toHaveBeenCalledWith(job, expect.any(String))
    expect(materials.finishPurgeJob).not.toHaveBeenCalled()
  })
})

describe('editing a lesson used by an open room', () => {
  it('stops the edit before writing while the class is active', async () => {
    const row = { id: 'material', owner_id: 'teacher', deleted_at: null } as MaterialRow
    const materials = {
      findById: vi.fn().mockResolvedValue(row),
      update: vi.fn(),
    } as unknown as MaterialsRepository
    const live = {
      isMaterialActive: vi.fn().mockResolvedValue(true),
    } as unknown as LiveRepository
    const service = createMaterialsService({
      materials,
      assets: {} as AssetsRepository,
      assignments: {} as AssignmentsRepository,
      live,
    })

    await expect(
      service.update('material', { title: 'Changed' }, { id: 'teacher', role: 'teacher' }),
    ).rejects.toMatchObject({ code: 'conflict' })
    expect(materials.update).not.toHaveBeenCalled()
  })
})

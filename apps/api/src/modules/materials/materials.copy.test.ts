import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AssetRow, AssetsRepository } from '../assets/assets.repository'
import type { LiveRepository } from '../live/live.repository'
import { logger } from '../../lib/logger'
import type { MaterialRow, MaterialStepRow, MaterialsRepository } from './materials.repository'
import { createMaterialsService } from './materials.service'

const source = {
  id: 'source',
  owner_id: 'platform-admin',
  deleted_at: null,
  visibility: 'platform',
  status: 'published',
  title: 'Holidays',
  description: null,
  level: 'A2',
  tags: [],
  material_steps: [{ count: 1 }],
} as unknown as MaterialRow

const copy = { ...source, id: 'copy', owner_id: 'teacher', visibility: 'private' } as MaterialRow

const step = {
  id: 'step',
  material_id: source.id,
  position: 0,
  title: 'Look',
  blocks: [{ id: 'picture', type: 'image', assetId: 'asset', alt: 'A beach' }],
} as unknown as MaterialStepRow

const picture = {
  id: 'asset',
  material_id: source.id,
  path: 'source/asset.png',
  kind: 'image',
  mime_type: 'image/png',
  size_bytes: 10,
  file_name: 'beach.png',
} as AssetRow

afterEach(() => vi.restoreAllMocks())

function setup(assets: Partial<AssetsRepository>) {
  const materials = {
    findById: vi.fn(async (id: string) => (id === source.id ? source : copy)),
    insert: vi.fn().mockResolvedValue(copy),
    stepsFor: vi.fn().mockResolvedValue([step]),
    insertSteps: vi.fn(),
    update: vi.fn().mockResolvedValue(copy),
    deleteCopy: vi.fn(),
  } as unknown as MaterialsRepository
  const repository = {
    listFor: vi.fn().mockResolvedValue([picture]),
    insert: vi.fn(),
    deleteFolder: vi.fn().mockResolvedValue(1),
    ...assets,
  } as unknown as AssetsRepository
  const service = createMaterialsService({
    materials,
    assets: repository,
    live: {} as LiveRepository,
  })

  return { service, materials, assets: repository }
}

const teacher = { id: 'teacher', role: 'teacher' } as const

describe('copying a lesson', () => {
  it('leaves nothing behind when a file fails to copy', async () => {
    const failure = new Error('storage unavailable')
    const { service, materials, assets } = setup({
      copyObject: vi.fn().mockRejectedValue(failure),
    })

    await expect(service.copy(source.id, teacher)).rejects.toBe(failure)
    expect(materials.insertSteps).not.toHaveBeenCalled()
    expect(materials.deleteCopy).toHaveBeenCalledWith(copy.id, teacher.id)
    expect(assets.deleteFolder).toHaveBeenCalledWith(copy.id)
  })

  it('still reports the failure that stopped it when tidying up fails too', async () => {
    const failure = new Error('could not insert steps')
    const { service, materials } = setup({ copyObject: vi.fn() })
    vi.mocked(materials.insertSteps).mockRejectedValue(failure)
    vi.mocked(materials.deleteCopy).mockRejectedValue(new Error('database unavailable'))
    vi.spyOn(logger, 'error').mockImplementation(() => undefined)

    await expect(service.copy(source.id, teacher)).rejects.toBe(failure)
  })

  it('keeps a copy that was made whole', async () => {
    const { service, materials, assets } = setup({ copyObject: vi.fn() })

    await expect(service.copy(source.id, teacher)).resolves.toMatchObject({ id: copy.id })
    expect(materials.insertSteps).toHaveBeenCalledWith([
      expect.objectContaining({ material_id: copy.id, title: 'Look' }),
    ])
    expect(materials.deleteCopy).not.toHaveBeenCalled()
    expect(assets.deleteFolder).not.toHaveBeenCalled()
  })
})

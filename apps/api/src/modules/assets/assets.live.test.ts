import { describe, expect, it, vi } from 'vitest'
import type { AssetsServiceDeps } from './assets.service'
import { createAssetsService } from './assets.service'
import type { AssetRow, AssetsRepository } from './assets.repository'
import type { LiveRepository, LiveSessionRow } from '../live/live.repository'
import type { MaterialStepRow, MaterialsRepository } from '../materials/materials.repository'

const imageId = '11111111-1111-4111-8111-111111111111'
const readingAudioId = '22222222-2222-4222-8222-222222222222'
const detachedId = '33333333-3333-4333-8333-333333333333'

function setup() {
  const room = {
    id: 'room',
    teacher_id: 'teacher',
    material_id: 'lesson',
    status: 'active',
  } as LiveSessionRow
  const assets = {
    findById: vi.fn(
      async (id: string) =>
        ({
          id,
          material_id: 'lesson',
          uploaded_at: '2026-09-21T09:00:00.000Z',
          path: `lesson/${id}.bin`,
        }) as AssetRow,
    ),
    signDownload: vi.fn(async () => 'https://storage.example/signed'),
  } as unknown as AssetsRepository
  const live = { findById: vi.fn(async () => room) } as unknown as LiveRepository
  const materialSteps = {
    stepsFor: vi.fn(async () => [
      {
        blocks: [
          { id: 'image', type: 'image', assetId: imageId, alt: 'Diagram' },
          { id: 'reading', type: 'reading', passage: 'Read this.', audioAssetId: readingAudioId },
        ],
      } as unknown as MaterialStepRow,
    ]),
  } as unknown as MaterialsRepository
  const assertLiveHost = vi.fn(async () => {})
  const service = createAssetsService({
    assets,
    live,
    materialSteps,
    assertLiveHost,
    materials: {} as AssetsServiceDeps['materials'],
  })
  return { service, room, assets, live, materialSteps, assertLiveHost }
}

describe('public live media', () => {
  it('allows referenced image and read-along audio in an active room', async () => {
    const { service, assets, assertLiveHost } = setup()
    await expect(service.urlForLive(imageId, 'room')).resolves.toBe(
      'https://storage.example/signed',
    )
    await expect(service.urlForLive(readingAudioId, 'room')).resolves.toBe(
      'https://storage.example/signed',
    )
    expect(assertLiveHost).toHaveBeenCalledWith('teacher')
    expect(assets.signDownload).toHaveBeenCalledTimes(2)
  })

  it('stops access as soon as the room is ended', async () => {
    const { service, room, assets } = setup()
    room.status = 'ended'
    await expect(service.urlForLive(imageId, 'room')).rejects.toMatchObject({ status: 404 })
    expect(assets.signDownload).not.toHaveBeenCalled()
  })

  it('rejects an unreferenced file and a file belonging to another lesson', async () => {
    const { service, assets } = setup()
    await expect(service.urlForLive(detachedId, 'room')).rejects.toMatchObject({ status: 404 })
    vi.mocked(assets.findById).mockResolvedValueOnce({
      id: imageId,
      material_id: 'another-lesson',
      uploaded_at: '2026-09-21T09:00:00.000Z',
      path: `another-lesson/${imageId}.bin`,
    } as AssetRow)
    await expect(service.urlForLive(imageId, 'room')).rejects.toMatchObject({ status: 404 })
    expect(assets.signDownload).not.toHaveBeenCalled()
  })

  it('does not grant access from unfinished blocks absent from the student lesson', async () => {
    const { service, materialSteps, assets } = setup()
    vi.mocked(materialSteps.stepsFor).mockResolvedValueOnce([
      {
        blocks: [{ id: 'unfinished', type: 'image', assetId: detachedId }],
      } as unknown as MaterialStepRow,
    ])
    await expect(service.urlForLive(detachedId, 'room')).rejects.toMatchObject({ status: 404 })
    expect(assets.signDownload).not.toHaveBeenCalled()
  })
})

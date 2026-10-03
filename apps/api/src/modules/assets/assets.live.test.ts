import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AssetsServiceDeps } from './assets.service'
import { createAssetsService } from './assets.service'
import type { AssetRow, AssetsRepository } from './assets.repository'
import type { LiveRepository, OpenLiveRoom } from '../live/live.repository'
import { createOpenRooms } from '../live/open-rooms'
import type { MaterialStepRow, MaterialsRepository } from '../materials/materials.repository'

const imageId = '11111111-1111-4111-8111-111111111111'
const readingAudioId = '22222222-2222-4222-8222-222222222222'
const detachedId = '33333333-3333-4333-8333-333333333333'

function setup() {
  const room: OpenLiveRoom = { id: 'room', teacher_id: 'teacher', material_id: 'lesson' }
  // What the database holds right now; the service reads it only when it chooses to.
  const open: OpenLiveRoom[] = [room]
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
  const live = { listOpen: vi.fn(async () => [...open]) } satisfies Pick<LiveRepository, 'listOpen'>
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
    rooms: createOpenRooms(live),
    materialSteps,
    assertLiveHost,
    materials: {} as AssetsServiceDeps['materials'],
  })
  return { service, room, open, assets, live, materialSteps, assertLiveHost }
}

afterEach(() => {
  vi.useRealTimers()
})

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

  it('finds a room whose id is written in capitals', async () => {
    // Postgres prints a uuid in lower case and matches it in any case; a forwarded link
    // may arrive either way.
    const { service } = setup()
    await expect(service.urlForLive(imageId, 'ROOM')).resolves.toBe(
      'https://storage.example/signed',
    )
  })

  it('stops access within ten seconds of the room ending', async () => {
    vi.useFakeTimers()
    const { service, open, assets } = setup()
    await service.urlForLive(imageId, 'room')
    open.length = 0

    // The list of open rooms is believed for a while; that while is the whole grace.
    await vi.advanceTimersByTimeAsync(9_000)
    await expect(service.urlForLive(imageId, 'room')).resolves.toBe(
      'https://storage.example/signed',
    )

    await vi.advanceTimersByTimeAsync(1_000)
    await expect(service.urlForLive(imageId, 'room')).rejects.toMatchObject({ status: 404 })
    expect(assets.signDownload).toHaveBeenCalledTimes(1)
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

describe('live media answers', () => {
  it('asks once per room and file however many people arrive at the step together', async () => {
    const { service, assets, live, materialSteps, assertLiveHost } = setup()

    const links = await Promise.all(
      Array.from({ length: 15 }, () => service.urlForLive(imageId, 'room')),
    )

    expect(new Set(links)).toEqual(new Set(['https://storage.example/signed']))
    expect(live.listOpen).toHaveBeenCalledTimes(1)
    expect(assertLiveHost).toHaveBeenCalledTimes(1)
    expect(assets.findById).toHaveBeenCalledTimes(1)
    expect(materialSteps.stepsFor).toHaveBeenCalledTimes(1)
    expect(assets.signDownload).toHaveBeenCalledTimes(1)
  })

  it('asks again once the answer is twenty seconds old', async () => {
    vi.useFakeTimers()
    const { service, assets } = setup()
    await service.urlForLive(imageId, 'room')

    await vi.advanceTimersByTimeAsync(19_000)
    await service.urlForLive(imageId, 'room')
    expect(assets.signDownload).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1_000)
    await service.urlForLive(imageId, 'room')
    expect(assets.signDownload).toHaveBeenCalledTimes(2)
  })

  it('turns a made-up file away for a single lookup', async () => {
    const { service, assets, materialSteps, assertLiveHost } = setup()
    vi.mocked(assets.findById).mockResolvedValueOnce(null)

    await expect(service.urlForLive(detachedId, 'room')).rejects.toMatchObject({ status: 404 })
    expect(assets.findById).toHaveBeenCalledTimes(1)
    expect(assertLiveHost).not.toHaveBeenCalled()
    expect(materialSteps.stepsFor).not.toHaveBeenCalled()
  })

  it('does not keep a refusal or a failure', async () => {
    const { service, assets } = setup()
    await expect(service.urlForLive(detachedId, 'room')).rejects.toMatchObject({ status: 404 })
    await expect(service.urlForLive(detachedId, 'room')).rejects.toMatchObject({ status: 404 })
    expect(assets.findById).toHaveBeenCalledTimes(2)

    vi.mocked(assets.signDownload).mockRejectedValueOnce(new Error('storage is down'))
    await expect(service.urlForLive(imageId, 'room')).rejects.toThrow('storage is down')
    await expect(service.urlForLive(imageId, 'room')).resolves.toBe(
      'https://storage.example/signed',
    )
  })

  it('answers made-up rooms from the list, reading it at most twice a second', async () => {
    vi.useFakeTimers()
    const { service, assets, live } = setup()
    await service.urlForLive(imageId, 'room')

    const madeUp = async () => {
      const asked = Promise.allSettled(
        Array.from({ length: 50 }, () => service.urlForLive(imageId, crypto.randomUUID())),
      )
      // However many ask, they wait together for the one read the half second allows.
      await vi.advanceTimersByTimeAsync(500)
      return asked
    }
    const refused = (results: PromiseSettledResult<string>[]) =>
      results.every((r) => r.status === 'rejected' && r.reason.status === 404)

    expect(refused(await madeUp())).toBe(true)
    expect(live.listOpen).toHaveBeenCalledTimes(2)

    expect(refused(await madeUp())).toBe(true)
    expect(live.listOpen).toHaveBeenCalledTimes(3)
    expect(assets.findById).toHaveBeenCalledTimes(1)
  })

  it('finds a room that opened after the list was read', async () => {
    vi.useFakeTimers()
    const { service, open, live } = setup()
    await service.urlForLive(imageId, 'room')
    open.push({ id: 'later', teacher_id: 'teacher', material_id: 'lesson' })

    await vi.advanceTimersByTimeAsync(500)
    await expect(service.urlForLive(imageId, 'later')).resolves.toBe(
      'https://storage.example/signed',
    )
    expect(live.listOpen).toHaveBeenCalledTimes(2)
  })

  it('waits for the next read for a room asked about just after the list was read', async () => {
    vi.useFakeTimers()
    const { service, open, live } = setup()
    await service.urlForLive(imageId, 'room')
    // Opened just after that read: its page loaded, and asked for its first picture.
    open.push({ id: 'later', teacher_id: 'teacher', material_id: 'lesson' })
    await vi.advanceTimersByTimeAsync(100)

    const asked = service.urlForLive(imageId, 'later')
    await vi.advanceTimersByTimeAsync(400)

    await expect(asked).resolves.toBe('https://storage.example/signed')
    expect(live.listOpen).toHaveBeenCalledTimes(2)
  })

  it('looks again for a room asked about while a read that began before it was under way', async () => {
    vi.useFakeTimers()
    const { service, room, open, live } = setup()
    await service.urlForLive(imageId, 'room')
    await vi.advanceTimersByTimeAsync(10_000)

    // The list is read again, and the new room opens while that read is out.
    let answer: (rooms: OpenLiveRoom[]) => void = () => {}
    live.listOpen.mockImplementationOnce(
      () => new Promise<OpenLiveRoom[]>((resolve) => (answer = resolve)),
    )
    const first = service.urlForLive(imageId, 'room')
    open.push({ id: 'later', teacher_id: 'teacher', material_id: 'lesson' })
    const asked = service.urlForLive(imageId, 'later')
    answer([room])
    await first

    await vi.advanceTimersByTimeAsync(500)
    await expect(asked).resolves.toBe('https://storage.example/signed')
    expect(live.listOpen).toHaveBeenCalledTimes(3)
  })

  it('reads the list again after a read that failed', async () => {
    const { service, live } = setup()
    live.listOpen.mockRejectedValueOnce(new Error('database is down'))

    await expect(service.urlForLive(imageId, 'room')).rejects.toThrow('database is down')
    await expect(service.urlForLive(imageId, 'room')).resolves.toBe(
      'https://storage.example/signed',
    )
    expect(live.listOpen).toHaveBeenCalledTimes(2)
  })
})

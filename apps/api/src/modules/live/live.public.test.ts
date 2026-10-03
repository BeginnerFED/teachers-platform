import type { LiveSnapshot } from '@tp/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Which rooms are open, and answering for one, are stand-ins: the budgets in front of the
// public routes are the subject. Every call into the service is a room looked up.
const find = vi.hoisted(() => vi.fn())
vi.mock('./open-rooms', () => ({ openRooms: { find } }))
const service = vi.hoisted(() => ({ publicRoom: vi.fn(), snapshot: vi.fn(), applyOps: vi.fn() }))
vi.mock('./live.service', () => ({ liveService: service, nameOf: vi.fn() }))

const { app } = await import('../../app')

const snapshot: LiveSnapshot = {
  version: 1,
  board: {},
  currentStepId: null,
  status: 'active',
  serverTime: 0,
}
const listed = (id: string) => ({ id, teacher_id: 'teacher', material_id: 'lesson' })

beforeEach(() => {
  // Buckets fill again as time passes; here it stands still.
  vi.useFakeTimers()
  vi.stubEnv('VERCEL', '1')
  service.snapshot.mockResolvedValue(snapshot)
  service.applyOps.mockResolvedValue(snapshot)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

/** A request as the web server passes it on: from its address, for the browser it names. */
function ask(path: string, from: { address: string; peer?: string }, init: RequestInit = {}) {
  return app.request(`/v1/live/public/${path}`, {
    ...init,
    headers: {
      'x-vercel-forwarded-for': from.address,
      ...(from.peer ? { 'x-tp-peer': from.peer } : {}),
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
  })
}

const ops = {
  method: 'POST',
  body: JSON.stringify({ ops: [{ t: 'set', path: ['answers', 'step', 'gap'], value: 'am' }] }),
}

describe('the public live routes', () => {
  it('turns made-up rooms away without looking them up where only an open room answers', async () => {
    find.mockResolvedValue(null)
    const from = { address: '198.51.100.1' }

    for (let i = 0; i < 20; i++) {
      await expect(ask(crypto.randomUUID(), from)).resolves.toMatchObject({ status: 404 })
      await expect(ask(`${crypto.randomUUID()}/ops`, from, ops)).resolves.toMatchObject({
        status: 404,
      })
    }
    expect(service.publicRoom).not.toHaveBeenCalled()
    expect(service.applyOps).not.toHaveBeenCalled()
  })

  it('looks up a closed or made-up room’s snapshot out of the address’s own budget', async () => {
    find.mockResolvedValue(null)
    service.snapshot.mockResolvedValue({ ...snapshot, status: 'ended' })
    const flood = (n: number) => ({ address: '198.51.100.2', peer: `made-up name ${n}` })

    // A new name for every request opens a bucket of the sender's own each time; the
    // address's budget for lookups is what runs out.
    for (let i = 0; i < 240; i++) {
      await expect(ask(`${crypto.randomUUID()}/snapshot`, flood(i))).resolves.toMatchObject({
        status: 200,
      })
    }
    await expect(ask(`${crypto.randomUUID()}/snapshot`, flood(240))).resolves.toMatchObject({
      status: 429,
    })
    expect(service.snapshot).toHaveBeenCalledTimes(240)

    // Somebody else's lookups are untouched, and so is every open room.
    await expect(
      ask(`${crypto.randomUUID()}/snapshot`, { address: '203.0.113.2' }),
    ).resolves.toMatchObject({ status: 200 })
    find.mockImplementation(async (id: string) => listed(id))
    await expect(ask(`${crypto.randomUUID()}/snapshot`, flood(241))).resolves.toMatchObject({
      status: 200,
    })
  })

  it('gives each participant behind the web server a budget of their own', async () => {
    find.mockImplementation(async (id: string) => listed(id))
    const rooms = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]
    const web = (peer: string) => ({ address: '198.51.100.3', peer })

    // One browser busy in three rooms, within each room's budget, spends all of its own...
    for (const room of rooms) {
      for (let i = 0; i < 80; i++) {
        await expect(ask(`${room}/snapshot`, web('192.0.2.1'))).resolves.toMatchObject({
          status: 200,
        })
      }
    }
    await expect(ask(`${crypto.randomUUID()}/snapshot`, web('192.0.2.1'))).resolves.toMatchObject({
      status: 429,
    })

    // ...and nobody else's: another guest the same web server passes on for is answered.
    await expect(ask(`${rooms[0]}/snapshot`, web('192.0.2.2'))).resolves.toMatchObject({
      status: 200,
    })
    await expect(ask(`${rooms[1]}/ops`, web('192.0.2.2'), ops)).resolves.toMatchObject({
      status: 200,
    })
  })

  it('keeps a ceiling on an address that no forwarded name can multiply', async () => {
    find.mockImplementation(async (id: string) => listed(id))
    const statuses: number[] = []

    for (let i = 0; i < 2_001; i++) {
      const response = await ask(`${crypto.randomUUID()}/snapshot`, {
        address: '198.51.100.4',
        peer: `name ${i}`,
      })
      statuses.push(response.status)
    }

    expect(statuses.filter((status) => status === 200)).toHaveLength(2_000)
    expect(statuses.at(-1)).toBe(429)
  })
})

import { Hono } from 'hono'
import { liveSessionIdParam } from '@tp/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppEnv } from '../http/context'
import { AppError } from '../http/errors'
import { byParam, forwardedPeer, PEER_HEADER, rateLimit } from './rate-limit'

vi.mock('@hono/node-server/conninfo', () => ({
  getConnInfo: () => ({ remote: { address: '127.0.0.1' } }),
}))

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('rateLimit', () => {
  it('returns a structured error and Retry-After header when the bucket is empty', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-16T12:00:00.000Z'))

    const app = new Hono<AppEnv>()
    app.onError((error, c) => {
      if (!(error instanceof AppError)) throw error

      return c.json({ error: { code: error.code, details: error.details } }, error.status)
    })
    app.get('/limited', rateLimit({ perSecond: 1 / 15, burst: 1 }), (c) => c.json({ data: 'ok' }))

    await expect(app.request('/limited')).resolves.toMatchObject({ status: 200 })
    const limited = await app.request('/limited')

    expect(limited.status).toBe(429)
    expect(limited.headers.get('Retry-After')).toBe('15')
    await expect(limited.json()).resolves.toEqual({
      error: {
        code: 'too_many_requests',
        details: {
          scope: 'request',
          reason: 'rate_limit',
          retryAfterSeconds: 15,
        },
      },
    })
  })

  it('does not let a public caller evade the bucket by rotating forwarding headers', async () => {
    const app = new Hono<AppEnv>()
    app.onError((error, c) => {
      if (!(error instanceof AppError)) throw error

      return c.json({ error: { code: error.code } }, error.status)
    })
    app.get('/limited', rateLimit({ perSecond: 1, burst: 1 }), (c) => c.json({ data: 'ok' }))

    await expect(
      app.request('/limited', { headers: { 'x-forwarded-for': '198.51.100.10' } }),
    ).resolves.toMatchObject({ status: 200 })
    await expect(
      app.request('/limited', { headers: { 'x-forwarded-for': '203.0.113.20' } }),
    ).resolves.toMatchObject({ status: 429 })
  })

  it('uses the client address Vercel overwrites at its trusted ingress', async () => {
    vi.stubEnv('VERCEL', '1')

    const app = new Hono<AppEnv>()
    app.onError((error, c) => {
      if (!(error instanceof AppError)) throw error
      return c.json({ error: { code: error.code } }, error.status)
    })
    app.get('/limited', rateLimit({ perSecond: 1, burst: 1 }), (c) => c.json({ data: 'ok' }))

    await expect(
      app.request('/limited', { headers: { 'x-vercel-forwarded-for': '198.51.100.10' } }),
    ).resolves.toMatchObject({ status: 200 })
    await expect(
      app.request('/limited', { headers: { 'x-vercel-forwarded-for': '198.51.100.10' } }),
    ).resolves.toMatchObject({ status: 429 })
    await expect(
      app.request('/limited', { headers: { 'x-vercel-forwarded-for': '203.0.113.20' } }),
    ).resolves.toMatchObject({ status: 200 })
  })

  it('can isolate public resource budgets behind one server-side proxy', async () => {
    const app = new Hono<AppEnv>()
    app.onError((error, c) => {
      if (!(error instanceof AppError)) throw error
      return c.json({ error: { code: error.code } }, error.status)
    })
    app.get(
      '/limited/:resource',
      rateLimit({
        perSecond: 1,
        burst: 1,
        identify: (c) => c.req.param('resource') ?? 'unknown-resource',
      }),
      (c) => c.json({ data: 'ok' }),
    )

    await expect(app.request('/limited/one')).resolves.toMatchObject({ status: 200 })
    await expect(app.request('/limited/one')).resolves.toMatchObject({ status: 429 })
    await expect(app.request('/limited/two')).resolves.toMatchObject({ status: 200 })
  })

  it('gives only a well-formed room id a bucket of its own', async () => {
    const identify = vi.fn(byParam('sessionId', liveSessionIdParam.shape.sessionId))
    const app = new Hono<AppEnv>()
    app.onError((error, c) => {
      if (!(error instanceof AppError)) throw error
      return c.json({ error: { code: error.code } }, error.status)
    })
    app.get('/rooms/:sessionId', rateLimit({ perSecond: 1, burst: 1, identify }), (c) =>
      c.json({ data: 'ok' }),
    )
    const madeUp = (n: number) => `${n}-`.padEnd(8_000, 'x')

    await expect(app.request(`/rooms/${madeUp(1)}`)).resolves.toMatchObject({ status: 200 })
    // Another 8 KB id is not a room: it is turned away from the first one's bucket...
    await expect(app.request(`/rooms/${madeUp(2)}`)).resolves.toMatchObject({ status: 429 })
    expect(identify.mock.results.map((result) => result.value)).toEqual([
      'invalid sessionId',
      'invalid sessionId',
    ])

    // ...while each real room still has a budget of its own.
    const room = crypto.randomUUID()
    await expect(app.request(`/rooms/${room}`)).resolves.toMatchObject({ status: 200 })
    await expect(app.request(`/rooms/${crypto.randomUUID()}`)).resolves.toMatchObject({
      status: 200,
    })
    await expect(app.request(`/rooms/${room}`)).resolves.toMatchObject({ status: 429 })
    // A uuid matches in any case, so the same room written in capitals shares its bucket.
    await expect(app.request(`/rooms/${room.toUpperCase()}`)).resolves.toMatchObject({
      status: 429,
    })
  })

  describe('forwarded peers', () => {
    const WEB_SERVER = '198.51.100.10'
    const SOMEBODY_ELSE = '203.0.113.20'
    const BROWSER_A = '192.0.2.1'
    const BROWSER_B = '192.0.2.2'

    function limitedBy(identify?: typeof forwardedPeer) {
      vi.stubEnv('VERCEL', '1')
      const app = new Hono<AppEnv>()
      app.onError((error, c) => {
        if (!(error instanceof AppError)) throw error
        return c.json({ error: { code: error.code } }, error.status)
      })
      app.get('/limited', rateLimit({ perSecond: 1, burst: 1, identify }), (c) =>
        c.json({ data: 'ok' }),
      )

      return (caller: string, peer?: string) =>
        app.request('/limited', {
          headers: { 'x-vercel-forwarded-for': caller, ...(peer ? { [PEER_HEADER]: peer } : {}) },
        })
    }

    it('gives each browser a proxying caller passes on for a budget of its own', async () => {
      const from = limitedBy(forwardedPeer)

      await expect(from(WEB_SERVER, BROWSER_A)).resolves.toMatchObject({ status: 200 })
      await expect(from(WEB_SERVER, BROWSER_A)).resolves.toMatchObject({ status: 429 })
      await expect(from(WEB_SERVER, BROWSER_B)).resolves.toMatchObject({ status: 200 })

      // Naming nobody, a caller is its address, the way it is everywhere else.
      await expect(from(WEB_SERVER)).resolves.toMatchObject({ status: 200 })
      await expect(from(WEB_SERVER)).resolves.toMatchObject({ status: 429 })
    })

    it('never lets a forwarded name reach into another caller’s bucket', async () => {
      const from = limitedBy(forwardedPeer)

      // Somebody else naming a browser spends only a bucket of their own...
      await expect(from(SOMEBODY_ELSE, BROWSER_A)).resolves.toMatchObject({ status: 200 })
      await expect(from(SOMEBODY_ELSE, BROWSER_A)).resolves.toMatchObject({ status: 429 })

      // ...and the web server's requests for that browser are untouched by it.
      await expect(from(WEB_SERVER, BROWSER_A)).resolves.toMatchObject({ status: 200 })
    })

    it('is ignored by a route that did not ask for it', async () => {
      const from = limitedBy()

      await expect(from(SOMEBODY_ELSE, BROWSER_A)).resolves.toMatchObject({ status: 200 })
      await expect(from(SOMEBODY_ELSE, BROWSER_B)).resolves.toMatchObject({ status: 429 })
    })
  })
})

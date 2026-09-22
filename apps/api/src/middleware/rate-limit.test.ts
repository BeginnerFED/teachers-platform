import { Hono } from 'hono'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppEnv } from '../http/context'
import { AppError } from '../http/errors'
import { rateLimit } from './rate-limit'

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
})

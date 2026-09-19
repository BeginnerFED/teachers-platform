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
})

import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { requestId } from 'hono/request-id'
import { describe, expect, it, vi } from 'vitest'
import type { Logger } from '../lib/logger'
import type { AppEnv } from './context'
import { errorHandler } from './error-handler'
import { InternalError, UpstreamUnavailableError, ValidationError } from './errors'

const CONSTRAINT =
  'new row for relation "student_notifications" violates check constraint "student_notifications_kind_check"'

function app() {
  const log = { error: vi.fn(), warn: vi.fn() }
  const routes = new Hono<AppEnv>()
    .use('*', requestId())
    .use('*', async (c, next) => {
      c.set('log', log as unknown as Logger)
      await next()
    })
    // What throwFromPostgrest makes of a failure it has no mapping for.
    .get('/postgres', () => {
      throw new InternalError(`update submitted assignment: ${CONSTRAINT}`, {
        cause: { code: '23514', message: CONSTRAINT },
      })
    })
    .get('/upstream', () => {
      throw new UpstreamUnavailableError('AI provider request failed (502)')
    })
    .get('/http-500', () => {
      throw new HTTPException(500, { message: 'stream closed by provider' })
    })
    .get('/invalid', () => {
      throw new ValidationError('Invalid request', { fieldErrors: { title: ['Required'] } })
    })

  routes.onError(errorHandler)

  return { routes, log }
}

describe('error responses', () => {
  // A raw Postgres message names tables, constraints and triggers.
  it('answers a database failure with a fixed sentence and keeps the detail in the log', async () => {
    const { routes, log } = app()

    const response = await routes.request('/postgres')
    const body = (await response.json()) as { error: Record<string, unknown> }

    expect(response.status).toBe(500)
    expect(body.error).toEqual({
      code: 'internal',
      message: 'Something went wrong',
      requestId: response.headers.get('x-request-id'),
      details: null,
    })
    expect(JSON.stringify(body)).not.toContain('student_notifications')
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'internal' }),
      `update submitted assignment: ${CONSTRAINT}`,
    )
  })

  it.each(['/upstream', '/http-500'])('masks every 5xx message (%s)', async (path) => {
    const { routes, log } = app()

    const response = await routes.request(path)
    const body = (await response.json()) as { error: { message: string; requestId: string } }

    expect(response.status).toBeGreaterThanOrEqual(500)
    expect(body.error.message).toBe('Something went wrong')
    expect(body.error.requestId).toBeTruthy()
    expect(log.error).toHaveBeenCalledOnce()
  })

  it('keeps the message and details of a 4xx, which tell the caller what to fix', async () => {
    const { routes, log } = app()

    const response = await routes.request('/invalid')
    const body = (await response.json()) as { error: Record<string, unknown> }

    expect(response.status).toBe(422)
    expect(body.error).toMatchObject({
      code: 'validation_failed',
      message: 'Invalid request',
      details: { fieldErrors: { title: ['Required'] } },
    })
    expect(log.warn).toHaveBeenCalledOnce()
    expect(log.error).not.toHaveBeenCalled()
  })
})

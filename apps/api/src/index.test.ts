import { describe, expect, it } from 'vitest'
import app from './index'

describe('Vercel Hono entry', () => {
  it('exports the API as a fetch-compatible default application', async () => {
    const response = await app.request('/')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: { name: 'teachers-platform api', status: 'ok' },
    })
  })
})

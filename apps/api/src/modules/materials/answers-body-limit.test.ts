import { describe, expect, it } from 'vitest'
import { app } from '../../app'

const id = '00000000-0000-4000-8000-000000000001'
const oversizedAnswers = JSON.stringify({ answers: { dictation: 'word '.repeat(55_000) } })

describe('student answer body limits', () => {
  it.each([
    `/v1/materials/${id}/steps/${id}/check`,
    `/v1/assignments/${id}/progress`,
    `/v1/live/${id}/check`,
  ])('rejects an oversized answer before grading or saving at %s', async (path) => {
    const response = await app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: oversizedAnswers,
    })

    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ error: { code: 'validation_failed' } })
  })

  it.each([
    `/v1/materials/${id}/steps/${id}/check`,
    `/v1/assignments/${id}/progress`,
    `/v1/live/${id}/check`,
  ])('lets a long writing answer reach authentication at %s', async (path) => {
    const response = await app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers: { writing: 'thought '.repeat(2_000) } }),
    })

    expect(response.status).toBe(401)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { assignmentsRepository } from './assignments.repository'

const from = vi.hoisted(() => vi.fn())
vi.mock('../../lib/supabase/admin', () => ({ supabaseAdmin: { from } }))

const FILTERS = ['select', 'eq', 'lt', 'gte', 'or', 'order', 'range', 'limit', 'returns']

/** A PostgREST builder stand-in: every filter hands back the builder, and awaiting it answers. */
function query(answer: { data?: unknown; error?: unknown; count?: number | null }) {
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null, count: null, ...answer }).then(resolve, reject),
  }
  for (const method of FILTERS) builder[method] = vi.fn(() => builder)

  return builder
}

afterEach(() => vi.clearAllMocks())

describe('listing homework', () => {
  it('answers a page past the last one with no rows and the true total', async () => {
    from
      .mockReturnValueOnce(
        query({ error: { code: 'PGRST103', message: 'Requested range not satisfiable' } }),
      )
      .mockReturnValueOnce(query({ count: 3 }))

    await expect(
      assignmentsRepository.list({ page: 5, perPage: 10, teacherId: 'teacher' }),
    ).resolves.toEqual({ rows: [], total: 3 })
    expect(from).toHaveBeenCalledTimes(2)
  })

  it('still reports any other failure', async () => {
    from.mockReturnValueOnce(query({ error: { code: '57014', message: 'statement timeout' } }))

    await expect(
      assignmentsRepository.list({ page: 1, perPage: 10, teacherId: 'teacher' }),
    ).rejects.toMatchObject({ code: 'internal', status: 500 })
  })
})

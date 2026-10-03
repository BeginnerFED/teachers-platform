import { afterEach, describe, expect, it, vi } from 'vitest'
import { materialsRepository } from './materials.repository'

const from = vi.hoisted(() => vi.fn())
vi.mock('../../lib/supabase/admin', () => ({ supabaseAdmin: { from } }))

const FILTERS = ['select', 'eq', 'is', 'not', 'or', 'contains', 'order', 'range', 'returns']

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

describe('listing the library', () => {
  const params = {
    page: 50,
    perPage: 24,
    scope: 'mine',
    deleted: false,
    viewerId: 'teacher',
  } as const

  it('answers a page past the last one with no rows and the true total', async () => {
    const rows = query({ error: { code: 'PGRST103', message: 'Requested range not satisfiable' } })
    const count = query({ count: 1 })
    from.mockReturnValueOnce(rows).mockReturnValueOnce(count)

    await expect(materialsRepository.list(params)).resolves.toEqual({ rows: [], total: 1 })
    // The count asks the same question as the page, without its rows.
    expect(count.select).toHaveBeenCalledWith(expect.any(String), { count: 'exact', head: true })
    expect(count.eq).toHaveBeenCalledWith('owner_id', 'teacher')
  })

  it('still reports any other failure', async () => {
    from.mockReturnValueOnce(query({ error: { code: '57014', message: 'statement timeout' } }))

    await expect(materialsRepository.list({ ...params, page: 1 })).rejects.toMatchObject({
      code: 'internal',
      status: 500,
    })
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { teachersRepository } from './teachers.repository'

const from = vi.hoisted(() => vi.fn())
vi.mock('../../lib/supabase/admin', () => ({ supabaseAdmin: { from } }))

/** A PostgREST builder stand-in: every filter hands back the builder, and awaiting it answers. */
function query(answer: { data?: unknown; error?: unknown; count?: number | null }) {
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null, count: null, ...answer }).then(resolve, reject),
  }
  for (const method of ['select', 'eq', 'not', 'or', 'order', 'range', 'returns']) {
    builder[method] = vi.fn(() => builder)
  }

  return builder
}

afterEach(() => vi.clearAllMocks())

describe('listing teachers', () => {
  const params = { page: 50, perPage: 25, status: 'suspended', query: 'anna' } as const

  it('answers a page past the last one with no rows and the true total', async () => {
    const rows = query({ error: { code: 'PGRST103', message: 'Requested range not satisfiable' } })
    const count = query({ count: 4 })
    from.mockReturnValueOnce(rows).mockReturnValueOnce(count)

    await expect(teachersRepository.list(params)).resolves.toEqual({ rows: [], total: 4 })
    // The count asks the same question as the page, without its rows.
    expect(count.select).toHaveBeenCalledWith(expect.stringContaining('subscriptions!inner'), {
      count: 'exact',
      head: true,
    })
    expect(count.eq).toHaveBeenCalledWith('subscriptions.status', 'suspended')
    expect(count.or).toHaveBeenCalledWith(expect.stringContaining('anna'))
  })

  it('still reports any other failure', async () => {
    from.mockReturnValueOnce(query({ error: { code: '57014', message: 'statement timeout' } }))

    await expect(teachersRepository.list({ ...params, page: 1 })).rejects.toMatchObject({
      code: 'internal',
      status: 500,
    })
    expect(from).toHaveBeenCalledOnce()
  })
})

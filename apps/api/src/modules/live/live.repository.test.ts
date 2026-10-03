import { afterEach, describe, expect, it, vi } from 'vitest'

const from = vi.hoisted(() => vi.fn())
vi.mock('../../lib/supabase/admin', () => ({ supabaseAdmin: { from } }))

const { liveRepository } = await import('./live.repository')

type Row = { id: string; teacher_id: string; material_id: string; status: string }

/**
 * live_sessions as PostgREST pages it: the open rooms in id order, after the id a query
 * names, never more than a page. `afterRead` runs once each page has been answered.
 */
function table(rows: Row[], afterRead: (page: number) => void) {
  let pages = 0

  from.mockImplementation(() => {
    let after: string | undefined
    let limit = Number.POSITIVE_INFINITY
    const builder: Record<string, unknown> = {
      gt: vi.fn((_column: string, id: string) => {
        after = id
        return builder
      }),
      limit: vi.fn((count: number) => {
        limit = Math.min(count, 1000)
        return builder
      }),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
        const data = rows
          .filter((row) => row.status === 'active' && (after === undefined || row.id > after))
          .sort((a, b) => (a.id < b.id ? -1 : 1))
          .slice(0, limit)
          .map(({ id, teacher_id, material_id }) => ({ id, teacher_id, material_id }))
        afterRead(++pages)
        return Promise.resolve({ data, error: null }).then(resolve, reject)
      },
    }
    for (const method of ['select', 'eq', 'order']) builder[method] = vi.fn(() => builder)

    return builder
  })
}

afterEach(() => vi.clearAllMocks())

describe('listing the open rooms', () => {
  it('skips no room when one closes between pages', async () => {
    const rows = Array.from({ length: 2_500 }, (_, i) => ({
      id: `room-${String(i).padStart(4, '0')}`,
      teacher_id: `teacher-${i}`,
      material_id: 'lesson',
      status: 'active',
    }))
    // A room on the first page ends just after that page was read.
    table(rows, (page) => {
      if (page === 1) rows[10]!.status = 'ended'
    })

    const open = await liveRepository.listOpen()

    const read = new Set(open.map((room) => room.id))
    expect(rows.filter((row) => row.status === 'active').every((row) => read.has(row.id))).toBe(
      true,
    )
    expect(open).toHaveLength(2_500)
    expect(from).toHaveBeenCalledTimes(3)
  })

  it('reads once while the rooms fit on a page', async () => {
    table(
      [{ id: 'room', teacher_id: 'teacher', material_id: 'lesson', status: 'active' }],
      () => {},
    )

    await expect(liveRepository.listOpen()).resolves.toEqual([
      { id: 'room', teacher_id: 'teacher', material_id: 'lesson' },
    ])
    expect(from).toHaveBeenCalledOnce()
  })
})

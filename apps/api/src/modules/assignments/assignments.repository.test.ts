import { afterEach, describe, expect, it, vi } from 'vitest'

// The database is replaced by what PostgREST answers; the mapping of its refusals is the
// subject. Every builder call returns the builder, and the last one answers.
const from = vi.hoisted(() => vi.fn())
vi.mock('../../lib/supabase/admin', () => ({ supabaseAdmin: { from } }))

const { assignmentsRepository } = await import('./assignments.repository')

function answering(code: string, message: string) {
  const builder = {
    insert: () => builder,
    update: () => builder,
    eq: () => builder,
    select: () => builder,
    maybeSingle: () => builder,
    returns: () => Promise.resolve({ data: null, error: { code, message, details: '', hint: '' } }),
  }
  from.mockReturnValue(builder)
}

const give = () =>
  assignmentsRepository.insertMany([
    { material_id: 'material', teacher_id: 'teacher', student_id: 'student' },
  ])
const giveBack = () =>
  assignmentsRepository.updateSubmitted('assignment', '2026-10-03T10:00:00.000Z', {
    status: 'assigned',
  })

afterEach(() => from.mockReset())

describe('homework across an ended link', () => {
  it.each([
    ['giving homework', give],
    ['giving handed-in work back to be redone', giveBack],
  ])('answers the database refusing %s with the reason the teacher reads', async (_, write) => {
    answering('TP409', 'student_not_linked')

    await expect(write()).rejects.toMatchObject({
      code: 'rule_violation',
      status: 422,
      details: { reason: 'not_your_student' },
    })
  })

  it('leaves every other refusal to the usual mapping', async () => {
    // The database's conflict code carries every other conflict too.
    answering('TP409', 'something else')
    await expect(giveBack()).rejects.toMatchObject({ code: 'conflict', status: 409 })

    answering('P0001', 'student_not_linked')
    await expect(give()).rejects.toMatchObject({ code: 'internal', status: 500 })
  })
})

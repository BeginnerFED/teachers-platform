import { describe, expect, it, vi } from 'vitest'
import type { Correspondent, MaterialListItem, StudentListItem, TeacherListItem } from '@tp/shared'
import { SEARCH_LIMIT } from '@tp/shared'
import { createSearchService } from './search.service'

function page<T>(items: T[]) {
  return { items, meta: { page: 1, perPage: SEARCH_LIMIT, total: items.length } }
}

const material: MaterialListItem = {
  id: 'material',
  title: 'Travel',
  description: 'At the airport',
  level: 'A2',
  tags: [],
  visibility: 'private',
  status: 'draft',
  durationMinutes: null,
  stepCount: 2,
  owner: null,
  canEdit: true,
  sourceMaterialId: null,
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
}
const teacher: TeacherListItem = {
  id: 'teacher',
  fullName: 'İpek',
  email: 'ipek@example.com',
  createdAt: '',
  subscription: null,
  studentCount: 3,
}
const student: StudentListItem = {
  id: 'student',
  fullName: 'Işıl',
  email: 'isil@example.com',
  createdAt: '',
  teachers: [],
  lessonsAttended: 4,
}

function setup(contacts: Correspondent[] = []) {
  const deps = {
    materials: { list: vi.fn().mockResolvedValue(page([material])) },
    teachers: { list: vi.fn().mockResolvedValue(page([teacher])) },
    students: { list: vi.fn().mockResolvedValue(page([student])) },
    messaging: { recipientsFor: vi.fn().mockResolvedValue(contacts) },
  }
  return { deps, service: createSearchService(deps) }
}

describe('quick search access', () => {
  it('uses the authorized library view and projects only search summaries for admins', async () => {
    const { service, deps } = setup()
    const viewer = { id: 'admin', role: 'admin' as const }
    const results = await service.find({ query: 'test' }, viewer)
    expect(deps.materials.list).toHaveBeenCalledWith(
      { query: 'test', page: 1, perPage: SEARCH_LIMIT, scope: 'all', deleted: false },
      viewer,
    )
    expect(deps.teachers.list).toHaveBeenCalledWith({
      query: 'test',
      page: 1,
      perPage: SEARCH_LIMIT,
    })
    expect(deps.students.list).toHaveBeenCalledWith({
      query: 'test',
      page: 1,
      perPage: SEARCH_LIMIT,
    })
    expect(deps.messaging.recipientsFor).not.toHaveBeenCalled()
    expect(results).toEqual({
      materials: [{ id: 'material', title: 'Travel', description: 'At the airport', level: 'A2' }],
      people: [
        { id: teacher.id, fullName: teacher.fullName, email: teacher.email, role: 'teacher' },
        { id: student.id, fullName: student.fullName, email: student.email, role: 'student' },
      ],
    })
  })

  it.each(['teacher', 'student'] as const)(
    'never opens the admin directory for a %s',
    async (role) => {
      const contacts: Correspondent[] = [
        { id: 'linked', fullName: 'İpek', email: 'linked@example.com', role: 'teacher' },
        { id: 'admin', fullName: null, email: 'admin@example.com', role: 'admin' },
      ]
      const { service, deps } = setup(contacts)
      const viewer = { id: 'viewer', role }
      const results = await service.find({ query: 'ipek' }, viewer)
      expect(results.people).toEqual([contacts[0]])
      expect(deps.messaging.recipientsFor).toHaveBeenCalledWith(viewer.id)
      expect(deps.teachers.list).not.toHaveBeenCalled()
      expect(deps.students.list).not.toHaveBeenCalled()
      if (role === 'student') {
        expect(deps.materials.list).not.toHaveBeenCalled()
        expect(results.materials).toEqual([])
      } else {
        expect(deps.materials.list).toHaveBeenCalledWith(expect.anything(), viewer)
      }
    },
  )

  it('matches email for unnamed contacts and bounds a large authorized list', async () => {
    const contacts = Array.from({ length: 20 }, (_, index) => ({
      id: String(index),
      fullName: null,
      email: `person${index}@example.com`,
      role: 'student' as const,
    }))
    const { service } = setup(contacts)
    const result = await service.find({ query: 'EXAMPLE.COM' }, { id: 'viewer', role: 'teacher' })
    expect(result.people).toHaveLength(SEARCH_LIMIT)
    expect(
      result.people.every((person) => contacts.some((contact) => contact.id === person.id)),
    ).toBe(true)
  })

  it('does not disguise an upstream failure as an empty result', async () => {
    const { service, deps } = setup()
    deps.messaging.recipientsFor.mockRejectedValue(new Error('Unavailable'))
    await expect(
      service.find({ query: 'hello' }, { id: 'viewer', role: 'student' }),
    ).rejects.toThrow('Unavailable')
  })
})

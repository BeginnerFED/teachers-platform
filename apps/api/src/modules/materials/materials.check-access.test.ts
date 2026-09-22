import { describe, expect, it, vi } from 'vitest'
import type { AssetsRepository } from '../assets/assets.repository'
import type { AssignmentsRepository } from '../assignments/assignments.repository'
import type { LiveRepository } from '../live/live.repository'
import type { MaterialRow, MaterialStepRow, MaterialsRepository } from './materials.repository'
import { createMaterialsService, type Viewer } from './materials.service'

const material = {
  id: 'material',
  owner_id: 'teacher',
  deleted_at: null,
  visibility: 'private',
  status: 'draft',
} as MaterialRow

const step = {
  id: 'step',
  material_id: material.id,
  position: 0,
  title: null,
  blocks: [
    {
      id: 'choice',
      type: 'multiple_choice',
      prompt: 'Choose the greeting.',
      options: [
        { id: 'hello', text: 'Hello' },
        { id: 'goodbye', text: 'Goodbye' },
      ],
      correctIds: ['hello'],
    },
  ],
  created_at: '2026-09-22T00:00:00.000Z',
  updated_at: '2026-09-22T00:00:00.000Z',
} as MaterialStepRow

function setup({
  assigned = false,
  open = assigned,
  live = false,
  row = material,
}: {
  assigned?: boolean
  open?: boolean
  live?: boolean
  row?: MaterialRow
} = {}) {
  const materials = {
    findById: vi.fn().mockResolvedValue(row),
    findStep: vi.fn().mockResolvedValue(step),
    stepsFor: vi.fn().mockResolvedValue([step]),
  } as unknown as MaterialsRepository
  const assignments = {
    isAssigned: vi.fn().mockResolvedValue(assigned),
    openFor: vi.fn().mockResolvedValue(open ? ['student'] : []),
  } as unknown as AssignmentsRepository
  const liveRepository = {
    isLiveFor: vi.fn().mockResolvedValue(live),
  } as unknown as LiveRepository
  const service = createMaterialsService({
    materials,
    assignments,
    live: liveRepository,
    assets: {} as AssetsRepository,
  })

  return { service, materials, assignments, live: liveRepository }
}

describe('stateless material checks', () => {
  it('does not let assigned students bypass homework answer locks, even during a live lesson', async () => {
    const { service, materials, assignments, live } = setup({ assigned: true, live: true })

    await expect(
      service.checkStep(
        material.id,
        step.id,
        { choice: ['goodbye'] },
        {
          id: 'student',
          role: 'student',
        },
      ),
    ).rejects.toMatchObject({
      code: 'forbidden',
      status: 403,
      message: 'Homework steps must be checked through the assignment',
    })

    expect(assignments.openFor).toHaveBeenCalledWith(material.id, ['student'])
    expect(live.isLiveFor).not.toHaveBeenCalled()
    expect(materials.findStep).not.toHaveBeenCalled()
  })

  it('still marks an unassigned lesson reached through a live room', async () => {
    const { service, materials, assignments, live } = setup({ live: true })

    await expect(
      service.checkStep(
        material.id,
        step.id,
        { choice: ['hello'] },
        {
          id: 'student',
          role: 'student',
        },
      ),
    ).resolves.toMatchObject({ autoScore: 1, autoMax: 1, manualMax: 0 })

    expect(assignments.openFor).toHaveBeenCalledWith(material.id, ['student'])
    expect(live.isLiveFor).toHaveBeenCalledWith(material.id, 'student')
    expect(materials.findStep).toHaveBeenCalledWith(material.id, step.id)
  })

  it('does not expose the answer key to an unassigned student outside a live room', async () => {
    const publicMaterial = {
      ...material,
      owner_id: 'another-author',
      visibility: 'platform',
      status: 'published',
    } as MaterialRow
    const { service, materials } = setup({ row: publicMaterial })

    await expect(
      service.checkStep(
        publicMaterial.id,
        step.id,
        { choice: ['hello'] },
        {
          id: 'student',
          role: 'student',
        },
      ),
    ).rejects.toMatchObject({ code: 'not_found', status: 404 })

    expect(materials.findStep).not.toHaveBeenCalled()
  })

  it('keeps an assigned lesson playable while reserving checks for assignment progress', async () => {
    const { service, live } = setup({ assigned: true })

    await expect(
      service.getForStudent(material.id, { id: 'student', role: 'student' }),
    ).resolves.toMatchObject({ id: material.id })

    expect(live.isLiveFor).not.toHaveBeenCalled()
  })

  it('lets a graded historical assignment use the current material in a live room', async () => {
    const { service, assignments, live } = setup({ assigned: true, open: false, live: true })

    await expect(
      service.checkStep(
        material.id,
        step.id,
        { choice: ['hello'] },
        { id: 'student', role: 'student' },
      ),
    ).resolves.toMatchObject({ autoScore: 1, autoMax: 1 })

    expect(assignments.isAssigned).not.toHaveBeenCalled()
    expect(assignments.openFor).toHaveBeenCalledWith(material.id, ['student'])
    expect(live.isLiveFor).toHaveBeenCalledWith(material.id, 'student')
  })

  it.each(['teacher', 'admin'] as const)('preserves %s material previews', async (role) => {
    const preview = {
      ...material,
      owner_id: 'another-author',
      visibility: 'platform',
      status: 'published',
    } as MaterialRow
    const { service, assignments, live } = setup({ assigned: true, row: preview })
    const viewer: Viewer = { id: `${role}-viewer`, role }

    await expect(
      service.checkStep(preview.id, step.id, { choice: ['hello'] }, viewer),
    ).resolves.toMatchObject({ autoScore: 1, autoMax: 1 })

    expect(assignments.isAssigned).not.toHaveBeenCalled()
    expect(assignments.openFor).not.toHaveBeenCalled()
    expect(live.isLiveFor).not.toHaveBeenCalled()
  })
})

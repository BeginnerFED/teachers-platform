import { describe, expect, it, vi } from 'vitest'
import { blockSchema } from '@tp/shared'
import type { AssetsRepository } from '../assets/assets.repository'
import type { LiveRepository } from '../live/live.repository'
import { markStep } from './marking'
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

function setup({ live = false, row = material }: { live?: boolean; row?: MaterialRow } = {}) {
  const materials = {
    findById: vi.fn().mockResolvedValue(row),
    findStep: vi.fn().mockResolvedValue(step),
    stepsFor: vi.fn().mockResolvedValue([step]),
  } as unknown as MaterialsRepository
  const liveRepository = {
    isLiveFor: vi.fn().mockResolvedValue(live),
  } as unknown as LiveRepository
  const service = createMaterialsService({
    materials,
    live: liveRepository,
    assets: {} as AssetsRepository,
  })

  return { service, materials, live: liveRepository }
}

const student: Viewer = { id: 'student', role: 'student' }

describe('stateless material checks', () => {
  it.each([
    ['outside a live room', false],
    ['in the live room where the lesson is taught', true],
  ])('are not offered to a student %s', async (_where, live) => {
    // Nothing would be locked: a student could try answers until each came back right.
    const { service, materials } = setup({ live })

    await expect(
      service.checkStep(material.id, step.id, { choice: ['goodbye'] }, student),
    ).rejects.toMatchObject({ code: 'not_found', status: 404 })
    expect(materials.findStep).not.toHaveBeenCalled()
  })

  it.each(['teacher', 'admin'] as const)('preserves %s material previews', async (role) => {
    const preview = {
      ...material,
      owner_id: 'another-author',
      visibility: 'platform',
      status: 'published',
    } as MaterialRow
    const { service, live } = setup({ row: preview })
    const viewer: Viewer = { id: `${role}-viewer`, role }

    await expect(
      service.checkStep(preview.id, step.id, { choice: ['hello'] }, viewer),
    ).resolves.toMatchObject({ autoScore: 1, autoMax: 1 })

    expect(live.isLiveFor).not.toHaveBeenCalled()
  })
})

describe('playing the current lesson as a student', () => {
  it('opens it in the live room where it is being taught', async () => {
    const { service, live } = setup({ live: true })

    await expect(service.getForStudent(material.id, student)).resolves.toMatchObject({
      id: material.id,
    })
    expect(live.isLiveFor).toHaveBeenCalledWith(material.id, 'student')
  })

  it('does not open it anywhere else, homework included: that plays its frozen copy', async () => {
    const { service } = setup({ live: false })

    await expect(service.getForStudent(material.id, student)).rejects.toMatchObject({
      code: 'not_found',
      status: 404,
    })
  })
})

describe('marking a step', () => {
  const question = blockSchema.parse({
    id: 'choice',
    type: 'multiple_choice',
    prompt: 'Choose the greeting.',
    options: [
      { id: 'hello', text: 'Hello' },
      { id: 'goodbye', text: 'Goodbye' },
    ],
    correctIds: ['hello'],
    explanation: 'Hello is a greeting.',
  })
  const mistake = blockSchema.parse({
    id: 'mistake',
    type: 'spot_mistake',
    items: [{ id: 'i1', words: ['She', 'go', 'home'], wrongIndex: 1, correction: 'goes' }],
  })

  it('explains an answered question', () => {
    const marked = markStep([question, mistake], { choice: ['goodbye'], mistake: { i1: 1 } })

    expect(marked.byBlock.choice).toMatchObject({ score: 0, explanation: 'Hello is a greeting.' })
    expect(marked.byBlock.mistake).toMatchObject({ score: 1, explanation: 'go → goes' })
  })

  it('keeps the explanation of an unanswered question back, since it is the answer', () => {
    const marked = markStep([question, mistake], { choice: [], mistake: {} })

    expect(marked.byBlock.choice).not.toHaveProperty('explanation')
    expect(marked.byBlock.mistake).not.toHaveProperty('explanation')
    expect(markStep([question], {}).byBlock.choice).not.toHaveProperty('explanation')
  })

  it('explains every question of work that can no longer change, answered or not', () => {
    const marked = markStep([question, mistake], { choice: [] }, true)

    expect(marked.byBlock.choice).toMatchObject({ score: 0, explanation: 'Hello is a greeting.' })
    expect(marked.byBlock.mistake).toMatchObject({ score: 0, explanation: 'go → goes' })
  })
})

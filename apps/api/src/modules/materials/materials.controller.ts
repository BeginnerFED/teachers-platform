import {
  binSelectionBody,
  checkAnswersBody,
  createMaterialBody,
  createStepBody,
  listMaterialsQuery,
  materialIdParam,
  reorderStepsBody,
  stepIdParam,
  updateMaterialBody,
  updateStepBody,
} from '@tp/shared'
import { getAuth, type AppEnv } from '../../http/context'
import { factory } from '../../http/factory'
import { validate } from '../../http/validate'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/require-role'
import { materialsService, type Viewer } from './materials.service'
import type { Context } from 'hono'

/**
 * The library belongs to whoever teaches from it, so unlike the admin modules these routes
 * are open to teachers as well. Students reach content through an assignment instead, and
 * so are not let in here.
 */
const authors = [requireAuth, requireRole('admin', 'teacher')] as const

const viewer = (c: Context<AppEnv>): Viewer => {
  const auth = getAuth(c)

  return { id: auth.userId, role: auth.role }
}

export const listMaterials = factory.createHandlers(
  ...authors,
  validate('query', listMaterialsQuery),
  async (c) => {
    const { items, meta } = await materialsService.list(c.req.valid('query'), viewer(c))

    return c.json({ data: items, meta })
  },
)

/**
 * The six levels and what stands at each. Its own endpoint rather than a page of the
 * list: the sidebar wants the shape of the whole library, not a slice of it.
 */
export const listLevels = factory.createHandlers(...authors, async (c) => {
  const data = await materialsService.levelShelves(viewer(c))

  return c.json({ data })
})

export const getMaterial = factory.createHandlers(
  ...authors,
  validate('param', materialIdParam),
  async (c) => {
    const data = await materialsService.getDetail(c.req.valid('param').materialId, viewer(c))

    return c.json({ data })
  },
)

/** The same lesson with the answer key removed. What a student is sent, and only this. */
export const playMaterial = factory.createHandlers(
  requireAuth,
  validate('param', materialIdParam),
  async (c) => {
    const data = await materialsService.getForStudent(c.req.valid('param').materialId, viewer(c))

    return c.json({ data })
  },
)

/** Marks one step and stores nothing. The only way an answer can be told right from wrong. */
export const checkStep = factory.createHandlers(
  requireAuth,
  validate('param', stepIdParam),
  validate('json', checkAnswersBody),
  async (c) => {
    const { materialId, stepId } = c.req.valid('param')
    const data = await materialsService.checkStep(
      materialId,
      stepId,
      c.req.valid('json').answers,
      viewer(c),
    )

    return c.json({ data })
  },
)

export const createMaterial = factory.createHandlers(
  ...authors,
  validate('json', createMaterialBody),
  async (c) => {
    const data = await materialsService.create(c.req.valid('json'), viewer(c))

    return c.json({ data }, 201)
  },
)

export const updateMaterial = factory.createHandlers(
  ...authors,
  validate('param', materialIdParam),
  validate('json', updateMaterialBody),
  async (c) => {
    const data = await materialsService.update(
      c.req.valid('param').materialId,
      c.req.valid('json'),
      viewer(c),
    )

    return c.json({ data })
  },
)

export const deleteMaterial = factory.createHandlers(
  ...authors,
  validate('param', materialIdParam),
  async (c) => {
    const data = await materialsService.remove(c.req.valid('param').materialId, viewer(c))

    return c.json({ data })
  },
)

export const restoreMaterial = factory.createHandlers(
  ...authors,
  validate('param', materialIdParam),
  async (c) => {
    const data = await materialsService.restore(c.req.valid('param').materialId, viewer(c))

    return c.json({ data })
  },
)

/** Several out of the bin at once, or the whole bin. */
export const restoreBin = factory.createHandlers(
  ...authors,
  validate('json', binSelectionBody),
  async (c) => {
    const data = await materialsService.restoreBinned(c.req.valid('json'), viewer(c))

    return c.json({ data })
  },
)

/** Several out of the bin for good, or the whole bin. */
export const purgeBin = factory.createHandlers(
  ...authors,
  validate('json', binSelectionBody),
  async (c) => {
    const data = await materialsService.purgeBinned(c.req.valid('json'), viewer(c))

    return c.json({ data })
  },
)

export const copyMaterial = factory.createHandlers(
  ...authors,
  validate('param', materialIdParam),
  async (c) => {
    const data = await materialsService.copy(c.req.valid('param').materialId, viewer(c))

    return c.json({ data }, 201)
  },
)

export const addStep = factory.createHandlers(
  ...authors,
  validate('param', materialIdParam),
  validate('json', createStepBody),
  async (c) => {
    const data = await materialsService.addStep(
      c.req.valid('param').materialId,
      c.req.valid('json'),
      viewer(c),
    )

    return c.json({ data }, 201)
  },
)

export const updateStep = factory.createHandlers(
  ...authors,
  validate('param', stepIdParam),
  validate('json', updateStepBody),
  async (c) => {
    const { materialId, stepId } = c.req.valid('param')
    const data = await materialsService.updateStep(
      materialId,
      stepId,
      c.req.valid('json'),
      viewer(c),
    )

    return c.json({ data })
  },
)

export const deleteStep = factory.createHandlers(
  ...authors,
  validate('param', stepIdParam),
  async (c) => {
    const { materialId, stepId } = c.req.valid('param')
    await materialsService.removeStep(materialId, stepId, viewer(c))

    return c.json({ data: { id: stepId } })
  },
)

export const reorderSteps = factory.createHandlers(
  ...authors,
  validate('param', materialIdParam),
  validate('json', reorderStepsBody),
  async (c) => {
    const data = await materialsService.reorderSteps(
      c.req.valid('param').materialId,
      c.req.valid('json').orderedStepIds,
      viewer(c),
    )

    return c.json({ data })
  },
)

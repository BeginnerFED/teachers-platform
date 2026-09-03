import type {
  CreateMaterialBody,
  Enums,
  Json,
  ListMaterialsQuery,
  MaterialDetail,
  MaterialListItem,
  MaterialStep,
  PageMeta,
  StepCheckResult,
  StudentMaterial,
  UpdateMaterialBody,
  UpdateStepBody,
} from '@tp/shared'
import { gradeBlocks } from '@tp/shared'
import { ConflictError, ForbiddenError, NotFoundError, RuleViolationError } from '../../http/errors'
import {
  parseBlocks,
  toMaterialDetail,
  toMaterialListItem,
  toMaterialStep,
  toStudentMaterial,
} from './materials.mapper'
import {
  materialsRepository,
  type MaterialRow,
  type MaterialsRepository,
} from './materials.repository'

/** Who is asking. Taken from the request's auth context rather than re-read per call. */
export type Viewer = {
  id: string
  role: Enums<'user_role'>
}

export type MaterialsServiceDeps = {
  materials: MaterialsRepository
}

/**
 * Yours, or the published official library. Deliberately the same rule the RLS policy
 * states, because the API runs as service_role and RLS is only the second line.
 */
function canRead(row: MaterialRow, viewer: Viewer) {
  if (row.owner_id === viewer.id) return true

  return row.deleted_at === null && row.visibility === 'platform' && row.status === 'published'
}

export function createMaterialsService({ materials }: MaterialsServiceDeps) {
  /**
   * A material the caller may not read is reported as missing rather than forbidden: the
   * difference between the two answers tells them it exists, which is itself a leak.
   */
  async function readable(materialId: string, viewer: Viewer): Promise<MaterialRow> {
    const row = await materials.findById(materialId)

    if (!row || !canRead(row, viewer)) throw new NotFoundError('No such material')

    return row
  }

  /**
   * Editing is the owner's alone. Here a 403 is right and not a leak — the caller can
   * already see the material, so refusing to say why would only be confusing.
   */
  async function editable(materialId: string, viewer: Viewer): Promise<MaterialRow> {
    const row = await readable(materialId, viewer)

    if (row.owner_id !== viewer.id) {
      throw new ForbiddenError('Only the author can change this material')
    }

    return row
  }

  /**
   * The gate on playing a lesson, as opposed to browsing the library. A student reaches
   * content through homework or a live lesson, never by holding an id — assignments are
   * what will grant this, so until they exist the honest answer is no. Teachers and the
   * admin come through here to preview a lesson exactly as it will be seen.
   */
  async function playable(materialId: string, viewer: Viewer): Promise<MaterialRow> {
    if (viewer.role === 'student') throw new NotFoundError('No such material')

    return readable(materialId, viewer)
  }

  return {
    async list(
      params: ListMaterialsQuery,
      viewer: Viewer,
    ): Promise<{ items: MaterialListItem[]; meta: PageMeta }> {
      const { rows, total } = await materials.list({ ...params, viewerId: viewer.id })

      return {
        items: rows.map((row) => toMaterialListItem(row, viewer.id)),
        meta: { page: params.page, perPage: params.perPage, total },
      }
    },

    async getDetail(materialId: string, viewer: Viewer): Promise<MaterialDetail> {
      const row = await readable(materialId, viewer)

      return toMaterialDetail(row, await materials.stepsFor(materialId), viewer.id)
    },

    /** The student's copy: every answer stripped, by the one function that knows them all. */
    async getForStudent(materialId: string, viewer: Viewer): Promise<StudentMaterial> {
      const row = await playable(materialId, viewer)

      return toStudentMaterial(row, await materials.stepsFor(materialId))
    },

    /**
     * Marks one step and records nothing. The answer key never leaves the server, so this
     * is the only way an answer can be told right from wrong — and keeping it stateless
     * means the player works before assignments exist and unchanged after they do.
     */
    async checkStep(
      materialId: string,
      stepId: string,
      answers: Record<string, unknown>,
      viewer: Viewer,
    ): Promise<StepCheckResult> {
      const row = await playable(materialId, viewer)
      const step = await materials.findStep(row.id, stepId)

      if (!step) throw new NotFoundError('No such step')

      const blocks = parseBlocks(step.blocks)
      const graded = gradeBlocks(blocks, answers)

      return {
        autoScore: graded.autoScore,
        autoMax: graded.autoMax,
        manualMax: graded.manualMax,
        byBlock: Object.fromEntries(
          Object.entries(graded.byBlock).map(([blockId, grade]) => {
            const block = blocks.find((candidate) => candidate.id === blockId)
            // Held back until the question has been answered, which is the only moment an
            // explanation teaches anything rather than giving the answer away.
            const explanation =
              block?.type === 'multiple_choice' && block.explanation
                ? { explanation: block.explanation }
                : {}

            return [blockId, { ...grade, ...explanation }]
          }),
        ),
      }
    },

    async create(body: CreateMaterialBody, viewer: Viewer): Promise<MaterialDetail> {
      // The official library is the platform's voice. A teacher writing to it would be
      // publishing in the platform's name, so this is a 403 rather than a validation error.
      if (body.visibility === 'platform' && viewer.role !== 'admin') {
        throw new ForbiddenError('Only an administrator can publish to the platform library')
      }

      const row = await materials.insert({
        owner_id: viewer.id,
        title: body.title,
        description: body.description ?? null,
        level: body.level,
        tags: body.tags,
        visibility: body.visibility,
        estimated_minutes: body.estimatedMinutes ?? null,
      })

      return toMaterialDetail(row, [], viewer.id)
    },

    async update(
      materialId: string,
      body: UpdateMaterialBody,
      viewer: Viewer,
    ): Promise<MaterialDetail> {
      await editable(materialId, viewer)

      // Publishing into the official library speaks in the platform's name, so it is the
      // admin's to do — the same rule creation follows, applied to the other door.
      if (body.visibility !== undefined && viewer.role !== 'admin') {
        throw new ForbiddenError('Only an administrator can change where a lesson is published')
      }

      const updated = await materials.update(materialId, {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.level !== undefined && { level: body.level }),
        ...(body.tags !== undefined && { tags: body.tags }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.visibility !== undefined && { visibility: body.visibility }),
        ...(body.estimatedMinutes !== undefined && { estimated_minutes: body.estimatedMinutes }),
      })

      if (!updated) throw new NotFoundError('No such material')

      return toMaterialDetail(updated, await materials.stepsFor(materialId), viewer.id)
    },

    /** Soft. A teacher throws work away and wants it back an hour later. */
    async remove(materialId: string, viewer: Viewer): Promise<MaterialListItem> {
      const row = await editable(materialId, viewer)

      if (row.deleted_at) throw new ConflictError('That material is already in the bin')

      const updated = await materials.update(materialId, { deleted_at: new Date().toISOString() })

      if (!updated) throw new NotFoundError('No such material')

      return toMaterialListItem(updated, viewer.id)
    },

    async restore(materialId: string, viewer: Viewer): Promise<MaterialListItem> {
      const row = await editable(materialId, viewer)

      if (!row.deleted_at) throw new ConflictError('That material is not in the bin')

      const updated = await materials.update(materialId, { deleted_at: null })

      if (!updated) throw new NotFoundError('No such material')

      return toMaterialListItem(updated, viewer.id)
    },

    /**
     * A frozen copy. The point of copying is that a teacher can change it; the point of
     * freezing is that improving the original never rewrites their changed version
     * underneath them. `source_material_id` records where it came from and nothing more.
     */
    async copy(materialId: string, viewer: Viewer): Promise<MaterialDetail> {
      const source = await readable(materialId, viewer)

      if (source.deleted_at) throw new NotFoundError('No such material')

      const created = await materials.insert({
        owner_id: viewer.id,
        title: source.title,
        description: source.description,
        level: source.level,
        tags: source.tags,
        // Always the copier's own private draft, whoever they are. An admin duplicating a
        // platform lesson gets a draft to work on rather than a second published one.
        visibility: 'private',
        status: 'draft',
        estimated_minutes: source.estimated_minutes,
        source_material_id: source.id,
      })

      const steps = await materials.stepsFor(materialId)

      await materials.insertSteps(
        steps.map((step) => ({
          material_id: created.id,
          position: step.position,
          title: step.title,
          blocks: step.blocks,
        })),
      )

      return toMaterialDetail(created, await materials.stepsFor(created.id), viewer.id)
    },

    async addStep(
      materialId: string,
      body: { title?: string; position?: number },
      viewer: Viewer,
    ): Promise<MaterialStep> {
      await editable(materialId, viewer)

      const steps = await materials.stepsFor(materialId)
      // One past the highest, not one past the count: deleting a step leaves a gap, and
      // counting instead of measuring would land the new step on top of an existing one.
      const nextPosition = steps.reduce((max, step) => Math.max(max, step.position + 1), 0)

      const created = await materials.insertStep({
        material_id: materialId,
        title: body.title ?? null,
        position: nextPosition,
      })

      const index =
        body.position === undefined ? steps.length : Math.min(body.position, steps.length)

      // Appending is the common case and costs nothing extra. Inserting in the middle
      // rewrites every position once, in one statement.
      if (index === steps.length) return toMaterialStep(created)

      const ids = steps.map((step) => step.id)
      ids.splice(index, 0, created.id)
      await materials.reorderSteps(materialId, ids)

      return { ...toMaterialStep(created), position: index }
    },

    async updateStep(
      materialId: string,
      stepId: string,
      body: UpdateStepBody,
      viewer: Viewer,
    ): Promise<MaterialStep> {
      await editable(materialId, viewer)

      // Checked before the write so that a step belonging to another material is a 404
      // rather than an update that silently matches nothing.
      const existing = await materials.findStep(materialId, stepId)
      if (!existing) throw new NotFoundError('No such step')

      const updated = await materials.updateStep(
        stepId,
        {
          ...(body.title !== undefined && { title: body.title }),
          // A draft's index signature is `unknown`, which TypeScript cannot prove is JSON.
          // It is: it arrived as a JSON body and passed the draft schema on the way in.
          ...(body.blocks !== undefined && { blocks: body.blocks as Json }),
        },
        body.expectedUpdatedAt,
      )

      if (!updated) {
        throw new ConflictError('That step was changed somewhere else while you were editing it')
      }

      return toMaterialStep(updated)
    },

    async removeStep(materialId: string, stepId: string, viewer: Viewer): Promise<void> {
      await editable(materialId, viewer)

      const existing = await materials.findStep(materialId, stepId)
      if (!existing) throw new NotFoundError('No such step')

      await materials.deleteStep(materialId, stepId)
    },

    async reorderSteps(
      materialId: string,
      orderedStepIds: string[],
      viewer: Viewer,
    ): Promise<MaterialStep[]> {
      await editable(materialId, viewer)

      const steps = await materials.stepsFor(materialId)
      const known = new Set(steps.map((step) => step.id))

      // Every step, exactly once. A partial list would leave the omitted ones sharing a
      // position with the listed ones, and the order would then depend on nothing.
      const complete =
        orderedStepIds.length === known.size && orderedStepIds.every((id) => known.has(id))

      if (!complete) {
        throw new RuleViolationError('The new order must list every step of this material once')
      }

      await materials.reorderSteps(materialId, orderedStepIds)

      return (await materials.stepsFor(materialId)).map(toMaterialStep)
    },
  }
}

export type MaterialsService = ReturnType<typeof createMaterialsService>

export const materialsService = createMaterialsService({ materials: materialsRepository })

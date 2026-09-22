import type {
  BinSelectionBody,
  CreateMaterialBody,
  Enums,
  Json,
  ListMaterialsQuery,
  MaterialDetail,
  MaterialLevelShelf,
  MaterialListItem,
  MaterialStep,
  PageMeta,
  ReplaceLessonWithAiDraftBody,
  StepCheckResult,
  StudentMaterial,
  UpdateMaterialBody,
  UpdateStepBody,
} from '@tp/shared'
import { BIN_RETENTION_DAYS, estimateMinutes, LEVEL_SHELF_SIZE, LEVELS } from '@tp/shared'
import { ConflictError, ForbiddenError, NotFoundError, RuleViolationError } from '../../http/errors'
import { logger } from '../../lib/logger'
import { assetPath, assetsRepository, type AssetsRepository } from '../assets/assets.repository'
import { liveRepository, type LiveRepository } from '../live/live.repository'
import {
  assignmentsRepository,
  type AssignmentsRepository,
} from '../assignments/assignments.repository'
import { markStep } from './marking'
import {
  parseBlocks,
  parseDrafts,
  toMaterialDetail,
  toMaterialListItem,
  toMaterialStep,
  toStudentMaterial,
} from './materials.mapper'
import {
  AiDraftPreservedStepsChangedError,
  materialsRepository,
  type MaterialPurgeJob,
  type MaterialRow,
  type MaterialsRepository,
} from './materials.repository'

/** Who is asking. Taken from the request's auth context rather than re-read per call. */
export type Viewer = {
  id: string
  role: Enums<'user_role'>
}

/** Signed upload URLs live for two hours; this extra margin catches a request already in flight. */
const SIGNED_UPLOAD_GRACE_MS = 4 * 60 * 60_000

export type MaterialsServiceDeps = {
  materials: MaterialsRepository
  /** The one question homework answers for the library: may this student play this? */
  assignments: Pick<AssignmentsRepository, 'isAssigned' | 'openFor'>
  /** Copying a lesson copies its files too; see `copyAssets`. Purging one removes its folder. */
  assets: Pick<AssetsRepository, 'listFor' | 'insert' | 'copyObject' | 'deleteFolder'>
  /** The other way a student reaches a lesson: being in the room where it is taught. */
  live: Pick<LiveRepository, 'isLiveFor' | 'isMaterialActive'>
}

/**
 * Rewrites the asset ids inside a step's blocks. Walked as plain JSON rather than parsed
 * as blocks: which fields hold an asset is a fact about two field names, and going through
 * the schema would quietly drop any block a copy happened to catch mid-edit.
 */
function remapAssets(blocks: Json, mapping: Map<string, string>): Json {
  if (!Array.isArray(blocks) || mapping.size === 0) return blocks

  return blocks.map((block) => {
    if (block === null || typeof block !== 'object' || Array.isArray(block)) return block

    const next = { ...block } as Record<string, Json>

    for (const field of ['assetId', 'audioAssetId']) {
      const value = next[field]
      const replacement = typeof value === 'string' ? mapping.get(value) : undefined

      if (replacement) next[field] = replacement
    }

    return next
  })
}

/**
 * Yours, or the published official library. Deliberately the same rule the RLS policy
 * states, because the API runs as service_role and RLS is only the second line.
 */
export function canRead(row: MaterialRow, viewer: Viewer) {
  if (row.owner_id === viewer.id) return true

  return row.deleted_at === null && row.visibility === 'platform' && row.status === 'published'
}

export function createMaterialsService({
  materials,
  assignments,
  assets,
  live,
}: MaterialsServiceDeps) {
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

    if (await live.isMaterialActive(materialId)) {
      throw new ConflictError('End the live lesson before changing its material')
    }

    return row
  }

  /**
   * Re-guess how long the lesson takes from its steps as they now are. Called after every
   * write that changes what a student would sit through; one extra read per autosave,
   * which the debounce keeps rare enough not to matter.
   */
  async function refreshDuration(materialId: string): Promise<void> {
    const steps = await materials.stepsFor(materialId)
    const minutes = estimateMinutes(steps.map((step) => ({ blocks: parseDrafts(step.blocks) })))
    await materials.update(materialId, { duration_minutes: minutes })
  }

  /** The moment before which a binned lesson has waited its full term. */
  function expiry(): string {
    return new Date(Date.now() - BIN_RETENTION_DAYS * 86_400_000).toISOString()
  }

  /** Cleans one leased job. Its database row keeps the folder discoverable across crashes. */
  async function cleanPurgeJob(job: MaterialPurgeJob): Promise<void> {
    // This transaction deletes only asset rows no frozen homework references. Doing that
    // before Storage makes the FK the final race guard; a crash is still safe because the
    // durable job preserves the folder id and the next pass sweeps unretained objects.
    const retained = await materials.preparePurgeJob(job)

    // Also removes old uploads whose block/row disappeared before the lesson was binned.
    await assets.deleteFolder(job.material_id, retained)

    const uploadGraceEnds = Date.parse(job.created_at) + SIGNED_UPLOAD_GRACE_MS
    if (retained.length === 0 && Date.now() >= uploadGraceEnds) {
      await materials.finishPurgeJob(job)
      return
    }

    // Frozen homework may keep files for months. A freshly deleted lesson also keeps one
    // delayed pass: a signed upload minted just before deletion remains usable for two
    // hours and could otherwise put an object back after the first sweep finished.
    await materials.deferPurgeJob(
      job,
      new Date(
        retained.length > 0 ? Date.now() + 24 * 60 * 60_000 : Math.max(Date.now(), uploadGraceEnds),
      ).toISOString(),
    )
  }

  async function attemptPurgeJob(job: MaterialPurgeJob): Promise<void> {
    try {
      await cleanPurgeJob(job)
    } catch (error) {
      const delayMinutes = Math.min(2 ** Math.min(job.attempts, 8), 360)
      try {
        const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown error'
        await materials.deferPurgeJob(
          job,
          new Date(Date.now() + delayMinutes * 60_000).toISOString(),
          message,
        )
      } catch (deferError) {
        logger.error(
          { err: deferError, materialId: job.material_id },
          'could not defer material purge cleanup',
        )
      }
      logger.warn(
        { err: error, materialId: job.material_id },
        'material purge cleanup will be retried',
      )
    }
  }

  async function retryPurgeJobs(ownerId: string): Promise<void> {
    let jobs: MaterialPurgeJob[]
    try {
      jobs = await materials.leasePurgeJobs(ownerId, 5)
    } catch (error) {
      // Cleanup is maintenance. A temporary lease/read failure must not make the owner's
      // library unavailable; the durable rows make the next request another safe chance.
      logger.warn({ err: error, ownerId }, 'could not lease material purge jobs')
      return
    }

    for (const job of jobs) {
      await attemptPurgeJob(job)
    }
  }

  /**
   * Claim each exact bin entry and record its cleanup in the same transaction. A restore
   * that wins leaves the lesson intact; an assignment that wins is visible to the cleanup
   * after the delete commits. Storage failures leave a durable job rather than lost files.
   */
  async function purgeRows(rows: MaterialRow[]): Promise<number> {
    let deleted = 0
    for (const row of rows) {
      if (!row.deleted_at) continue
      if (!(await materials.claimBinnedForPurge(row.id, row.owner_id, row.deleted_at))) continue
      deleted += 1
    }

    if (deleted > 0 && rows[0]) await retryPurgeJobs(rows[0].owner_id)

    return deleted
  }

  /**
   * The gate on playing a lesson, as opposed to browsing the library. A student reaches
   * content through homework or a live lesson, never by holding an id: a lesson they were
   * given plays even when it is the teacher's private draft, and one they were not is not
   * there. Teachers and the admin come through here to preview a lesson exactly as it
   * will be seen.
   */
  async function playable(materialId: string, viewer: Viewer): Promise<MaterialRow> {
    if (viewer.role !== 'student') return readable(materialId, viewer)

    const row = await materials.findById(materialId)

    const reached =
      row &&
      !row.deleted_at &&
      ((await assignments.isAssigned(materialId, viewer.id)) ||
        (await live.isLiveFor(materialId, viewer.id)))

    if (!row || !reached) {
      throw new NotFoundError('No such material')
    }

    return row
  }

  /**
   * The library marker is deliberately stateless, which makes it unsuitable for homework:
   * it cannot remember that a step was checked and must keep the answers that earned those
   * marks. Students therefore use it only while reaching an otherwise-unassigned lesson
   * through a live room. Teachers and administrators still use it for ordinary previews.
   */
  async function independentlyCheckable(materialId: string, viewer: Viewer): Promise<MaterialRow> {
    if (viewer.role !== 'student') return readable(materialId, viewer)

    const row = await materials.findById(materialId)
    if (!row || row.deleted_at) throw new NotFoundError('No such material')

    if ((await assignments.openFor(materialId, [viewer.id])).includes(viewer.id)) {
      throw new ForbiddenError('Homework steps must be checked through the assignment')
    }

    if (!(await live.isLiveFor(materialId, viewer.id))) {
      throw new NotFoundError('No such material')
    }

    return row
  }

  /**
   * A copy gets its own files, not a share of the original's. The whole point of freezing
   * a copy is that the original can change or go away without touching it, and a picture
   * that vanishes when the platform tidies its library would break that promise quietly.
   *
   * Returns old id → new id, so the copied blocks can be pointed at the right ones.
   */
  async function copyAssets(
    fromMaterialId: string,
    toMaterialId: string,
    ownerId: string,
  ): Promise<Map<string, string>> {
    const mapping = new Map<string, string>()

    for (const row of await assets.listFor(fromMaterialId)) {
      const id = crypto.randomUUID()
      const path = assetPath(toMaterialId, id, row.mime_type)

      await assets.copyObject(row.path, path)
      await assets.insert({
        id,
        material_id: toMaterialId,
        owner_id: ownerId,
        kind: row.kind,
        path,
        mime_type: row.mime_type,
        size_bytes: row.size_bytes,
        file_name: row.file_name,
        // The bytes are already there — this row is confirmed the moment it exists.
        uploaded_at: new Date().toISOString(),
      })

      mapping.set(row.id, id)
    }

    return mapping
  }

  return {
    // Shared with the assets module, so "may I see this file" and "may I see this lesson"
    // can never drift into being two different rules.
    editable,
    playable,

    async list(
      params: ListMaterialsQuery,
      viewer: Viewer,
    ): Promise<{ items: MaterialListItem[]; meta: PageMeta }> {
      await retryPurgeJobs(viewer.id)
      // The bin empties itself of what has waited too long, on the way in. Done here,
      // where the bin is looked at, rather than by a clock: there is no scheduler yet,
      // and what the page says about thirty days is then true of what it shows.
      if (params.deleted)
        await purgeRows(await materials.listBinned(viewer.id, { before: expiry() }))

      const { rows, total } = await materials.list({ ...params, viewerId: viewer.id })

      return {
        items: rows.map((row) => toMaterialListItem(row, viewer.id)),
        meta: { page: params.page, perPage: params.perPage, total },
      }
    },

    /**
     * The shape of the library: each level, what stands at it, and how much of it there
     * is. Six small queries at once rather than one big one — each brings back at most a
     * shelf's worth of rows and counts the rest in the database, so the answer is the
     * same size at four hundred lessons as at four.
     */
    async levelShelves(viewer: Viewer): Promise<MaterialLevelShelf[]> {
      return Promise.all(
        LEVELS.map(async (level) => {
          const { rows, total } = await materials.shelfAtLevel({
            level,
            limit: LEVEL_SHELF_SIZE,
            viewerId: viewer.id,
          })

          return { level, total, lessons: rows }
        }),
      )
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
     * is the only way an answer can be told right from wrong outside homework. Homework
     * uses its progress endpoint so checking a step also locks the answers it marked.
     */
    async checkStep(
      materialId: string,
      stepId: string,
      answers: Record<string, unknown>,
      viewer: Viewer,
    ): Promise<StepCheckResult> {
      const row = await independentlyCheckable(materialId, viewer)
      const step = await materials.findStep(row.id, stepId)

      if (!step) throw new NotFoundError('No such step')

      return markStep(parseBlocks(step.blocks), answers)
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
     * Several back at once, or all of them. Ids that are not the caller's, or not in the
     * bin, are not restored and not reported: the count says what happened, and a bin is
     * not a place to learn what exists in somebody else's.
     */
    async restoreBinned(body: BinSelectionBody, viewer: Viewer): Promise<{ restored: number }> {
      return { restored: await materials.restoreBinned(viewer.id, body.materialIds) }
    },

    /**
     * Gone for good — the named ones, or everything in the bin. Only from the bin: a
     * lesson has to be thrown away before it can be destroyed, so that no single click
     * ever reaches this. Existing homework keeps its frozen copy and referenced files.
     */
    async purgeBinned(body: BinSelectionBody, viewer: Viewer): Promise<{ deleted: number }> {
      await retryPurgeJobs(viewer.id)
      const rows = await materials.listBinned(viewer.id, { ids: body.materialIds })

      return { deleted: await purgeRows(rows) }
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
        source_material_id: source.id,
      })

      const steps = await materials.stepsFor(materialId)
      const assetMapping = await copyAssets(source.id, created.id, viewer.id)

      await materials.insertSteps(
        steps.map((step) => ({
          material_id: created.id,
          position: step.position,
          title: step.title,
          blocks: remapAssets(step.blocks, assetMapping),
        })),
      )
      await refreshDuration(created.id)

      const copied = (await materials.findById(created.id)) ?? created

      return toMaterialDetail(copied, await materials.stepsFor(created.id), viewer.id)
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
      await refreshDuration(materialId)

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

      if (body.blocks !== undefined) await refreshDuration(materialId)

      return toMaterialStep(updated)
    },

    async removeStep(materialId: string, stepId: string, viewer: Viewer): Promise<void> {
      await editable(materialId, viewer)

      const existing = await materials.findStep(materialId, stepId)
      if (!existing) throw new NotFoundError('No such step')

      await materials.deleteStep(materialId, stepId)
      await refreshDuration(materialId)
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

    /**
     * Accepts a reviewed AI proposal as one database transaction. The RPC repeats the
     * ownership and optimistic-lock checks while holding row locks, then updates metadata,
     * creates the generated steps, removes the reviewed originals and orders everything.
     */
    async replaceWithAiDraft(
      materialId: string,
      body: ReplaceLessonWithAiDraftBody,
      viewer: Viewer,
    ): Promise<MaterialStep[]> {
      await editable(materialId, viewer)

      const originalIds = new Set(body.originalSteps.map((step) => step.id))

      // A newly-added step is preserved, but it may itself still be autosaving. Re-read
      // that survivor snapshot a few times if it changes before the RPC obtains its short
      // table lock. A reviewed original changing is never retried: the RPC returns 409.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const current = await materials.stepsFor(materialId)
        const preserved = current.filter((step) => !originalIds.has(step.id))
        const durationMinutes = estimateMinutes([
          ...body.draft.steps.map((step) => ({ blocks: step.blocks })),
          ...preserved.map((step) => ({ blocks: parseDrafts(step.blocks) })),
        ])

        try {
          const rows = await materials.replaceWithAiDraft({
            materialId,
            actorId: viewer.id,
            title: body.draft.title,
            description: body.draft.description || null,
            level: body.draft.level,
            tags: body.draft.tags,
            durationMinutes,
            expectedMetadata: body.expectedMetadata,
            originalSteps: body.originalSteps,
            preservedSteps: preserved.map((step) => ({
              id: step.id,
              updatedAt: step.updated_at,
            })),
            generatedSteps: body.draft.steps.map((step) => ({
              title: step.title,
              blocks: step.blocks as Json,
            })),
          })

          return rows.map(toMaterialStep)
        } catch (error) {
          if (error instanceof AiDraftPreservedStepsChangedError && attempt < 2) continue
          if (error instanceof AiDraftPreservedStepsChangedError) {
            throw new ConflictError('The lesson kept changing while the AI draft was applied')
          }

          throw error
        }
      }

      throw new ConflictError('The lesson changed while the AI draft was applied')
    },
  }
}

export type MaterialsService = ReturnType<typeof createMaterialsService>

export const materialsService = createMaterialsService({
  materials: materialsRepository,
  assignments: assignmentsRepository,
  assets: assetsRepository,
  live: liveRepository,
})

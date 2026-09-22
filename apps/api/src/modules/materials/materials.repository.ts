import type {
  AiDraftMaterialMetadata,
  Json,
  Level,
  MaterialScope,
  MaterialStatus,
  Tables,
  TablesInsert,
  TablesUpdate,
} from '@tp/shared'
import { ConflictError, ForbiddenError, NotFoundError } from '../../http/errors'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'
import { searchPattern } from '../../lib/supabase/search'

export type MaterialOwnerRow = Pick<Tables<'profiles'>, 'id' | 'full_name' | 'email'>

export type MaterialRow = Tables<'materials'> & {
  /** Null only if the profile went missing, which the foreign key prevents. */
  owner: MaterialOwnerRow | null
  /** PostgREST returns an aggregate as a one-element array, or empty for none. */
  material_steps: { count: number }[]
  /** Only asked for on the bin, where it is the one thing to weigh before purging. */
  assignments?: { count: number }[]
}

export type MaterialStepRow = Tables<'material_steps'>
export type MaterialPurgeJob = Pick<
  Tables<'material_purge_jobs'>,
  'material_id' | 'owner_id' | 'attempts' | 'created_at'
> & { lease_token: string }

/** The non-destructive survivor snapshot changed; the service may safely re-read/retry. */
export class AiDraftPreservedStepsChangedError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('Steps added while the AI draft was open changed again', options)
    this.name = 'AiDraftPreservedStepsChangedError'
  }
}

/** A lesson as a shelf lists it: enough to name it and to link to it. */
export type LessonRow = Pick<Tables<'materials'>, 'id' | 'title'>

export type LevelShelfParams = {
  level: Level
  /** How many rows to bring back. The total is counted whatever this is. */
  limit: number
  /** Whose shelf: their own work, plus what the platform has published. */
  viewerId: string
}

export type ListMaterialsParams = {
  page: number
  perPage: number
  scope: MaterialScope
  level?: Tables<'materials'>['level']
  tag?: string
  status?: MaterialStatus
  query?: string
  deleted: boolean
  /** Whose shelf "mine" means, and whose bin. */
  viewerId: string
}

export type MaterialsRepository = {
  list(params: ListMaterialsParams): Promise<{ rows: MaterialRow[]; total: number }>
  /**
   * The newest lessons at one level, and how many there are in all. Bounded on purpose:
   * the count comes from the database rather than from the rows, so the answer stays the
   * same size whether the level holds four lessons or four hundred.
   */
  shelfAtLevel(params: LevelShelfParams): Promise<{ rows: LessonRow[]; total: number }>
  findById(id: string): Promise<MaterialRow | null>
  insert(values: TablesInsert<'materials'>): Promise<MaterialRow>
  update(id: string, patch: TablesUpdate<'materials'>): Promise<MaterialRow | null>
  /**
   * What is in somebody's bin: all of it, the named ones, or only what has waited past
   * a date. Ids that are not theirs or not binned are simply not among the rows.
   */
  listBinned(ownerId: string, filter?: { ids?: string[]; before?: string }): Promise<MaterialRow[]>
  /** Back on the shelf, all of somebody's or the named ones, in one statement. */
  restoreBinned(ownerId: string, ids?: string[]): Promise<number>
  /** Atomically claims this exact bin entry, records a retryable cleanup job and deletes it. */
  claimBinnedForPurge(id: string, ownerId: string, deletedAt: string): Promise<boolean>
  /** Gives each due job to at most one worker until its short lease expires. */
  leasePurgeJobs(ownerId: string, limit: number): Promise<MaterialPurgeJob[]>
  /** Removes unreferenced asset rows under the lease and returns the frozen files to retain. */
  preparePurgeJob(job: MaterialPurgeJob): Promise<string[]>
  deferPurgeJob(job: MaterialPurgeJob, nextAttemptAt: string, error?: string): Promise<boolean>
  finishPurgeJob(job: MaterialPurgeJob): Promise<boolean>
  stepsFor(materialId: string): Promise<MaterialStepRow[]>
  findStep(materialId: string, stepId: string): Promise<MaterialStepRow | null>
  insertStep(values: TablesInsert<'material_steps'>): Promise<MaterialStepRow>
  insertSteps(values: TablesInsert<'material_steps'>[]): Promise<void>
  updateStep(
    stepId: string,
    patch: TablesUpdate<'material_steps'>,
    expectedUpdatedAt?: string,
  ): Promise<MaterialStepRow | null>
  deleteStep(materialId: string, stepId: string): Promise<void>
  reorderSteps(materialId: string, orderedStepIds: string[]): Promise<void>
  /** Replaces lesson metadata and reviewed steps in one database transaction. */
  replaceWithAiDraft(params: {
    materialId: string
    actorId: string
    title: string
    description: string | null
    level: Level
    tags: string[]
    durationMinutes: number
    expectedMetadata: AiDraftMaterialMetadata
    originalSteps: { id: string; updatedAt: string }[]
    preservedSteps: { id: string; updatedAt: string }[]
    generatedSteps: { title: string; blocks: Json }[]
  }): Promise<MaterialStepRow[]>
}

const OWNER = 'owner:profiles!materials_owner_id_fkey(id,full_name,email)'
const SELECT = `*,${OWNER},material_steps(count)`
// The bin also counts the homework each lesson carries. Not on the shelf: there the
// number would cost a subquery per card and answer a question nobody is asking.
const SELECT_BINNED = `${SELECT},assignments(count)`

/**
 * What "the library" means to the person asking. A teacher sees the published official
 * shelf plus their own work and nothing else — one teacher's lessons are invisible to
 * another, and there is no admin exception, matching the rule the messaging tables follow.
 */
function visibleTo(viewerId: string) {
  return `owner_id.eq.${viewerId},and(visibility.eq.platform,status.eq.published)`
}

export const materialsRepository: MaterialsRepository = {
  async list({ page, perPage, scope, level, tag, status, query, deleted, viewerId }) {
    const from = (page - 1) * perPage

    let builder = supabaseAdmin
      .from('materials')
      .select(deleted ? SELECT_BINNED : SELECT, { count: 'exact' })

    if (deleted) {
      // The bin is only ever your own. Nobody browses somebody else's deleted work.
      builder = builder.eq('owner_id', viewerId).not('deleted_at', 'is', null)
    } else {
      builder = builder.is('deleted_at', null)

      if (scope === 'platform') {
        builder = builder.eq('visibility', 'platform').eq('status', 'published')
      } else if (scope === 'mine') {
        builder = builder.eq('owner_id', viewerId)
      } else {
        builder = builder.or(visibleTo(viewerId))
      }
    }

    if (level) builder = builder.eq('level', level)
    if (status) builder = builder.eq('status', status)
    if (tag) builder = builder.contains('tags', [tag])

    if (query) {
      const pattern = searchPattern(query)
      // A second `or` rather than one combined expression: PostgREST ands repeated `or`
      // parameters together, which is exactly the "visible to me AND matching the search"
      // this needs. Folding them into one would give "visible OR matching".
      builder = builder.or(`title.ilike.${pattern},description.ilike.${pattern}`)
    }

    const { data, error, count } = await builder
      // What was worked on most recently, which the step trigger keeps honest: editing a
      // step touches its material, so a lesson does not look stale because its title
      // happens not to have changed. The bin is ordered by when things were thrown away,
      // since the one you want back is usually the one you just threw.
      .order(deleted ? 'deleted_at' : 'updated_at', { ascending: false })
      .range(from, from + perPage - 1)
      .returns<MaterialRow[]>()

    if (error) throwFromPostgrest(error, 'list materials')

    return { rows: data ?? [], total: count ?? 0 }
  },

  async listBinned(ownerId, { ids, before } = {}) {
    let builder = supabaseAdmin
      .from('materials')
      .select(SELECT_BINNED)
      .eq('owner_id', ownerId)
      .not('deleted_at', 'is', null)

    if (ids) builder = builder.in('id', ids)
    if (before) builder = builder.lt('deleted_at', before)

    const { data, error } = await builder.returns<MaterialRow[]>()

    if (error) throwFromPostgrest(error, 'list bin')

    return data ?? []
  },

  async restoreBinned(ownerId, ids) {
    let builder = supabaseAdmin
      .from('materials')
      .update({ deleted_at: null }, { count: 'exact' })
      .eq('owner_id', ownerId)
      .not('deleted_at', 'is', null)

    if (ids) builder = builder.in('id', ids)

    const { error, count } = await builder

    if (error) throwFromPostgrest(error, 'restore materials')

    return count ?? 0
  },

  async claimBinnedForPurge(id, ownerId, deletedAt) {
    const { data, error } = await supabaseAdmin.rpc('claim_material_purge', {
      p_material: id,
      p_owner: ownerId,
      p_deleted_at: deletedAt,
    })

    if (error) throwFromPostgrest(error, 'purge material')
    return data
  },

  async leasePurgeJobs(ownerId, limit) {
    const { data, error } = await supabaseAdmin.rpc('lease_material_purge_jobs', {
      p_owner: ownerId,
      p_limit: limit,
    })

    if (error) throwFromPostgrest(error, 'lease material purge jobs')
    return data ?? []
  },

  async preparePurgeJob(job) {
    const { data, error } = await supabaseAdmin.rpc('prepare_material_purge_job', {
      p_material: job.material_id,
      p_owner: job.owner_id,
      p_lease_token: job.lease_token,
    })

    if (error) throwFromPostgrest(error, 'prepare material purge job')
    return data
  },

  async deferPurgeJob(job, nextAttemptAt, errorMessage) {
    const { data, error } = await supabaseAdmin.rpc('defer_material_purge_job', {
      p_material: job.material_id,
      p_owner: job.owner_id,
      p_lease_token: job.lease_token,
      p_next_attempt_at: nextAttemptAt,
      p_error: errorMessage ?? null,
    })

    if (error) throwFromPostgrest(error, 'defer material purge job')
    return data
  },

  async finishPurgeJob(job) {
    const { data, error } = await supabaseAdmin.rpc('finish_material_purge_job', {
      p_material: job.material_id,
      p_owner: job.owner_id,
      p_lease_token: job.lease_token,
    })

    if (error) throwFromPostgrest(error, 'finish material purge job')
    return data
  },

  async shelfAtLevel({ level, limit, viewerId }) {
    const { data, error, count } = await supabaseAdmin
      .from('materials')
      .select('id,title', { count: 'exact' })
      .is('deleted_at', null)
      .or(visibleTo(viewerId))
      .eq('level', level)
      // The same order as the shelf itself: what was worked on last, first.
      .order('updated_at', { ascending: false })
      .limit(limit)
      .returns<LessonRow[]>()

    if (error) throwFromPostgrest(error, 'list materials at level')

    return { rows: data ?? [], total: count ?? 0 }
  },

  async findById(id) {
    // Deleted rows come back too. Whether that is a 404 or the bin is the service's call.
    const { data, error } = await supabaseAdmin
      .from('materials')
      .select(SELECT)
      .eq('id', id)
      .maybeSingle()
      .returns<MaterialRow | null>()

    if (error) throwFromPostgrest(error, 'find material')

    return data
  },

  async insert(values) {
    const { data, error } = await supabaseAdmin
      .from('materials')
      .insert(values)
      .select(SELECT)
      .single()
      .returns<MaterialRow>()

    if (error) throwFromPostgrest(error, 'create material')

    return data
  },

  async update(id, patch) {
    const { data, error } = await supabaseAdmin
      .from('materials')
      .update(patch)
      .eq('id', id)
      .select(SELECT)
      .maybeSingle()
      .returns<MaterialRow | null>()

    if (error) throwFromPostgrest(error, 'update material')

    return data
  },

  async stepsFor(materialId) {
    const { data, error } = await supabaseAdmin
      .from('material_steps')
      .select('*')
      .eq('material_id', materialId)
      .order('position', { ascending: true })

    if (error) throwFromPostgrest(error, 'list steps')

    return data ?? []
  },

  async findStep(materialId, stepId) {
    // Both ids, so a step id borrowed from another material cannot be edited through a
    // material the caller does own.
    const { data, error } = await supabaseAdmin
      .from('material_steps')
      .select('*')
      .eq('id', stepId)
      .eq('material_id', materialId)
      .maybeSingle()

    if (error) throwFromPostgrest(error, 'find step')

    return data
  },

  async insertStep(values) {
    const { data, error } = await supabaseAdmin
      .from('material_steps')
      .insert(values)
      .select('*')
      .single()

    if (error) throwFromPostgrest(error, 'create step')

    return data
  },

  async insertSteps(values) {
    if (values.length === 0) return

    const { error } = await supabaseAdmin.from('material_steps').insert(values)

    if (error) throwFromPostgrest(error, 'copy steps')
  },

  async updateStep(stepId, patch, expectedUpdatedAt) {
    let builder = supabaseAdmin.from('material_steps').update(patch).eq('id', stepId)

    // Optimistic lock. The trigger moves updated_at on every write, so a stale token means
    // somebody else saved first and no rows match — which the service turns into a 409
    // rather than silently discarding their work.
    if (expectedUpdatedAt) builder = builder.eq('updated_at', expectedUpdatedAt)

    const { data, error } = await builder.select('*').maybeSingle()

    if (error) throwFromPostgrest(error, 'update step')

    return data
  },

  async deleteStep(materialId, stepId) {
    const { error } = await supabaseAdmin
      .from('material_steps')
      .delete()
      .eq('id', stepId)
      .eq('material_id', materialId)

    if (error) throwFromPostgrest(error, 'delete step')
  },

  async reorderSteps(materialId, orderedStepIds) {
    // One statement in the database rather than one round trip per step, and it never
    // sends a step's blocks back — so a reorder cannot overwrite what autosave just wrote.
    const { error } = await supabaseAdmin.rpc('reorder_material_steps', {
      material: materialId,
      ids: orderedStepIds,
    })

    if (error) throwFromPostgrest(error, 'reorder steps')
  },

  async replaceWithAiDraft({
    materialId,
    actorId,
    title,
    description,
    level,
    tags,
    durationMinutes,
    expectedMetadata,
    originalSteps,
    preservedSteps,
    generatedSteps,
  }) {
    const { data, error } = await supabaseAdmin.rpc('replace_material_with_ai_draft', {
      p_actor: actorId,
      p_description: description,
      p_duration_minutes: durationMinutes,
      p_expected_metadata: expectedMetadata,
      p_expected_steps: originalSteps.map((step) => ({
        id: step.id,
        updated_at: step.updatedAt,
      })),
      p_generated_steps: generatedSteps,
      p_level: level,
      p_material: materialId,
      p_preserved_steps: preservedSteps.map((step) => ({
        id: step.id,
        updated_at: step.updatedAt,
      })),
      p_tags: tags,
      p_title: title,
    })

    if (error?.code === '40001') {
      throw new ConflictError(
        'The lesson changed somewhere else while the AI draft was open',
        { reason: 'lesson_changed' },
        { cause: error },
      )
    }
    if (error?.code === 'TP001') {
      throw new AiDraftPreservedStepsChangedError({ cause: error })
    }
    if (error?.code === 'P0002') {
      throw new NotFoundError('No such material', undefined, {
        cause: error,
      })
    }
    if (error?.code === 'TP403') {
      throw new ForbiddenError('Only the author can change this material', undefined, {
        cause: error,
      })
    }
    if (error) throwFromPostgrest(error, 'replace material with AI draft')

    return data ?? []
  },
}

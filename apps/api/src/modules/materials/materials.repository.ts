import type { MaterialScope, MaterialStatus, Tables, TablesInsert, TablesUpdate } from '@tp/shared'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'
import { sanitiseSearch } from '../../lib/supabase/search'

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
  /**
   * Gone for good. The steps, the homework and the asset rows go with it by cascade; the
   * files in the bucket do not, and are the caller's to remove first.
   */
  hardDelete(id: string): Promise<void>
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
      const term = sanitiseSearch(query)
      // A second `or` rather than one combined expression: PostgREST ands repeated `or`
      // parameters together, which is exactly the "visible to me AND matching the search"
      // this needs. Folding them into one would give "visible OR matching".
      if (term) builder = builder.or(`title.ilike.%${term}%,description.ilike.%${term}%`)
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

  async hardDelete(id) {
    const { error } = await supabaseAdmin.from('materials').delete().eq('id', id)

    if (error) throwFromPostgrest(error, 'purge material')
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
}

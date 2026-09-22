import type { BoardOp, Json, Tables, TablesInsert } from '@tp/shared'
import { ConflictError } from '../../http/errors'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'

export type LivePersonRow = Pick<Tables<'profiles'>, 'id' | 'full_name' | 'email'>

export type LiveMaterialRow = Pick<Tables<'materials'>, 'id' | 'title' | 'level' | 'deleted_at'> & {
  /** PostgREST returns an aggregate as a one-element array, or empty for none. */
  material_steps: { count: number }[]
}

export type LiveSessionRow = Tables<'live_sessions'> & {
  /** Null only if the row went missing, which the foreign keys prevent. */
  material: LiveMaterialRow | null
  teacher: LivePersonRow | null
  calendar_lesson: Pick<Tables<'lessons'>, 'id' | 'scheduled_at'> | null
}

export type RecentLiveMaterialRow = {
  started_at: string
  material: LiveMaterialRow & Pick<Tables<'materials'>, 'owner_id' | 'visibility' | 'status'>
}

/** What the room looks like after a batch of changes, as the database reports it. */
export type LiveBoardRow = {
  version: number
  board: Json
  current_step_id: string | null
  status: Tables<'live_sessions'>['status']
}

export type LiveTransitionRow = {
  version: number
  current_step_id: string | null
  status: Tables<'live_sessions'>['status']
  ended_at: string | null
}

export type LiveBoardGuards = {
  expectedVersion?: number
  markedStepId?: string
  guardTimer?: boolean
  expectedTimerId?: string | null
}

export type LiveRepository = {
  insert(values: TablesInsert<'live_sessions'>): Promise<LiveSessionRow>
  /**
   * Applies a batch of changes to the board under a row lock and moves the version once.
   * The database does the work, so two browsers changing the board in the same instant
   * are applied one after the other, never over each other.
   */
  applyOps(sessionId: string, ops: BoardOp[], guards?: LiveBoardGuards): Promise<LiveBoardRow>
  findById(id: string): Promise<LiveSessionRow | null>
  /** Moves the class only while it is open, under the same lock that advances its version. */
  setStepActive(id: string, stepId: string): Promise<LiveTransitionRow | null>
  /** Closes the class and advances its version in one transaction; repeated calls are safe. */
  end(id: string): Promise<LiveTransitionRow | null>
  /** The host's open room, if they have one. A teacher runs one class at a time. */
  activeOf(teacherId: string): Promise<LiveSessionRow | null>
  recentMaterialsOf(teacherId: string, limit: number): Promise<RecentLiveMaterialRow[]>
  /** The open rooms this student may walk into: their teachers', and any administrator's. */
  joinableBy(studentId: string): Promise<LiveSessionRow[]>
  /** Whether this lesson is being taught live to this student right now. */
  isLiveFor(materialId: string, studentId: string): Promise<boolean>
  /** Whether any open room is currently using this lesson. */
  isMaterialActive(materialId: string): Promise<boolean>
}

const MATERIAL =
  'material:materials!live_sessions_material_id_fkey(id,title,level,deleted_at,material_steps(count))'
const TEACHER = 'teacher:profiles!live_sessions_teacher_id_fkey(id,full_name,email)'
const SELECT = `*,${MATERIAL},${TEACHER},calendar_lesson:lessons!live_sessions_lesson_id_fkey(id,scheduled_at)`

/** Whom a student may join: the teachers who teach them, and every administrator. */
async function hostsOf(studentId: string): Promise<string[]> {
  const [{ data: links, error: linksError }, { data: admins, error: adminsError }] =
    await Promise.all([
      supabaseAdmin
        .from('teacher_students')
        .select('teacher_id')
        .eq('student_id', studentId)
        .eq('status', 'active'),
      supabaseAdmin.from('profiles').select('id').eq('role', 'admin'),
    ])

  if (linksError) throwFromPostgrest(linksError, 'list teachers')
  if (adminsError) throwFromPostgrest(adminsError, 'list administrators')

  return [...(links ?? []).map((row) => row.teacher_id), ...(admins ?? []).map((row) => row.id)]
}

async function transition(
  sessionId: string,
  action: 'set_step' | 'end',
  stepId: string | null = null,
): Promise<LiveTransitionRow | null> {
  const { data, error } = await supabaseAdmin.rpc('transition_live_session', {
    p_session: sessionId,
    p_action: action,
    p_step: stepId,
  })

  if (error?.code === 'TP409') {
    throw new ConflictError('This live lesson has ended', undefined, { cause: error })
  }
  if (error) throwFromPostgrest(error, 'move live lesson')

  return data?.[0] ?? null
}

export const liveRepository: LiveRepository = {
  async insert(values) {
    const { data, error } = await supabaseAdmin
      .from('live_sessions')
      .insert(values)
      .select(SELECT)
      .single()
      .returns<LiveSessionRow>()

    if (error) throwFromPostgrest(error, 'start live lesson')

    return data
  },

  async applyOps(sessionId, ops, guards = {}) {
    const { data, error } = await supabaseAdmin.rpc('apply_live_ops_guarded', {
      p_session: sessionId,
      p_ops: ops as unknown as Json,
      p_expected_version: guards.expectedVersion ?? null,
      p_mark_step: guards.markedStepId ?? null,
      p_guard_timer: guards.guardTimer ?? false,
      p_expected_timer_id: guards.expectedTimerId ?? null,
    })

    if (error?.code === 'TP409')
      throw new ConflictError('The live board changed', undefined, { cause: error })
    if (error) throwFromPostgrest(error, 'change the board')

    const row = data?.[0]
    if (!row) throw new Error('The board came back empty')

    return row
  },

  async findById(id) {
    const { data, error } = await supabaseAdmin
      .from('live_sessions')
      .select(SELECT)
      .eq('id', id)
      .maybeSingle()
      .returns<LiveSessionRow | null>()

    if (error) throwFromPostgrest(error, 'find live lesson')

    return data
  },

  async setStepActive(id, stepId) {
    return transition(id, 'set_step', stepId)
  },

  async end(id) {
    return transition(id, 'end')
  },

  async activeOf(teacherId) {
    const { data, error } = await supabaseAdmin
      .from('live_sessions')
      .select(SELECT)
      .eq('teacher_id', teacherId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .returns<LiveSessionRow | null>()

    if (error) throwFromPostgrest(error, 'find live lesson')

    return data
  },

  async recentMaterialsOf(teacherId, limit) {
    // Read only card metadata, never the saved board or another host's history.
    const { data, error } = await supabaseAdmin
      .from('live_sessions')
      .select(
        'started_at,material:materials!live_sessions_material_id_fkey!inner(id,title,level,deleted_at,owner_id,visibility,status,material_steps(count))',
      )
      .eq('teacher_id', teacherId)
      .is('material.deleted_at', null)
      .or(`owner_id.eq.${teacherId},and(visibility.eq.platform,status.eq.published)`, {
        referencedTable: 'material',
      })
      .order('started_at', { ascending: false })
      .limit(limit)
      .returns<RecentLiveMaterialRow[]>()

    if (error) throwFromPostgrest(error, 'list recently taught materials')
    return data ?? []
  },

  async joinableBy(studentId) {
    const hosts = await hostsOf(studentId)
    if (hosts.length === 0) return []

    const { data, error } = await supabaseAdmin
      .from('live_sessions')
      .select(SELECT)
      .in('teacher_id', hosts)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .returns<LiveSessionRow[]>()

    if (error) throwFromPostgrest(error, 'list live lessons')

    return data ?? []
  },

  async isLiveFor(materialId, studentId) {
    const hosts = await hostsOf(studentId)
    if (hosts.length === 0) return false

    const { count, error } = await supabaseAdmin
      .from('live_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('material_id', materialId)
      .eq('status', 'active')
      .in('teacher_id', hosts)

    if (error) throwFromPostgrest(error, 'check live lesson')

    return (count ?? 0) > 0
  },

  async isMaterialActive(materialId) {
    const { count, error } = await supabaseAdmin
      .from('live_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('material_id', materialId)
      .eq('status', 'active')

    if (error) throwFromPostgrest(error, 'check active live lesson')
    return (count ?? 0) > 0
  },
}

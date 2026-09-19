import type { AssignmentStatus, Tables, TablesInsert, TablesUpdate } from '@tp/shared'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'
import { searchPattern } from '../../lib/supabase/search'

export type PersonRow = Pick<Tables<'profiles'>, 'id' | 'full_name' | 'email'>

export type AssignmentMaterialRow = Pick<
  Tables<'materials'>,
  'id' | 'title' | 'level' | 'duration_minutes' | 'deleted_at'
> & {
  /** PostgREST returns an aggregate as a one-element array, or empty for none. */
  material_steps: { count: number }[]
}

export type AssignmentRow = Tables<'assignments'> & {
  snapshot: { material: Tables<'materials'>; step_count: number } | null
  /** The original library row may be purged; the snapshot remains the assignment's content. */
  material: AssignmentMaterialRow | null
  student: PersonRow | null
  teacher: PersonRow | null
}

export type AssignmentFilters = {
  status?: AssignmentStatus
  materialId?: string
  /**
   * Whose homework: the teacher who set it, the student who has it, or — for the
   * administrator, who sees everyone's — neither.
   */
  teacherId?: string
  studentId?: string
  /** Matched against the student's name and address. */
  query?: string
  /** Only what is open and past its due date. */
  overdue?: boolean
}

export type ListAssignmentsParams = AssignmentFilters & {
  page: number
  perPage: number
}

export type AssignmentsRepository = {
  list(params: ListAssignmentsParams): Promise<{ rows: AssignmentRow[]; total: number }>
  /** How many match, without fetching any. */
  count(filters: AssignmentFilters): Promise<number>
  /** The soonest due date still ahead, among the open work that matches. */
  nextDue(filters: AssignmentFilters): Promise<string | null>
  findById(id: string): Promise<AssignmentRow | null>
  insertMany(values: TablesInsert<'assignments'>[]): Promise<AssignmentRow[]>
  update(id: string, patch: TablesUpdate<'assignments'>): Promise<AssignmentRow | null>
  updateOpen(
    id: string,
    updatedAt: string,
    patch: TablesUpdate<'assignments'>,
  ): Promise<AssignmentRow | null>
  updateSubmitted(
    id: string,
    updatedAt: string,
    patch: TablesUpdate<'assignments'>,
  ): Promise<AssignmentRow | null>
  remove(id: string): Promise<void>
  /** Students among the given who already hold this lesson and have not had it marked. */
  openFor(materialId: string, studentIds: string[]): Promise<string[]>
  /** Whether a student holds this lesson at all — what lets them play it. */
  isAssigned(materialId: string, studentId: string): Promise<boolean>
  /** The students a teacher currently teaches. */
  activeStudentsOf(teacherId: string): Promise<PersonRow[]>
  /** Everyone with a student account — the administrator's reach. */
  allStudents(): Promise<PersonRow[]>
}

const MATERIAL =
  'material:materials!assignments_material_id_fkey(id,title,level,duration_minutes,deleted_at,material_steps(count))'
// An inner join, so that a filter on the student's name narrows the assignments rather
// than blanking the student out of them. Every assignment has a student, so nothing is
// lost by asking for it this way when there is no filter.
const STUDENT = 'student:profiles!assignments_student_id_fkey!inner(id,full_name,email)'
const TEACHER = 'teacher:profiles!assignments_teacher_id_fkey(id,full_name,email)'
const SELECT = `*,${MATERIAL},${STUDENT},${TEACHER},snapshot:assignment_snapshots(material,step_count)`

/**
 * The one reading of the filters, shared by the list and its counts so that the number
 * on a tab and the rows under it can never disagree about what "overdue" means.
 */
function matching(
  { status, materialId, teacherId, studentId, query, overdue }: AssignmentFilters,
  /** Count only: the same query as a HEAD request, which carries the total and no rows. */
  head = false,
) {
  let builder = supabaseAdmin.from('assignments').select(SELECT, { count: 'exact', head })

  if (teacherId) builder = builder.eq('teacher_id', teacherId)
  if (studentId) builder = builder.eq('student_id', studentId)
  if (status) builder = builder.eq('status', status)
  if (materialId) builder = builder.eq('material_id', materialId)

  if (overdue) {
    builder = builder.eq('status', 'assigned').lt('due_at', new Date().toISOString())
  }

  if (query) {
    const pattern = searchPattern(query)
    builder = builder.or(`full_name.ilike.${pattern},email.ilike.${pattern}`, {
      referencedTable: 'student',
    })
  }

  return builder
}

export const assignmentsRepository: AssignmentsRepository = {
  async list({ page, perPage, ...filters }) {
    const from = (page - 1) * perPage

    const { data, error, count } = await matching(filters)
      .order('created_at', { ascending: false })
      .range(from, from + perPage - 1)
      .returns<AssignmentRow[]>()

    if (error) throwFromPostgrest(error, 'list assignments')

    return { rows: data ?? [], total: count ?? 0 }
  },

  async count(filters) {
    const { error, count } = await matching(filters, true)

    if (error) throwFromPostgrest(error, 'count assignments')

    return count ?? 0
  },

  async nextDue(filters) {
    const { data, error } = await matching({ ...filters, status: 'assigned' })
      .gte('due_at', new Date().toISOString())
      .order('due_at', { ascending: true })
      .limit(1)
      .returns<AssignmentRow[]>()

    if (error) throwFromPostgrest(error, 'find next due date')

    return data?.[0]?.due_at ?? null
  },

  async findById(id) {
    const { data, error } = await supabaseAdmin
      .from('assignments')
      .select(SELECT)
      .eq('id', id)
      .maybeSingle()
      .returns<AssignmentRow | null>()

    if (error) throwFromPostgrest(error, 'find assignment')

    return data
  },

  async insertMany(values) {
    if (values.length === 0) return []

    const { data, error } = await supabaseAdmin
      .from('assignments')
      .insert(values)
      .select(SELECT)
      .returns<AssignmentRow[]>()

    if (error) throwFromPostgrest(error, 'create assignments')

    return data ?? []
  },

  async update(id, patch) {
    const { data, error } = await supabaseAdmin
      .from('assignments')
      .update(patch)
      .eq('id', id)
      .select(SELECT)
      .maybeSingle()
      .returns<AssignmentRow | null>()

    if (error) throwFromPostgrest(error, 'update assignment')

    return data
  },

  async updateOpen(id, updatedAt, patch) {
    const { data, error } = await supabaseAdmin
      .from('assignments')
      .update(patch)
      .eq('id', id)
      .eq('status', 'assigned')
      .eq('updated_at', updatedAt)
      .select(SELECT)
      .maybeSingle()
      .returns<AssignmentRow | null>()

    if (error) throwFromPostgrest(error, 'save open assignment')

    return data
  },

  async updateSubmitted(id, updatedAt, patch) {
    const { data, error } = await supabaseAdmin
      .from('assignments')
      .update(patch)
      .eq('id', id)
      .eq('status', 'submitted')
      .eq('updated_at', updatedAt)
      .select(SELECT)
      .maybeSingle()
      .returns<AssignmentRow | null>()

    if (error) throwFromPostgrest(error, 'update submitted assignment')

    return data
  },

  async remove(id) {
    const { error } = await supabaseAdmin.from('assignments').delete().eq('id', id)

    if (error) throwFromPostgrest(error, 'delete assignment')
  },

  async openFor(materialId, studentIds) {
    if (studentIds.length === 0) return []

    const { data, error } = await supabaseAdmin
      .from('assignments')
      .select('student_id')
      .eq('material_id', materialId)
      .in('student_id', studentIds)
      .neq('status', 'graded')

    if (error) throwFromPostgrest(error, 'find open assignments')

    return (data ?? []).map((row) => row.student_id)
  },

  async isAssigned(materialId, studentId) {
    const { count, error } = await supabaseAdmin
      .from('assignments')
      .select('id', { count: 'exact', head: true })
      .eq('material_id', materialId)
      .eq('student_id', studentId)

    if (error) throwFromPostgrest(error, 'check assignment')

    return (count ?? 0) > 0
  },

  async activeStudentsOf(teacherId) {
    const { data, error } = await supabaseAdmin
      .from('teacher_students')
      .select('student:profiles!teacher_students_student_id_fkey(id,full_name,email)')
      .eq('teacher_id', teacherId)
      .eq('status', 'active')
      .returns<{ student: PersonRow | null }[]>()

    if (error) throwFromPostgrest(error, 'list students')

    return (data ?? [])
      .map((row) => row.student)
      .filter((student): student is PersonRow => student !== null)
      .sort((a, b) => (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email))
  },

  async allStudents() {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id,full_name,email')
      .eq('role', 'student')
      .order('full_name', { ascending: true, nullsFirst: false })
      .limit(500)

    if (error) throwFromPostgrest(error, 'list students')

    return data ?? []
  },
}

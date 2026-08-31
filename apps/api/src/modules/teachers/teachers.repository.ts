import type { SubscriptionStatus, Tables } from '@tp/shared'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'
import { sanitiseSearch } from '../../lib/supabase/search'
import type { SubscriptionRow } from '../subscriptions/subscriptions.repository'

export type TeacherRow = Pick<
  Tables<'profiles'>,
  'id' | 'email' | 'full_name' | 'created_at' | 'role'
> & {
  subscriptions: SubscriptionRow | null
  /** PostgREST returns an aggregate as a one-element array, or empty for no matches. */
  teacher_students: { count: number }[]
}

export type ListTeachersParams = {
  page: number
  perPage: number
  status?: SubscriptionStatus
  query?: string
}

export type TeachersRepository = {
  list(params: ListTeachersParams): Promise<{ rows: TeacherRow[]; total: number }>
  findById(id: string): Promise<TeacherRow | null>
}

const COLUMNS = 'id,email,full_name,created_at,role'

// Counted in the database rather than by fetching every link and counting here. Left
// embedded, so a teacher with no students still appears, with a count of zero.
const STUDENT_COUNT = 'teacher_students!teacher_students_teacher_id_fkey(count)'

export const teachersRepository: TeachersRepository = {
  async list({ page, perPage, status, query }) {
    const from = (page - 1) * perPage

    // A left embed keeps teachers who have no subscription row visible — exactly the
    // people an admin needs to find. Filtering by status needs an inner join instead,
    // because a filter on an embedded column otherwise just empties the embed and leaves
    // every teacher in the list.
    const select = status
      ? `${COLUMNS},subscriptions!inner(*),${STUDENT_COUNT}`
      : `${COLUMNS},subscriptions(*),${STUDENT_COUNT}`

    let builder = supabaseAdmin
      .from('profiles')
      .select(select, { count: 'exact' })
      .eq('role', 'teacher')
      .eq('teacher_students.status', 'active')

    if (status) builder = builder.eq('subscriptions.status', status)

    if (query) {
      const term = sanitiseSearch(query)
      if (term) builder = builder.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`)
    }

    const { data, error, count } = await builder
      .order('created_at', { ascending: false })
      .range(from, from + perPage - 1)
      .returns<TeacherRow[]>()

    if (error) throwFromPostgrest(error, 'list teachers')

    return { rows: data ?? [], total: count ?? 0 }
  },

  async findById(id) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(`${COLUMNS},subscriptions(*),${STUDENT_COUNT}`)
      .eq('teacher_students.status', 'active')
      .eq('id', id)
      .eq('role', 'teacher')
      .maybeSingle()
      .returns<TeacherRow | null>()

    if (error) throwFromPostgrest(error, 'find teacher')

    return data
  },
}

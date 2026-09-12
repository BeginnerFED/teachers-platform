import {
  EXPIRING_ACCESS_DAYS,
  type SubscriptionStatus,
  type Tables,
  type TeacherAccessFilter,
} from '@tp/shared'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'
import { searchPattern } from '../../lib/supabase/search'
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
  access?: TeacherAccessFilter
  now?: Date
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
  async list({ page, perPage, status, access, query, now = new Date() }) {
    const from = (page - 1) * perPage

    // A left embed keeps teachers who have no subscription row visible — exactly the
    // people an admin needs to find. Filtering by status needs an inner join instead,
    // because a filter on an embedded column otherwise just empties the embed and leaves
    // every teacher in the list.
    const select =
      status || access
        ? `${COLUMNS},subscriptions!inner(*),${STUDENT_COUNT}`
        : `${COLUMNS},subscriptions(*),${STUDENT_COUNT}`

    let builder = supabaseAdmin
      .from('profiles')
      .select(select, { count: 'exact' })
      .eq('role', 'teacher')
      .eq('teacher_students.status', 'active')

    if (status) builder = builder.eq('subscriptions.status', status)

    if (access) {
      // Mirrors hasAccess(): a paid period takes precedence over the trial, and
      // suspended/canceled accounts stay separate from naturally expired access.
      const at = now.toISOString()
      const soon = new Date(now.getTime() + EXPIRING_ACCESS_DAYS * 86_400_000).toISOString()
      builder = builder.not('subscriptions.status', 'in', '(suspended,canceled)')
      const filter =
        access === 'available'
          ? `current_period_end.gt.${at},and(current_period_end.is.null,trial_ends_at.gt.${at})`
          : access === 'expired'
            ? `current_period_end.lte.${at},and(current_period_end.is.null,trial_ends_at.lte.${at})`
            : `and(current_period_end.gt.${at},current_period_end.lte.${soon}),and(current_period_end.is.null,trial_ends_at.gt.${at},trial_ends_at.lte.${soon})`
      builder = builder.or(filter, { referencedTable: 'subscriptions' })
    }

    if (query) {
      const pattern = searchPattern(query)
      builder = builder.or(`email.ilike.${pattern},full_name.ilike.${pattern}`)
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

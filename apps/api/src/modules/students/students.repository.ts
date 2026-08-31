import type { StudentLink, Tables } from '@tp/shared'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'
import { sanitiseSearch } from '../../lib/supabase/search'

export type StudentLinkRow = Pick<
  Tables<'teacher_students'>,
  'status' | 'created_at' | 'ended_at'
> & {
  /** Null only if the teacher's profile went missing, which the foreign key prevents. */
  teacher: Pick<Tables<'profiles'>, 'id' | 'full_name' | 'email'> | null
}

export type StudentRow = Pick<
  Tables<'profiles'>,
  'id' | 'email' | 'full_name' | 'created_at'
> & {
  teacher_students: StudentLinkRow[]
  /** PostgREST returns an aggregate as a one-element array, or empty for no matches. */
  lesson_attendees: { count: number }[]
}

export type ListStudentsParams = {
  page: number
  perPage: number
  link?: StudentLink
  query?: string
}

export type StudentsRepository = {
  list(params: ListStudentsParams): Promise<{ rows: StudentRow[]; total: number }>
  findById(id: string): Promise<StudentRow | null>
}

const COLUMNS = 'id,email,full_name,created_at'

// Two hops in one read: the join row, and through it the teacher's profile. Both foreign
// keys are named explicitly because teacher_students points at profiles twice, and left
// to guess PostgREST cannot know which end of the pair is wanted.
const TEACHER = 'teacher:profiles!teacher_students_teacher_id_fkey(id,full_name,email)'
const LINK_COLUMNS = `status,created_at,ended_at,${TEACHER}`
const LINKS = `teacher_students!teacher_students_student_id_fkey(${LINK_COLUMNS})`
const LINKS_INNER = `teacher_students!teacher_students_student_id_fkey!inner(${LINK_COLUMNS})`

// Counted in the database rather than by fetching every attendance row and counting here.
// Left embedded, so a student who has never sat in a lesson still appears, with a zero.
const ATTENDED = 'lesson_attendees!lesson_attendees_student_id_fkey(count)'

export const studentsRepository: StudentsRepository = {
  async list({ page, perPage, link, query }) {
    const from = (page - 1) * perPage

    // An inner join keeps only the students somebody currently teaches. It does not
    // duplicate a student who has two teachers: the embed comes back as one array on one
    // row, and the exact count agrees with the number of rows.
    const select = `${COLUMNS},${link === 'linked' ? LINKS_INNER : LINKS},${ATTENDED}`

    let builder = supabaseAdmin
      .from('profiles')
      .select(select, { count: 'exact' })
      .eq('role', 'student')
      // The list only says who teaches this student now. A relationship that has ended is
      // history, and history belongs in the detail panel rather than in a column.
      .eq('teacher_students.status', 'active')
      // Sessions they were in, rather than sessions they were expected at.
      .eq('lesson_attendees.status', 'present')

    // Asked after the embed has been narrowed, not before. Filtering on the raw table
    // being empty would count a student whose only relationship has ended as claimed,
    // which is exactly the person an admin is looking for here.
    if (link === 'unlinked') builder = builder.is('teacher_students', null)

    if (query) {
      const term = sanitiseSearch(query)
      if (term) builder = builder.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`)
    }

    const { data, error, count } = await builder
      .order('created_at', { ascending: false })
      .range(from, from + perPage - 1)
      .returns<StudentRow[]>()

    if (error) throwFromPostgrest(error, 'list students')

    return { rows: data ?? [], total: count ?? 0 }
  },

  async findById(id) {
    // No status filter here: the panel shows past teachers as well as current ones, and
    // the split happens in the mapper.
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(`${COLUMNS},${LINKS},${ATTENDED}`)
      .eq('id', id)
      .eq('role', 'student')
      .eq('lesson_attendees.status', 'present')
      .maybeSingle()
      .returns<StudentRow | null>()

    if (error) throwFromPostgrest(error, 'find student')

    return data
  },
}

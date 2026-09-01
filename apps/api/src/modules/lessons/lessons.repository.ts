import type { AttendanceStatus, LessonStatus, Tables } from '@tp/shared'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'

export type StudentLessonRow = Pick<
  Tables<'lessons'>,
  'id' | 'scheduled_at' | 'duration_minutes' | 'status' | 'topic'
> & {
  teacher: Pick<Tables<'profiles'>, 'id' | 'full_name' | 'email'> | null
  /** This student's own row, inner-joined, so there is always exactly one. */
  mine: { status: AttendanceStatus }[]
  /** Everybody in the room. Aliased separately because the filter above narrows `mine`. */
  everyone: { count: number }[]
}

/** Just enough of every lesson to count them correctly, however many there are. */
export type LessonTallyRow = {
  status: AttendanceStatus
  lesson: { status: LessonStatus } | null
}

export type CalendarLessonRow = Pick<
  Tables<'lessons'>,
  'id' | 'scheduled_at' | 'duration_minutes' | 'status' | 'topic' | 'notes'
> & {
  teacher: Pick<Tables<'profiles'>, 'id' | 'full_name' | 'email'> | null
  lesson_attendees: {
    status: AttendanceStatus
    student: Pick<Tables<'profiles'>, 'id' | 'full_name' | 'email'> | null
  }[]
}

export type ListLessonsRange = {
  from: string
  to: string
  teacherId?: string
  limit: number
}

export type LessonsRepository = {
  listForStudent(studentId: string, limit: number): Promise<StudentLessonRow[]>
  tallyForStudent(studentId: string): Promise<LessonTallyRow[]>
  listForRange(range: ListLessonsRange): Promise<CalendarLessonRow[]>
}

const TEACHER = 'teacher:profiles!lessons_teacher_id_fkey(id,full_name,email)'
const STUDENTS =
  'lesson_attendees(status,student:profiles!lesson_attendees_student_id_fkey(id,full_name,email))'

export const lessonsRepository: LessonsRepository = {
  async listForStudent(studentId, limit) {
    // Read from the lesson rather than from the attendance row, because the order that
    // matters is the lesson's date and PostgREST cannot sort a parent by a column it
    // reached through an embed.
    //
    // The attendance table is embedded twice on purpose. `mine` is inner-joined and
    // filtered, which is both the membership test and this student's own status;
    // `everyone` is the untouched relation, so its count is the size of the class rather
    // than the size of the filter. Verified against a two-student lesson.
    const { data, error } = await supabaseAdmin
      .from('lessons')
      .select(
        `id,scheduled_at,duration_minutes,status,topic,${TEACHER},mine:lesson_attendees!inner(status),everyone:lesson_attendees(count)`,
      )
      .eq('mine.student_id', studentId)
      .order('scheduled_at', { ascending: false })
      .limit(limit)
      .returns<StudentLessonRow[]>()

    if (error) throwFromPostgrest(error, 'list lessons for student')

    return data ?? []
  },

  async tallyForStudent(studentId) {
    // Every lesson, but only the two fields the counting needs. A summary that describes
    // a page of the history rather than the history is worse than no summary.
    const { data, error } = await supabaseAdmin
      .from('lesson_attendees')
      .select('status,lesson:lessons!inner(status)')
      .eq('student_id', studentId)
      .returns<LessonTallyRow[]>()

    if (error) throwFromPostgrest(error, 'tally lessons for student')

    return data ?? []
  },

  async listForRange({ from, to, teacherId, limit }) {
    // Half-open, so a lesson sitting exactly on a week boundary belongs to one week and
    // not to both.
    let builder = supabaseAdmin
      .from('lessons')
      .select(`id,scheduled_at,duration_minutes,status,topic,notes,${TEACHER},${STUDENTS}`)
      .gte('scheduled_at', from)
      .lt('scheduled_at', to)

    if (teacherId) builder = builder.eq('teacher_id', teacherId)

    const { data, error } = await builder
      .order('scheduled_at', { ascending: true })
      .limit(limit)
      .returns<CalendarLessonRow[]>()

    if (error) throwFromPostgrest(error, 'list lessons in range')

    return data ?? []
  },
}

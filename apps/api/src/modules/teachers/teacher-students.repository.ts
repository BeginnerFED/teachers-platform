import { endedLink, type EndedLink, type Enums } from '@tp/shared'
import { InternalError, RuleViolationError } from '../../http/errors'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'

export type LinkedStudentRow = {
  created_at: string
  student: { id: string; full_name: string | null; email: string } | null
}

export type LinkRow = {
  id: string
  status: Enums<'teacher_student_status'>
}

export type CurrentTeacherRow = { id: string; full_name: string | null; email: string }

/**
 * The partial unique index that holds a student to one active teacher. A write it refuses
 * is the rule doing its job rather than a failure, so it is told apart by name.
 */
const ONE_ACTIVE_TEACHER = 'teacher_students_one_active_teacher'

export type TeacherStudentsRepository = {
  listActiveForTeacher(
    teacherId: string,
    limit: number,
  ): Promise<{ rows: LinkedStudentRow[]; total: number }>
  findLink(teacherId: string, studentId: string): Promise<LinkRow | null>
  /** Who the student studies with now, if anybody. */
  findCurrentTeacher(studentId: string): Promise<CurrentTeacherRow | null>
  /**
   * Opens the link — a fresh row, or the old one reopened, which keeps its start date.
   * 'taken' when the student turned out to be with another teacher by the time it was written.
   */
  link(teacherId: string, studentId: string): Promise<'linked' | 'taken'>
  /**
   * Closes it, and what was planned under it: upcoming lessons the student had alone are
   * cancelled, group ones go ahead without them, open homework is withdrawn. The row stays;
   * the history it records is the point of keeping it.
   */
  end(teacherId: string, studentId: string): Promise<EndedLink>
}

export const teacherStudentsRepository: TeacherStudentsRepository = {
  async listActiveForTeacher(teacherId, limit) {
    // Only current students. Ended relationships stay on record but are not who this
    // teacher works with today, which is the question the panel is answering.
    const { data, error, count } = await supabaseAdmin
      .from('teacher_students')
      .select('created_at,student:profiles!teacher_students_student_id_fkey(id,full_name,email)', {
        count: 'exact',
      })
      .eq('teacher_id', teacherId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit)
      .returns<LinkedStudentRow[]>()

    if (error) throwFromPostgrest(error, 'list a teacher’s students')

    return { rows: data ?? [], total: count ?? 0 }
  },

  async findLink(teacherId, studentId) {
    const { data, error } = await supabaseAdmin
      .from('teacher_students')
      .select('id,status')
      .eq('teacher_id', teacherId)
      .eq('student_id', studentId)
      .maybeSingle()

    if (error) throwFromPostgrest(error, 'find link')

    return data
  },

  async findCurrentTeacher(studentId) {
    const { data, error } = await supabaseAdmin
      .from('teacher_students')
      .select('teacher:profiles!teacher_students_teacher_id_fkey(id,full_name,email)')
      .eq('student_id', studentId)
      .eq('status', 'active')
      // One at most, by the index. Capped all the same, because a second row would turn
      // this read into an error rather than an answer.
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .returns<{ teacher: CurrentTeacherRow | null } | null>()

    if (error) throwFromPostgrest(error, 'find current teacher')

    return data?.teacher ?? null
  },

  async link(teacherId, studentId) {
    // One row per pair, ever: re-adding a student the teacher had before reopens the
    // same row rather than starting a second history. The unique key makes the upsert
    // land on it, and `ended_at` has to be cleared or the check constraint refuses.
    const { error } = await supabaseAdmin.from('teacher_students').upsert(
      {
        teacher_id: teacherId,
        student_id: studentId,
        status: 'active',
        ended_at: null,
      },
      { onConflict: 'teacher_id,student_id' },
    )

    // The pair's own key is the upsert's to settle, so the one that can still refuse is
    // the student's: somebody placed them with another teacher a moment ago.
    if (error?.code === '23505' && error.message.includes(ONE_ACTIVE_TEACHER)) return 'taken'
    if (error) throwFromPostgrest(error, 'link student')

    return 'linked'
  },

  async end(teacherId, studentId) {
    // One database transaction, so the link never ends with half its lessons still booked.
    const { data, error } = await supabaseAdmin.rpc('end_teacher_student_link', {
      p_teacher: teacherId,
      p_student: studentId,
    })

    // A room the student belongs to is open. Only linked students may join a teacher's
    // room, so ending the link now would shut them out mid-lesson; nothing changes until
    // the teacher ends it.
    if (error?.code === '55000') {
      throw new RuleViolationError('A live lesson with this student is running', {
        reason: 'live_lesson_running',
      })
    }
    if (error) throwFromPostgrest(error, 'end link')

    // The link has ended by the time this is read, so an answer that does not fit is this
    // code and the database function disagreeing — ours to fix, not a request to correct.
    const ended = endedLink.safeParse(data)
    if (!ended.success) {
      throw new InternalError('Ending a link returned an unknown result', { cause: ended.error })
    }

    return ended.data
  },
}

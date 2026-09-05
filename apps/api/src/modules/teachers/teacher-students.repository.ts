import type { Enums } from '@tp/shared'
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

export type TeacherStudentsRepository = {
  listActiveForTeacher(
    teacherId: string,
    limit: number,
  ): Promise<{ rows: LinkedStudentRow[]; total: number }>
  findLink(teacherId: string, studentId: string): Promise<LinkRow | null>
  /** Opens the link — a fresh row, or the old one reopened, which keeps its start date. */
  link(teacherId: string, studentId: string): Promise<void>
  /** Closes it. The row stays; the history it records is the point of keeping it. */
  unlink(teacherId: string, studentId: string): Promise<void>
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

    if (error) throwFromPostgrest(error, 'link student')
  },

  async unlink(teacherId, studentId) {
    const { error } = await supabaseAdmin
      .from('teacher_students')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('teacher_id', teacherId)
      .eq('student_id', studentId)
      .eq('status', 'active')

    if (error) throwFromPostgrest(error, 'unlink student')
  },
}

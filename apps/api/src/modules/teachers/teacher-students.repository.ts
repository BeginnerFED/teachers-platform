import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'

export type LinkedStudentRow = {
  created_at: string
  student: { id: string; full_name: string | null; email: string } | null
}

export type TeacherStudentsRepository = {
  listActiveForTeacher(
    teacherId: string,
    limit: number,
  ): Promise<{ rows: LinkedStudentRow[]; total: number }>
}

export const teacherStudentsRepository: TeacherStudentsRepository = {
  async listActiveForTeacher(teacherId, limit) {
    // Only current students. Ended relationships stay on record but are not who this
    // teacher works with today, which is the question the panel is answering.
    const { data, error, count } = await supabaseAdmin
      .from('teacher_students')
      .select(
        'created_at,student:profiles!teacher_students_student_id_fkey(id,full_name,email)',
        { count: 'exact' },
      )
      .eq('teacher_id', teacherId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit)
      .returns<LinkedStudentRow[]>()

    if (error) throwFromPostgrest(error, 'list a teacher’s students')

    return { rows: data ?? [], total: count ?? 0 }
  },
}

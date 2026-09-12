import {
  lessonCreditSummary,
  pendingLessonIds,
  teacherStudentBalances,
  type ReverseLessonCreditsBody,
  type GrantLessonCreditsBody,
  type RecordAttendanceBody,
} from '@tp/shared'
import type { PostgrestError } from '@supabase/supabase-js'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RuleViolationError,
  ValidationError,
} from '../../http/errors'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'

function check(error: PostgrestError | null) {
  if (!error) return
  if (error.code === '40001' || error.code === 'P0001')
    throw new ConflictError('Lesson changed', { reason: 'lesson_changed' })
  if (error.code === '23505' || error.code === '23P01')
    throw new ConflictError('Conflicting lesson or request')
  if (error.code === '42501') throw new ForbiddenError('Choose your own students')
  if (error.code === 'P0002') throw new NotFoundError('Lesson or student not found')
  if (error.code === '55000') throw new RuleViolationError('The lesson has not ended yet')
  if (error.code === '22023') throw new ValidationError('Invalid attendance or credits')
  throwFromPostgrest(error, 'lesson attendance')
}

export const attendanceRepository = {
  async reverse(
    teacherId: string,
    studentId: string,
    grantId: string,
    body: ReverseLessonCreditsBody,
  ) {
    const { data, error } = await supabaseAdmin.rpc('reverse_lesson_credits', {
      p_teacher: teacherId,
      p_student: studentId,
      p_grant: grantId,
      p_reason: body.reason,
    })
    check(error)
    return { id: data! }
  },
  async balances(teacherId: string) {
    const { data, error } = await supabaseAdmin.rpc('teacher_student_balances', {
      p_teacher: teacherId,
    })
    check(error)
    return teacherStudentBalances.parse(data)
  },
  async record(teacherId: string, lessonId: string, body: RecordAttendanceBody) {
    const { data, error } = await supabaseAdmin.rpc('record_lesson_attendance', {
      p_teacher: teacherId,
      p_lesson: lessonId,
      p_expected_updated_at: body.expectedUpdatedAt,
      p_status: body.status,
      p_students: body.students,
    })
    check(error)
    return { id: data! }
  },
  async summary(teacherId: string, studentId: string) {
    const { data, error } = await supabaseAdmin.rpc('student_lesson_credits', {
      p_teacher: teacherId,
      p_student: studentId,
    })
    check(error)
    return lessonCreditSummary.parse(data)
  },
  async grant(teacherId: string, studentId: string, body: GrantLessonCreditsBody) {
    const { data, error } = await supabaseAdmin.rpc('grant_lesson_credits', {
      p_id: body.id,
      p_teacher: teacherId,
      p_student: studentId,
      p_units: body.units,
      p_note: body.note,
    })
    check(error)
    return { id: data! }
  },
  async pending(teacherId: string) {
    const { data, error } = await supabaseAdmin.rpc('pending_teacher_lessons', {
      p_teacher: teacherId,
    })
    check(error)
    return pendingLessonIds.parse(data)
  },
}

import type {
  AttendanceStatus,
  LessonStatus,
  ScheduleLessonBody,
  UpdateLessonBody,
  Tables,
} from '@tp/shared'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RuleViolationError,
  ValidationError,
} from '../../http/errors'
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
  'id' | 'updated_at' | 'scheduled_at' | 'duration_minutes' | 'status' | 'topic' | 'notes'
> & {
  series: { id: string; updated_at: string } | null
  live_sessions: { id: string; status: 'active' | 'ended'; started_at: string }[]
  teacher: Pick<Tables<'profiles'>, 'id' | 'full_name' | 'email'> | null
  lesson_attendees: {
    status: AttendanceStatus
    deduct_credit: boolean
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
  schedule(teacherId: string, body: ScheduleLessonBody): Promise<string>
  update(teacherId: string, lessonId: string, body: UpdateLessonBody): Promise<string>
  listForStudent(studentId: string, limit: number): Promise<StudentLessonRow[]>
  tallyForStudent(studentId: string): Promise<LessonTallyRow[]>
  listForRange(range: ListLessonsRange): Promise<CalendarLessonRow[]>
  listByIds(teacherId: string, ids: string[]): Promise<CalendarLessonRow[]>
}

const TEACHER = 'teacher:profiles!lessons_teacher_id_fkey(id,full_name,email)'
const STUDENTS =
  'lesson_attendees(status,deduct_credit,student:profiles!lesson_attendees_student_id_fkey(id,full_name,email))'
const LIVE =
  'live_sessions!live_sessions_lesson_id_fkey(id,status,started_at),series:lesson_series(id,updated_at)'

export const lessonsRepository: LessonsRepository = {
  async listByIds(teacherId, ids) {
    const { data, error } = await supabaseAdmin
      .from('lessons')
      .select(
        `id,updated_at,scheduled_at,duration_minutes,status,topic,notes,${TEACHER},${STUDENTS},${LIVE}`,
      )
      .eq('teacher_id', teacherId)
      .in('id', ids)
      .order('scheduled_at')
      .returns<CalendarLessonRow[]>()
    if (error) throwFromPostgrest(error, 'list pending lessons')
    return data ?? []
  },
  async update(teacherId, lessonId, body) {
    const args = {
      p_id: lessonId,
      p_teacher: teacherId,
      p_expected_updated_at: body.expectedUpdatedAt,
      p_scheduled_at: body.scheduledAt,
      p_duration_minutes: body.durationMinutes,
      p_students: body.studentIds,
      p_topic: body.topic,
      p_notes: body.notes,
    }
    const { data, error } = body.seriesEdit
      ? await supabaseAdmin.rpc('update_lesson_series', {
          ...args,
          p_scope: body.seriesEdit.scope,
          p_series_version: body.seriesEdit.expectedUpdatedAt,
          p_command: body.seriesEdit.requestId,
        })
      : await supabaseAdmin.rpc('update_scheduled_lesson', args)
    if (error?.code === '40001' || error?.code === 'P0001')
      throw new ConflictError('Lesson changed since it was opened', { reason: 'lesson_changed' })
    if (error?.code === '23P01' || error?.code === '23505')
      throw new ConflictError('The teacher or student has a conflicting lesson')
    if (error?.code === '42501') throw new ForbiddenError('Choose your own active students')
    if (error?.code === 'P0002') throw new NotFoundError('Lesson not found')
    if (error?.code === '55000')
      throw new RuleViolationError('Only scheduled lessons can be edited')
    if (error?.code === '22023') throw new ValidationError('Invalid lesson details')
    if (error) throwFromPostgrest(error, 'update lesson')
    return data
  },

  async schedule(teacherId, body) {
    const args = {
      p_id: body.id,
      p_teacher: teacherId,
      p_scheduled_at: body.scheduledAt,
      p_duration_minutes: body.durationMinutes,
      p_students: body.studentIds,
      p_topic: body.topic,
      p_notes: body.notes,
    }
    const { data, error } = body.recurrence
      ? await supabaseAdmin.rpc('schedule_lesson_series', {
          ...args,
          p_weeks: body.recurrence.weeks,
          p_weekdays: [...new Set(body.recurrence.weekdays)].sort(),
        })
      : await supabaseAdmin.rpc('schedule_lesson', args)
    if (
      error?.code === '23P01' ||
      error?.code === '40001' ||
      error?.code === '23505' ||
      error?.code === 'P0001'
    )
      throw new ConflictError('The teacher or student has a conflicting lesson')
    if (error?.code === '42501') throw new ForbiddenError('Choose your own active students')
    if (error?.code === '22023') throw new ValidationError('Invalid lesson details')
    if (error) throwFromPostgrest(error, 'schedule lesson')
    return data
  },

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
      .select(
        `id,updated_at,scheduled_at,duration_minutes,status,topic,notes,${TEACHER},${STUDENTS},${LIVE}`,
      )
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

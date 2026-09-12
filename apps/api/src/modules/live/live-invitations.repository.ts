import type {
  Tables,
  LiveInvitationStatus,
  HostLiveInvitation,
  StudentLiveInvitation,
} from '@tp/shared'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'
import {
  ConflictError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  RuleViolationError,
} from '../../http/errors'
import { toLiveSession, type LiveSessionSummaryRow } from './live.mapper'

type InvitationRow = Tables<'live_invitations'>
type StudentRow = InvitationRow & { session: LiveSessionSummaryRow }

export const liveInvitationsRepository = {
  async start(input: {
    teacherId: string
    materialId: string
    expectedId: string | null
    checkExpected: boolean
    studentIds?: string[]
    lessonId?: string
    expectedLessonUpdatedAt?: string
    newLesson?: { id: string; durationMinutes: number }
  }): Promise<string> {
    const { data, error } = await supabaseAdmin.rpc('start_live_lesson', {
      p_teacher: input.teacherId,
      p_material: input.materialId,
      p_expected: input.expectedId,
      p_check_expected: input.checkExpected,
      ...(input.studentIds === undefined ? {} : { p_students: input.studentIds }),
      ...(input.lessonId
        ? { p_lesson: input.lessonId, p_lesson_version: input.expectedLessonUpdatedAt }
        : {}),
      ...(input.newLesson
        ? { p_new_lesson: input.newLesson.id, p_duration_minutes: input.newLesson.durationMinutes }
        : {}),
    })
    if (error?.code === '40001') throw new ConflictError('The active lesson changed')
    if (error?.code === '23P01')
      throw new ConflictError('A teacher or student has an overlapping lesson', {
        reason: 'lesson_time_conflict',
      })
    if (error?.code === '42501')
      throw new ForbiddenError('The selected lesson or students are unavailable')
    if (error?.code === '22023')
      throw new ValidationError('Select a lesson with steps and up to 50 students')
    if (error?.code === 'P0002') throw new NotFoundError('Calendar lesson not found')
    if (error?.code === '55000') throw new RuleViolationError('Choose a scheduled lesson')
    if (error) throwFromPostgrest(error, 'start lesson and invite students')
    return data
  },

  async forHost(sessionId: string): Promise<HostLiveInvitation[]> {
    const { data, error } = await supabaseAdmin
      .from('live_invitations')
      .select('*,student:profiles!live_invitations_student_id_fkey(id,full_name,email)')
      .eq('session_id', sessionId)
      .order('invited_at')
      .returns<
        (InvitationRow & { student: { id: string; full_name: string | null; email: string } })[]
      >()
    if (error) throwFromPostgrest(error, 'read invited students')
    return (data ?? []).map((row) => ({
      student: { id: row.student.id, fullName: row.student.full_name, email: row.student.email },
      status: row.status as LiveInvitationStatus,
      invitedAt: row.invited_at,
      readAt: row.read_at,
      joinedAt: row.joined_at,
    }))
  },

  async forStudent(studentId: string): Promise<StudentLiveInvitation[]> {
    const { data, error } = await supabaseAdmin
      .from('live_invitations')
      .select(
        '*,session:live_sessions!live_invitations_session_id_fkey!inner(id,status,material_id,teacher_id,current_step_id,started_at,ended_at,calendar_lesson:lessons!live_sessions_lesson_id_fkey(id,scheduled_at),material:materials!live_sessions_material_id_fkey(id,title,level,deleted_at,material_steps(count)),teacher:profiles!live_sessions_teacher_id_fkey(id,full_name,email))',
      )
      .eq('student_id', studentId)
      .in('status', ['pending', 'joined'])
      .eq('session.status', 'active')
      .order('invited_at', { ascending: false })
      .limit(50)
      .returns<StudentRow[]>()
    if (error) throwFromPostgrest(error, 'read live invitations')
    return (data ?? []).map((row) => ({
      session: toLiveSession(row.session),
      status: row.status as LiveInvitationStatus,
      invitedAt: row.invited_at,
      readAt: row.read_at,
    }))
  },

  async read(studentId: string, sessionIds: string[]) {
    const { error } = await supabaseAdmin
      .from('live_invitations')
      .update({ read_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .in('session_id', sessionIds)
      .is('read_at', null)
    if (error) throwFromPostgrest(error, 'read invitations')
  },

  async respond(
    studentId: string,
    sessionId: string,
    status: 'joined' | 'declined',
  ): Promise<boolean> {
    const now = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('live_invitations')
      .update({ status, read_at: now, ...(status === 'joined' ? { joined_at: now } : {}) })
      .eq('student_id', studentId)
      .eq('session_id', sessionId)
      .neq('status', 'ended')
      .neq('status', status)
      .select('session_id')
      .maybeSingle()
    if (error) throwFromPostgrest(error, 'respond to live invitation')
    if (data) return true
    // Reconnects and repeated clicks acknowledge the same invitation without moving
    // its original join/read timestamps or resurrecting an ended invitation.
    const { data: existing, error: readError } = await supabaseAdmin
      .from('live_invitations')
      .select('session_id')
      .eq('student_id', studentId)
      .eq('session_id', sessionId)
      .eq('status', status)
      .maybeSingle()
    if (readError) throwFromPostgrest(readError, 'read invitation response')
    return existing !== null
  },
}
export type LiveInvitationsRepository = typeof liveInvitationsRepository

import {
  studyTeachers,
  type StudyUpdate,
  type ListMyLessonsQuery,
  type StudyLesson,
} from '@tp/shared'
import { supabaseAdmin } from '../../lib/supabase/admin'
import { throwFromPostgrest } from '../../lib/supabase/errors'
import { toStudentLesson } from '../lessons/lessons.mapper'
import type { StudentLessonRow } from '../lessons/lessons.repository'
import { remindersRepository } from '../reminders/reminders.repository'

type Row = Omit<StudentLessonRow, 'mine'> & {
  mine: { status: StudentLessonRow['mine'][number]['status']; deduct_credit: boolean }[]
}

// Filter membership in the query itself. Never load the teacher's CalendarLesson DTO,
// which includes private notes and every student's contact and attendance information.
function ownLessons(studentId: string) {
  return supabaseAdmin
    .from('lessons')
    .select(
      'id,scheduled_at,duration_minutes,status,topic,teacher:profiles!lessons_teacher_id_fkey(id,full_name,email),mine:lesson_attendees!inner(status,deduct_credit),everyone:lesson_attendees(count)',
    )
    .eq('mine.student_id', studentId)
}

function map(row: Row): StudyLesson {
  return {
    ...toStudentLesson(row),
    deducted: row.status === 'held' && row.mine[0]?.deduct_credit === true,
  }
}

export const studyRepository = {
  async notifications(studentId: string): Promise<StudyUpdate[]> {
    const reminders = await remindersRepository.list(studentId)
    const { data, error } = await supabaseAdmin
      .from('student_notifications')
      .select('id,kind,entity_id,title,scheduled_at,updated_at,read_at')
      .eq('student_id', studentId)
      .order('updated_at', { ascending: false })
      .order('id')
      .limit(30)
    if (error) throwFromPostgrest(error, 'read student notifications')
    const updates: StudyUpdate[] = (data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind as StudyUpdate['kind'],
      entityId: row.entity_id,
      title: row.title,
      scheduledAt: row.scheduled_at,
      updatedAt: row.updated_at,
      readAt: row.read_at,
    }))
    return [...reminders, ...updates]
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id))
      .slice(0, 30)
  },
  async readNotifications(studentId: string, items: { id: string; updatedAt: string }[]) {
    await remindersRepository.markRead(studentId, items)
    // Compare the version that was displayed, so a simultaneous reschedule stays unread.
    for (const item of items) {
      const { error } = await supabaseAdmin
        .from('student_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('student_id', studentId)
        .eq('id', item.id)
        .eq('updated_at', item.updatedAt)
        .is('read_at', null)
      if (error) throwFromPostgrest(error, 'read student notification')
    }
    return { read: true }
  },
  async lessons(studentId: string, { from, to }: ListMyLessonsQuery): Promise<StudyLesson[]> {
    const { data, error } = await ownLessons(studentId)
      .gte('scheduled_at', from)
      .lt('scheduled_at', to)
      .order('scheduled_at')
      .order('id')
      .limit(500)
      .returns<Row[]>()
    if (error) throwFromPostgrest(error, 'read student calendar')
    return (data ?? []).map(map)
  },
  async upcoming(studentId: string): Promise<StudyLesson[]> {
    const now = Date.now()
    // Include a lesson already in progress. Scheduled lessons last at most four hours.
    const { data, error } = await ownLessons(studentId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date(now - 240 * 60_000).toISOString())
      .order('scheduled_at')
      .order('id')
      .limit(30)
      .returns<Row[]>()
    if (error) throwFromPostgrest(error, 'read upcoming student lessons')
    return (data ?? [])
      .filter((row) => Date.parse(row.scheduled_at) + row.duration_minutes * 60_000 > now)
      .slice(0, 5)
      .map(map)
  },
  async teachers(studentId: string) {
    const { data, error } = await supabaseAdmin.rpc('student_study_teachers', {
      p_student: studentId,
    })
    if (error) throwFromPostgrest(error, 'read student lesson balances')
    return studyTeachers.parse(data)
  },
}

import type { LiveSession } from '@tp/shared'
import type { LiveSessionRow } from './live.repository'

export type LiveSessionSummaryRow = Pick<
  LiveSessionRow,
  | 'id'
  | 'status'
  | 'material_id'
  | 'teacher_id'
  | 'material'
  | 'teacher'
  | 'current_step_id'
  | 'started_at'
  | 'ended_at'
  | 'calendar_lesson'
>

export function toLiveSession(row: LiveSessionSummaryRow): LiveSession {
  return {
    id: row.id,
    calendarLesson: row.calendar_lesson
      ? { id: row.calendar_lesson.id, scheduledAt: row.calendar_lesson.scheduled_at }
      : null,
    status: row.status,
    material: {
      id: row.material?.id ?? row.material_id,
      title: row.material?.title ?? '',
      level: row.material?.level ?? 'A1',
      stepCount: row.material?.material_steps[0]?.count ?? 0,
    },
    teacher: row.teacher
      ? { id: row.teacher.id, fullName: row.teacher.full_name, email: row.teacher.email }
      : { id: row.teacher_id, fullName: null, email: '' },
    currentStepId: row.current_step_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  }
}

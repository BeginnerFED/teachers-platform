import type { LessonTally, StudentLesson } from '@tp/shared'
import type { LessonTallyRow, StudentLessonRow } from './lessons.repository'

export function toStudentLesson(row: StudentLessonRow): StudentLesson {
  return {
    id: row.id,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    status: row.status,
    topic: row.topic,
    // The inner join guarantees one row here; falling back keeps a malformed read from
    // taking the whole panel down over one lesson.
    attendance: row.mine[0]?.status ?? 'expected',
    teacher: row.teacher
      ? { id: row.teacher.id, fullName: row.teacher.full_name, email: row.teacher.email }
      : null,
    attendeeCount: row.everyone[0]?.count ?? 1,
  }
}

/**
 * Two questions counted at once, and they are genuinely different: whether the session
 * took place is a fact about the lesson, whether this student was in it is a fact about
 * them. A cancelled lesson is nobody's absence, which is why it has its own number rather
 * than being folded into the missed count.
 */
export function toLessonTally(rows: LessonTallyRow[]): LessonTally {
  const tally: LessonTally = {
    held: 0,
    attended: 0,
    missed: 0,
    excused: 0,
    canceled: 0,
    upcoming: 0,
  }

  for (const row of rows) {
    if (row.lesson?.status === 'held') tally.held += 1
    if (row.lesson?.status === 'canceled') tally.canceled += 1
    // Counted from the stored status rather than from the date, so a session nobody got
    // round to marking stays visible as outstanding instead of vanishing.
    if (row.lesson?.status === 'scheduled') tally.upcoming += 1

    if (row.status === 'present') tally.attended += 1
    if (row.status === 'absent') tally.missed += 1
    if (row.status === 'excused') tally.excused += 1
  }

  return tally
}

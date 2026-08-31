import type { LinkedTeacher, PastTeacher, StudentDetail, StudentListItem } from '@tp/shared'
import type { StudentLinkRow, StudentRow } from './students.repository'

function toTeacher(link: StudentLinkRow): LinkedTeacher | null {
  if (!link.teacher) return null

  return {
    id: link.teacher.id,
    fullName: link.teacher.full_name,
    email: link.teacher.email,
    since: link.created_at,
  }
}

function currentTeachers(row: StudentRow): LinkedTeacher[] {
  return row.teacher_students
    .filter((link) => link.status === 'active')
    .map(toTeacher)
    .filter((teacher): teacher is LinkedTeacher => teacher !== null)
}

export function toStudentListItem(row: StudentRow): StudentListItem {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    createdAt: row.created_at,
    // Filtered again even though the list query already narrowed the embed, so that this
    // stays correct for any caller rather than only for the one that happens to use it.
    teachers: currentTeachers(row),
    lessonsAttended: row.lesson_attendees[0]?.count ?? 0,
  }
}

/** Everything about a student that comes off their own profile row. Lessons are fetched
 *  separately and joined on by the service. */
export function toStudentDetail(row: StudentRow): Omit<StudentDetail, 'lessons'> {
  const past = row.teacher_students
    .filter((link) => link.status === 'ended')
    .map((link) => {
      const teacher = toTeacher(link)

      return teacher === null ? null : { ...teacher, until: link.ended_at }
    })
    .filter((teacher): teacher is PastTeacher => teacher !== null)
    // Most recently ended first. A link closed without a date sorts last rather than
    // throwing the order off, since there is nothing to compare it by.
    .sort((a, b) => (b.until ?? '').localeCompare(a.until ?? ''))

  return { ...toStudentListItem(row), pastTeachers: past }
}

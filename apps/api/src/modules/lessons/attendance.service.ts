import { attendanceRepository } from './attendance.repository'
import { lessonsRepository } from './lessons.repository'
import { toCalendarLesson } from './lessons.mapper'
import type { PendingLessons, TeacherStudentOverview } from '@tp/shared'
import { assignmentsRepository } from '../assignments/assignments.repository'

export const attendanceService = {
  record: attendanceRepository.record,
  summary: attendanceRepository.summary,
  grant: attendanceRepository.grant,
  reverse: attendanceRepository.reverse,
  async overview(teacherId: string): Promise<TeacherStudentOverview[]> {
    const [students, balances] = await Promise.all([
      assignmentsRepository.activeStudentsOf(teacherId),
      attendanceRepository.balances(teacherId),
    ])
    const byId = new Map(balances.map((balance) => [balance.studentId, balance]))
    return students.map((student) => {
      const balance = byId.get(student.id)
      return {
        id: student.id,
        fullName: student.full_name,
        email: student.email,
        granted: balance?.granted ?? 0,
        used: balance?.used ?? 0,
        remaining: balance?.remaining ?? 0,
      }
    })
  },
  async pending(teacherId: string): Promise<PendingLessons> {
    const { ids, total } = await attendanceRepository.pending(teacherId)
    const rows = ids.length ? await lessonsRepository.listByIds(teacherId, ids) : []
    return { items: rows.map(toCalendarLesson), total }
  },
}

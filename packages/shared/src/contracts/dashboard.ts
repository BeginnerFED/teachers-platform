import type { StudentListItem } from './students'
import type { SubscriptionEventType, TeacherListItem } from './teachers'

export type DashboardQueue<T> = { total: number; items: T[] }

export type AdminDashboard = {
  asOf: string
  counts: {
    teachers: number
    students: number
    availableTeachers: number
    publishedMaterials: number
  }
  expiring: DashboardQueue<TeacherListItem>
  expired: DashboardQueue<TeacherListItem>
  unlinked: DashboardQueue<StudentListItem>
  recentTeachers: TeacherListItem[]
}

export type DashboardActivityPerson = {
  id: string
  fullName: string | null
  email: string
  role: 'teacher' | 'student'
}

export type DashboardActivityItem = {
  id: string
  createdAt: string
  subject: DashboardActivityPerson
} & (
  | { kind: 'account'; type: 'teacher_created' | 'student_created' }
  | {
      kind: 'access'
      type: SubscriptionEventType
      actor: { fullName: string | null; email: string } | null
      months: number | null
    }
  | {
      // Relationships retain their latest state, not a complete event history.
      kind: 'roster'
      type: 'teacher_assigned' | 'teacher_unassigned'
      teacher: DashboardActivityPerson
    }
)

export type AdminDashboardActivity = { items: DashboardActivityItem[] }

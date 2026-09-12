import type {
  AdminDashboardActivity,
  DashboardActivityItem,
  DashboardActivityPerson,
} from '@tp/shared'
import { dashboardRepository } from './dashboard.repository'

const ACTIVITY_LIMIT = 12

function person(
  row: { id: string; full_name: string | null; email: string },
  role: DashboardActivityPerson['role'],
): DashboardActivityPerson {
  return { id: row.id, fullName: row.full_name, email: row.email, role }
}

export function createDashboardActivityService(repository: typeof dashboardRepository) {
  return {
    async list(): Promise<AdminDashboardActivity> {
      // Taking N from each source guarantees the newest N overall without loading
      // an entire directory. This feed fails independently from the overview.
      const [accounts, access, roster] = await Promise.all([
        repository.recentAccounts(ACTIVITY_LIMIT),
        repository.recentAccessChanges(ACTIVITY_LIMIT),
        repository.recentRosterChanges(ACTIVITY_LIMIT),
      ])
      const items: DashboardActivityItem[] = []

      for (const account of accounts) {
        if (account.role !== 'teacher' && account.role !== 'student') continue
        items.push({
          id: `account:${account.id}`,
          createdAt: account.created_at,
          subject: person(account, account.role),
          kind: 'account',
          type: account.role === 'teacher' ? 'teacher_created' : 'student_created',
        })
      }

      for (const event of access) {
        const payload = event.payload
        const months =
          payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.months : null
        items.push({
          id: `access:${event.id}`,
          createdAt: event.created_at,
          subject: person(event.subject, 'teacher'),
          kind: 'access',
          type: event.type,
          actor: event.actor ? { fullName: event.actor.full_name, email: event.actor.email } : null,
          months:
            typeof months === 'number' && Number.isInteger(months) && months > 0 ? months : null,
        })
      }

      for (const link of roster) {
        items.push({
          id: `roster:${link.id}`,
          // Reopening a relationship preserves created_at. updated_at captures
          // the last assignment/end instead of reporting the original start.
          createdAt: link.updated_at,
          subject: person(link.student, 'student'),
          kind: 'roster',
          type: link.status === 'active' ? 'teacher_assigned' : 'teacher_unassigned',
          teacher: person(link.teacher, 'teacher'),
        })
      }

      items.sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id),
      )
      return { items: items.slice(0, ACTIVITY_LIMIT) }
    },
  }
}

export const dashboardActivityService = createDashboardActivityService(dashboardRepository)

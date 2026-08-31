import type { TeacherListItem } from '@tp/shared'
import { toTeacherSubscription } from '../subscriptions/subscriptions.mapper'
import type { TeacherRow } from './teachers.repository'

/**
 * The seam between the database's snake_case and the camelCase every client sees.
 * Keeping it in one function means a column rename is a one-file change rather than a
 * search across the web app.
 */
export function toTeacherListItem(row: TeacherRow, now: Date): TeacherListItem {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    createdAt: row.created_at,
    subscription: row.subscriptions ? toTeacherSubscription(row.subscriptions, now) : null,
  }
}

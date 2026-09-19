import type { AssignmentListItem } from '@tp/shared'

/** A submitted assignment stays with the teacher until they finish its feedback review. */
export function awaitingTeacher(item: AssignmentListItem): boolean {
  return item.status === 'submitted'
}

/** Still open, and past the day it was due. Handed-in work is never late, only later. */
export function isOverdue(item: AssignmentListItem, now = Date.now()): boolean {
  return item.status === 'assigned' && item.dueAt !== null && new Date(item.dueAt).getTime() < now
}

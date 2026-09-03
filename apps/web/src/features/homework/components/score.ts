import type { AssignmentListItem } from '@tp/shared'

/**
 * One number for the whole piece of work: what the machine marked plus what the teacher
 * gave, over everything that could be earned. Null before it is handed in — there is no
 * score for work that is still being done.
 */
export function totalScore(item: AssignmentListItem): { score: number; max: number } | null {
  if (item.status === 'assigned' || item.autoScore === null || item.autoMax === null) return null

  return {
    score: item.autoScore + (item.manualScore ?? 0),
    max: item.autoMax + item.manualMax,
  }
}

/** Whether there is writing the teacher still has to read. */
export function awaitingTeacher(item: AssignmentListItem): boolean {
  return item.status === 'submitted' && item.manualMax > 0
}

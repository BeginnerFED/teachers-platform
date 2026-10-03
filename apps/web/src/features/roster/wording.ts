import type { EndedLink } from '@tp/shared'
import type { Messages } from '@/messages'
import type { EndLinkResult, LinkResult } from './actions'

/**
 * What both panels say about a link, worded once: a teacher's panel and a student's panel
 * end and refuse the same links, and two copies of the sentence is how one drifts.
 */

/**
 * The toast after a link ends: the headline, and what it took with it in numbers. An answer
 * without the numbers gets the headline alone, since "nothing was planned" would be a guess.
 */
export function endedLinkToast(ended: EndedLink | null, t: Messages) {
  if (!ended) return { title: t.teachers.detail.unlinked }

  const words = t.teachers.detail.ended
  const counts = [
    [ended.canceledLessons, words.canceledLessons],
    [ended.leftGroupLessons, words.leftGroupLessons],
    [ended.withdrawnHomework, words.withdrawnHomework],
  ] as const
  const said = counts
    .filter(([count]) => count > 0)
    .map(([count, text]) => text.replace('{count}', String(count)))

  return {
    title: t.teachers.detail.unlinked,
    description: said.length > 0 ? said.join(' · ') : words.nothing,
  }
}

export function endLinkFailure(error: NonNullable<EndLinkResult['error']>, t: Messages) {
  return error === 'live_lesson_running' ? t.teachers.detail.liveLessonRunning : t.errors[error]
}

/** A refused pick: whose student it already is, or the error's own words. */
export function linkFailure(result: LinkResult, t: Messages) {
  if (result.error === 'student_has_teacher') {
    return t.teachers.detail.studentHasTeacher.replace('{name}', result.teacher ?? '—')
  }

  return result.error ? t.errors[result.error] : null
}

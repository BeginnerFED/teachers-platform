import type { Messages } from '@/messages'
import { OLYA } from './data'

/**
 * What the progress scene says, picked on the server from the page's dictionary: the
 * caption, and the student drawer's own words around Оля's numbers.
 */
export function pickProgressCopy(t: Messages) {
  const progress = t.teacherHome.students.progress

  return {
    title: t.loginPromo.scenes.progress.title,
    line: t.loginPromo.scenes.progress.line,
    student: t.loginPromo.people.olya,
    description: progress.description,
    overviewTab: progress.overviewTab,
    creditsTab: progress.creditsTab,
    attention: progress.attention,
    lowCredits: progress.lowCredits.replace('{count}', String(OLYA.credits.remaining)),
    lessonTotals: progress.lessonTotals,
    attended: progress.attended,
    missed: progress.missed,
    excused: progress.excused,
    planned: progress.planned,
    homework: progress.homework,
    open: progress.open,
    waiting: progress.waiting,
    completed: progress.completed,
  }
}

export type ProgressCopy = ReturnType<typeof pickProgressCopy>

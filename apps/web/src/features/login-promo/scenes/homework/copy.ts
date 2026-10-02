import { counted } from '@/lib/format'
import type { Messages } from '@/messages'
import { EARLIER, EMAILS, LESSON } from './data'

/** What the homework scene says, picked on the server from the page's dictionary. */
export function pickHomeworkCopy(t: Messages) {
  const locale = t.common.pickerLocale
  const { people } = t.loginPromo
  const ago = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  const students = [
    { name: people.olya, email: EMAILS.olya },
    { name: people.maksym, email: EMAILS.maksym },
    { name: people.iryna, email: EMAILS.iryna },
  ]

  // Each desk row's second line, written the way the desk's own describe() writes it
  // (homework-list.tsx): when it was given or came back, the deadline, how far along.
  const justGiven = [
    `${t.homework.givenOn} ${ago.format(0, 'minute')}`,
    t.homework.noDue,
    `0 ${t.homework.row.of} ${counted(LESSON.steps, t.homework.units.steps, locale)}`,
  ].join(' · ')

  const desk = [
    ...students.map(({ name }) => ({
      name,
      lesson: LESSON.title,
      line: justGiven,
      status: 'assigned' as const,
    })),
    {
      name: people.anna,
      lesson: EARLIER.anna,
      line: `${t.homework.submittedOn} ${ago.format(-1, 'day')} · ${t.homework.awaitingTeacher}`,
      status: 'submitted' as const,
    },
    {
      name: people.dmytro,
      lesson: EARLIER.dmytro,
      line: `${t.homework.gradedOn} ${ago.format(-3, 'day')}`,
      status: 'graded' as const,
    },
  ]

  return {
    title: t.loginPromo.scenes.homework.title,
    line: t.loginPromo.scenes.homework.line,
    assignTitle: t.homework.assignTitle,
    assignBody: t.homework.assignBody,
    studentsLabel: t.homework.sections.students,
    studentsHelp: t.homework.sections.studentsHelp,
    students,
    selected: t.homework.selected,
    send: t.homework.send,
    sending: t.homework.sending,
    sent: `${t.homework.sent}: ${students.length}`,
    desk,
    statuses: t.homework.status,
  }
}

export type HomeworkCopy = ReturnType<typeof pickHomeworkCopy>

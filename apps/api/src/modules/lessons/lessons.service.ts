import type { StudentLessons } from '@tp/shared'
import { toLessonTally, toStudentLesson } from './lessons.mapper'
import { lessonsRepository, type LessonsRepository } from './lessons.repository'

/**
 * A year of weekly lessons is fifty-odd, so this is a couple of years of history in one
 * panel. Past it the list stops being something anybody reads and starts being a payload
 * — which is why the tally beside it is counted over everything rather than over this.
 */
const LESSON_LIST_LIMIT = 120

export type LessonsServiceDeps = {
  lessons: LessonsRepository
}

export function createLessonsService({ lessons }: LessonsServiceDeps) {
  return {
    async forStudent(studentId: string): Promise<StudentLessons> {
      // Independent reads, so they go together rather than one after the other.
      const [rows, tally] = await Promise.all([
        lessons.listForStudent(studentId, LESSON_LIST_LIMIT),
        lessons.tallyForStudent(studentId),
      ])

      return { tally: toLessonTally(tally), items: rows.map(toStudentLesson) }
    },
  }
}

export type LessonsService = ReturnType<typeof createLessonsService>

export const lessonsService = createLessonsService({ lessons: lessonsRepository })

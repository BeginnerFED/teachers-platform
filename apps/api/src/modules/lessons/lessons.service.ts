import type {
  CalendarLesson,
  ListLessonsQuery,
  ListMyLessonsQuery,
  StudentLessons,
  ScheduleLessonBody,
  UpdateLessonBody,
} from '@tp/shared'
import { toCalendarLesson, toLessonTally, toStudentLesson } from './lessons.mapper'
import { lessonsRepository, type LessonsRepository } from './lessons.repository'

/**
 * A week of every teacher on the platform. Well past what a calendar can draw legibly, so
 * hitting it means the window asked for was not a week — the cap is there to stop that
 * becoming an unbounded response, not to paginate anything.
 */
const RANGE_LIMIT = 500

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
    async update(teacherId: string, lessonId: string, body: UpdateLessonBody) {
      const id = await lessons.update(teacherId, lessonId, body)
      return { id, scheduledAt: body.scheduledAt }
    },

    async schedule(teacherId: string, body: ScheduleLessonBody) {
      const id = await lessons.schedule(teacherId, body)
      return { id, scheduledAt: body.scheduledAt }
    },

    async forStudent(studentId: string): Promise<StudentLessons> {
      // Independent reads, so they go together rather than one after the other.
      const [rows, tally] = await Promise.all([
        lessons.listForStudent(studentId, LESSON_LIST_LIMIT),
        lessons.tallyForStudent(studentId),
      ])

      return { tally: toLessonTally(tally), items: rows.map(toStudentLesson) }
    },

    async listForRange(query: ListLessonsQuery): Promise<CalendarLesson[]> {
      const rows = await lessons.listForRange({ ...query, limit: RANGE_LIMIT })

      return rows.map(toCalendarLesson)
    },

    async listForTeacher(teacherId: string, query: ListMyLessonsQuery): Promise<CalendarLesson[]> {
      // Applied after the query spread so a forged selector can never replace the
      // authenticated teacher, even if a future caller skips query validation.
      const rows = await lessons.listForRange({ ...query, teacherId, limit: RANGE_LIMIT })

      return rows.map(toCalendarLesson)
    },
  }
}

export type LessonsService = ReturnType<typeof createLessonsService>

export const lessonsService = createLessonsService({ lessons: lessonsRepository })

import type { ListStudentsQuery, PageMeta, StudentDetail, StudentListItem } from '@tp/shared'
import { NotFoundError } from '../../http/errors'
import { lessonsService, type LessonsService } from '../lessons/lessons.service'
import { toStudentDetail, toStudentListItem } from './students.mapper'
import { studentsRepository, type StudentsRepository } from './students.repository'

export type StudentsServiceDeps = {
  students: StudentsRepository
  lessons: LessonsService
}

export function createStudentsService({ students, lessons }: StudentsServiceDeps) {
  return {
    async list(params: ListStudentsQuery): Promise<{ items: StudentListItem[]; meta: PageMeta }> {
      const { rows, total } = await students.list(params)

      return {
        items: rows.map(toStudentListItem),
        meta: { page: params.page, perPage: params.perPage, total },
      }
    },

    async getDetail(studentId: string): Promise<StudentDetail> {
      const row = await students.findById(studentId)

      // findById already filters on role, so this covers both "no such account" and "that
      // account is not a student". The caller learns neither, which is correct.
      if (!row) throw new NotFoundError('No such student')

      // Fetched only after the account is known to exist and to be a student, so a
      // guessed id cannot be used to find out how many lessons somebody has had.
      return { ...toStudentDetail(row), lessons: await lessons.forStudent(studentId) }
    },
  }
}

export type StudentsService = ReturnType<typeof createStudentsService>

export const studentsService = createStudentsService({
  students: studentsRepository,
  lessons: lessonsService,
})

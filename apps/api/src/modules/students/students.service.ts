import type { ListStudentsQuery, PageMeta, StudentDetail, StudentListItem } from '@tp/shared'
import { NotFoundError } from '../../http/errors'
import { toStudentDetail, toStudentListItem } from './students.mapper'
import { studentsRepository, type StudentsRepository } from './students.repository'

export type StudentsServiceDeps = {
  students: StudentsRepository
}

export function createStudentsService({ students }: StudentsServiceDeps) {
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

      return toStudentDetail(row)
    },
  }
}

export type StudentsService = ReturnType<typeof createStudentsService>

export const studentsService = createStudentsService({ students: studentsRepository })

import type {
  CreateStudentBody,
  CreatedAccount,
  ListStudentsQuery,
  PageMeta,
  StudentDetail,
  StudentListItem,
} from '@tp/shared'
import { NotFoundError } from '../../http/errors'
import { accountsService, type AccountsService } from '../accounts/accounts.service'
import { lessonsService, type LessonsService } from '../lessons/lessons.service'
import { teachersService, type TeachersService } from '../teachers/teachers.service'
import { toStudentDetail, toStudentListItem } from './students.mapper'
import { studentsRepository, type StudentsRepository } from './students.repository'

export type StudentsServiceDeps = {
  students: StudentsRepository
  lessons: LessonsService
  accounts: Pick<AccountsService, 'create'>
  teachers: Pick<TeachersService, 'getOne' | 'linkStudent'>
}

export function createStudentsService({
  students,
  lessons,
  accounts,
  teachers,
}: StudentsServiceDeps) {
  return {
    /**
     * A student cannot sign themselves up — public signup only ever makes a teacher — so
     * every student account starts here, with somebody typing an address they vouch for.
     * Who they study with can be said in the same breath, or later from either panel.
     */
    async create({ teacherId, ...body }: CreateStudentBody): Promise<CreatedAccount> {
      // The teacher is checked before anything is made. An account created and then
      // refused would exist with a password nobody ever saw — the one outcome worse than
      // asking again.
      if (teacherId) await teachers.getOne(teacherId)

      const created = await accounts.create(body, 'student')

      if (teacherId) await teachers.linkStudent({ teacherId, studentId: created.id })

      return created
    },

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
  accounts: accountsService,
  teachers: teachersService,
})

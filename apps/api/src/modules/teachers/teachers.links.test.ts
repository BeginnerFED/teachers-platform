import { afterEach, describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import { ConflictError, InternalError, RuleViolationError } from '../../http/errors'
import type { CurrentTeacherRow, TeacherStudentsRepository } from './teacher-students.repository'
import type { TeacherRow, TeachersRepository } from './teachers.repository'
import { createTeachersService } from './teachers.service'

const rpc = vi.hoisted(() => vi.fn())
const from = vi.hoisted(() => vi.fn())
vi.mock('../../lib/supabase/admin', () => ({ supabaseAdmin: { rpc, from } }))

const { teacherStudentsRepository } = await import('./teacher-students.repository')

const TEACHER: TeacherRow = {
  id: 'teacher-a',
  email: 'anna@example.com',
  full_name: 'Anna Shevchenko',
  created_at: '2026-09-01T12:00:00.000Z',
  role: 'teacher',
  subscriptions: null,
  teacher_students: [{ count: 0 }],
}
const OTHER: CurrentTeacherRow = {
  id: 'teacher-b',
  full_name: 'Olena Koval',
  email: 'olena@example.com',
}
const ENDED = { canceledLessons: 2, leftGroupLessons: 1, withdrawnHomework: 3 }

/** findCurrentTeacher answers in turn: before the write, then after it if one is needed. */
function setup({
  current = null,
  written = 'linked',
  winner = null,
}: {
  current?: CurrentTeacherRow | null
  written?: 'linked' | 'taken'
  winner?: CurrentTeacherRow | null
} = {}) {
  const students: TeacherStudentsRepository = {
    listActiveForTeacher: vi.fn(),
    findLink: vi.fn().mockResolvedValue({ id: 'link', status: 'active' }),
    findCurrentTeacher: vi.fn().mockResolvedValueOnce(current).mockResolvedValueOnce(winner),
    link: vi.fn().mockResolvedValue(written),
    end: vi.fn().mockResolvedValue(ENDED),
  }
  const teachers: TeachersRepository = {
    list: vi.fn(),
    findById: vi.fn().mockResolvedValue(TEACHER),
  }

  const service = createTeachersService({
    teachers,
    students,
    subscriptions: {} as never,
    events: {} as never,
    accounts: { create: vi.fn() },
    roles: { findRoleById: vi.fn().mockResolvedValue('student') },
    clock: { now: () => new Date('2026-10-03T12:00:00.000Z') },
  })

  return { students, service }
}

const PAIR = { teacherId: 'teacher-a', studentId: 'student' }

afterEach(() => vi.clearAllMocks())

describe('putting a student with a teacher', () => {
  it('links a student nobody teaches yet', async () => {
    const { students, service } = setup()

    await expect(service.linkStudent(PAIR)).resolves.toBeUndefined()
    expect(students.link).toHaveBeenCalledWith('teacher-a', 'student')
  })

  it('refuses a student who already has another teacher, and names that teacher', async () => {
    const { students, service } = setup({ current: OTHER })

    const failure = await service.linkStudent(PAIR).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ConflictError)
    expect(failure).toMatchObject({
      status: 409,
      details: {
        reason: 'student_has_teacher',
        teacher: { id: 'teacher-b', fullName: 'Olena Koval', email: 'olena@example.com' },
      },
    })
    expect(students.link).not.toHaveBeenCalled()
  })

  it('treats asking again for the same teacher as done, not as a conflict', async () => {
    const { students, service } = setup({ current: { ...OTHER, id: 'teacher-a' } })

    await expect(service.linkStudent(PAIR)).resolves.toBeUndefined()
    expect(students.link).not.toHaveBeenCalled()
  })

  // Two admins placing the same student at the same moment: the index lets one through.
  it('names the teacher who won when the database refuses the write', async () => {
    const { service } = setup({ written: 'taken', winner: OTHER })

    await expect(service.linkStudent(PAIR)).rejects.toMatchObject({
      status: 409,
      details: { reason: 'student_has_teacher', teacher: { id: 'teacher-b' } },
    })
  })

  it('answers the losing duplicate of its own request as done', async () => {
    const { service } = setup({ written: 'taken', winner: { ...OTHER, id: 'teacher-a' } })

    await expect(service.linkStudent(PAIR)).resolves.toBeUndefined()
  })

  it('still answers with a conflict when the winner has gone again by the re-read', async () => {
    const { service } = setup({ written: 'taken', winner: null })

    await expect(service.linkStudent(PAIR)).rejects.toBeInstanceOf(ConflictError)
  })
})

describe('ending a student’s time with a teacher', () => {
  it('ends the link through the one database call and reports what it took with it', async () => {
    const { students, service } = setup()

    await expect(service.unlinkStudent(PAIR)).resolves.toEqual(ENDED)
    expect(students.end).toHaveBeenCalledWith('teacher-a', 'student')
  })

  it('refuses a student who is not with this teacher', async () => {
    const { students, service } = setup()
    vi.mocked(students.findLink).mockResolvedValue({ id: 'link', status: 'ended' })

    await expect(service.unlinkStudent(PAIR)).rejects.toBeInstanceOf(ConflictError)
    expect(students.end).not.toHaveBeenCalled()
  })
})

/** An upsert stand-in: awaiting it answers with what the database said. */
function upsertAnswer(error: { code: string; message: string } | null) {
  return { upsert: vi.fn().mockResolvedValue({ data: null, error }) }
}

describe('the link table', () => {
  it('reports the one-teacher index refusing a write as taken, not as a failure', async () => {
    from.mockReturnValue(
      upsertAnswer({
        code: '23505',
        message:
          'duplicate key value violates unique constraint "teacher_students_one_active_teacher"',
      }),
    )

    await expect(teacherStudentsRepository.link('teacher-a', 'student')).resolves.toBe('taken')
  })

  it('still reports any other duplicate as a conflict', async () => {
    from.mockReturnValue(
      upsertAnswer({ code: '23505', message: 'duplicate key value violates "something_else"' }),
    )

    await expect(teacherStudentsRepository.link('teacher-a', 'student')).rejects.toBeInstanceOf(
      ConflictError,
    )
  })

  it('ends a link through end_teacher_student_link and reads its counts', async () => {
    rpc.mockResolvedValue({ data: ENDED, error: null })

    await expect(teacherStudentsRepository.end('teacher-a', 'student')).resolves.toEqual(ENDED)
    expect(rpc).toHaveBeenCalledWith('end_teacher_student_link', {
      p_teacher: 'teacher-a',
      p_student: 'student',
    })
  })

  it('refuses while a live lesson with the student is running', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '55000', message: 'A live lesson with this student is running' },
    })

    const failure = await teacherStudentsRepository
      .end('teacher-a', 'student')
      .catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(RuleViolationError)
    expect(failure).toMatchObject({ status: 422, details: { reason: 'live_lesson_running' } })
  })

  it('treats any other database failure as ours', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '57014', message: 'statement timeout' } })

    await expect(teacherStudentsRepository.end('teacher-a', 'student')).rejects.toMatchObject({
      code: 'internal',
      status: 500,
    })
  })

  // The link has ended by then, so the admin must not be told their request was invalid.
  it('treats an answer it cannot read as ours, not as a bad request', async () => {
    rpc.mockResolvedValue({ data: { canceledLessons: 2 }, error: null })

    const failure = await teacherStudentsRepository
      .end('teacher-a', 'student')
      .catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(InternalError)
    expect(failure).toMatchObject({
      status: 500,
      message: 'Ending a link returned an unknown result',
      cause: expect.any(ZodError),
    })
  })
})

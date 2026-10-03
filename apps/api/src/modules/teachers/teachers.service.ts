import type {
  CreateAccountBody,
  CreatedAccount,
  EndedLink,
  ListTeachersQuery,
  PageMeta,
  StudentHasTeacher,
  TeacherDetail,
  TeacherListItem,
} from '@tp/shared'
import { ConflictError, NotFoundError, RuleViolationError } from '../../http/errors'
import { systemClock, type Clock } from '../../lib/clock'
import { accountsRepository, type AccountsRepository } from '../accounts/accounts.repository'
import { accountsService, type AccountsService } from '../accounts/accounts.service'
import {
  subscriptionEventsRepository,
  type SubscriptionEventsRepository,
} from '../subscriptions/subscription-events.repository'
import {
  subscriptionsService,
  type SubscriptionsService,
} from '../subscriptions/subscriptions.service'
import {
  teacherStudentsRepository,
  type CurrentTeacherRow,
  type TeacherStudentsRepository,
} from './teacher-students.repository'
import { toTeacherDetail, toTeacherListItem } from './teachers.mapper'
import { teachersRepository, type TeachersRepository } from './teachers.repository'

/** Enough to answer any question an admin has; older than that belongs in a report. */
const EVENT_HISTORY_LIMIT = 50

/**
 * High enough that a real teacher's whole roll comes back, so the number in the heading
 * and the names underneath it agree. The cap exists only to stop an absurd row count
 * from becoming an absurd response.
 */
const STUDENT_LIST_LIMIT = 100

/** The refusal carries the teacher's name, so whoever asked can see whose student it is. */
function studentHasTeacher(teacher: CurrentTeacherRow): ConflictError {
  const details: StudentHasTeacher = {
    reason: 'student_has_teacher',
    teacher: { id: teacher.id, fullName: teacher.full_name, email: teacher.email },
  }

  return new ConflictError('That student already studies with another teacher', details)
}

export type TeachersServiceDeps = {
  teachers: TeachersRepository
  subscriptions: SubscriptionsService
  events: SubscriptionEventsRepository
  students: TeacherStudentsRepository
  accounts: Pick<AccountsService, 'create'>
  /** To check that the account on the other end of a link really is a student. */
  roles: Pick<AccountsRepository, 'findRoleById'>
  clock: Clock
}

export function createTeachersService({
  teachers,
  subscriptions,
  events,
  students,
  accounts,
  roles,
  clock,
}: TeachersServiceDeps) {
  async function getOne(teacherId: string): Promise<TeacherListItem> {
    const row = await teachers.findById(teacherId)

    // findById already filters on role, so this covers both "no such account" and
    // "that account is not a teacher". The caller learns neither, which is correct.
    if (!row) throw new NotFoundError('No such teacher')

    return toTeacherListItem(row, clock.now())
  }

  /** Every action re-reads afterwards, so the caller gets the row as it now stands. */
  async function act(teacherId: string, run: () => Promise<unknown>): Promise<TeacherListItem> {
    await getOne(teacherId)
    await run()

    return getOne(teacherId)
  }

  return {
    getOne,

    /**
     * The account starts its trial by itself: a database trigger opens one the moment a
     * profile appears with this role, which is the same thing that happens when a teacher
     * signs themselves up. Nothing extra is needed here.
     */
    async create(body: CreateAccountBody): Promise<CreatedAccount> {
      return accounts.create(body, 'teacher')
    },

    async getDetail(teacherId: string): Promise<TeacherDetail> {
      const row = await teachers.findById(teacherId)
      if (!row) throw new NotFoundError('No such teacher')

      // Independent reads, so they go together rather than one after the other.
      const [history, roll] = await Promise.all([
        events.listByProfileId(teacherId, EVENT_HISTORY_LIMIT),
        students.listActiveForTeacher(teacherId, STUDENT_LIST_LIMIT),
      ])

      return toTeacherDetail(row, history, roll, clock.now())
    },

    async list(
      params: ListTeachersQuery,
      now = clock.now(),
    ): Promise<{ items: TeacherListItem[]; meta: PageMeta }> {
      const { rows, total } = await teachers.list({ ...params, now })

      return {
        items: rows.map((row) => toTeacherListItem(row, now)),
        meta: { page: params.page, perPage: params.perPage, total },
      }
    },

    extendSubscription({
      teacherId,
      months,
      actorId,
    }: {
      teacherId: string
      months: number
      actorId: string
    }) {
      return act(teacherId, () => subscriptions.extend({ profileId: teacherId, months, actorId }))
    },

    suspendSubscription({
      teacherId,
      reason,
      actorId,
    }: {
      teacherId: string
      reason?: string
      actorId: string
    }) {
      return act(teacherId, () => subscriptions.suspend({ profileId: teacherId, reason, actorId }))
    },

    reactivateSubscription({ teacherId, actorId }: { teacherId: string; actorId: string }) {
      return act(teacherId, () => subscriptions.reactivate({ profileId: teacherId, actorId }))
    },

    /**
     * Puts a student with a teacher. Both ends are checked to be what they claim — a
     * teacher linked to another teacher, or to an administrator, would be a row that every
     * later query silently mishandles.
     *
     * A student has one teacher at a time, so one who already has somebody is refused
     * rather than moved. Moving takes ending the current link first, which cancels what was
     * planned with that teacher — something to be seen happening, not folded into a pick.
     */
    async linkStudent({ teacherId, studentId }: { teacherId: string; studentId: string }) {
      await getOne(teacherId)

      const role = await roles.findRoleById(studentId)
      if (role === null) throw new NotFoundError('No such student')
      if (role !== 'student') throw new RuleViolationError('That account is not a student')

      const current = await students.findCurrentTeacher(studentId)
      // Asking again for the teacher they already have changes nothing, so a retried
      // request answers the way the first one did.
      if (current?.id === teacherId) return
      if (current) throw studentHasTeacher(current)

      if ((await students.link(teacherId, studentId)) === 'linked') return

      // Somebody else placed them between the read and the write, and the database let
      // exactly one of the two through. The answer names whichever teacher that was.
      const winner = await students.findCurrentTeacher(studentId)
      if (winner?.id === teacherId) return
      if (winner) throw studentHasTeacher(winner)

      throw new ConflictError('The student’s teacher changed while this was being saved')
    },

    /**
     * Ends a student's time with a teacher, and what was planned under it, in one database
     * transaction: upcoming lessons the student had alone are cancelled, group lessons go
     * ahead without them, and homework they had not handed in is withdrawn. Lessons that
     * have begun and work that was handed in stay, as the record of what happened.
     */
    async unlinkStudent({
      teacherId,
      studentId,
    }: {
      teacherId: string
      studentId: string
    }): Promise<EndedLink> {
      await getOne(teacherId)

      const existing = await students.findLink(teacherId, studentId)
      if (existing?.status !== 'active') {
        throw new ConflictError('That student is not with this teacher')
      }

      return students.end(teacherId, studentId)
    },
  }
}

export type TeachersService = ReturnType<typeof createTeachersService>

export const teachersService = createTeachersService({
  teachers: teachersRepository,
  subscriptions: subscriptionsService,
  events: subscriptionEventsRepository,
  students: teacherStudentsRepository,
  accounts: accountsService,
  roles: accountsRepository,
  clock: systemClock,
})

import type {
  CreateAccountBody,
  CreatedAccount,
  ListTeachersQuery,
  PageMeta,
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

    async list(params: ListTeachersQuery): Promise<{ items: TeacherListItem[]; meta: PageMeta }> {
      const { rows, total } = await teachers.list(params)
      const now = clock.now()

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
     */
    async linkStudent({ teacherId, studentId }: { teacherId: string; studentId: string }) {
      await getOne(teacherId)

      const role = await roles.findRoleById(studentId)
      if (role === null) throw new NotFoundError('No such student')
      if (role !== 'student') throw new RuleViolationError('That account is not a student')

      const existing = await students.findLink(teacherId, studentId)
      if (existing?.status === 'active') {
        throw new ConflictError('That student is already with this teacher')
      }

      await students.link(teacherId, studentId)
    },

    async unlinkStudent({ teacherId, studentId }: { teacherId: string; studentId: string }) {
      await getOne(teacherId)

      const existing = await students.findLink(teacherId, studentId)
      if (existing?.status !== 'active') {
        throw new ConflictError('That student is not with this teacher')
      }

      await students.unlink(teacherId, studentId)
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

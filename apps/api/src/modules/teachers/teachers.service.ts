import type { ListTeachersQuery, PageMeta, TeacherDetail, TeacherListItem } from '@tp/shared'
import { NotFoundError } from '../../http/errors'
import { systemClock, type Clock } from '../../lib/clock'
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
  clock: Clock
}

export function createTeachersService({
  teachers,
  subscriptions,
  events,
  students,
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
    ): Promise<{ items: TeacherListItem[]; meta: PageMeta }> {
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
      return act(teacherId, () =>
        subscriptions.extend({ profileId: teacherId, months, actorId }),
      )
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
      return act(teacherId, () =>
        subscriptions.suspend({ profileId: teacherId, reason, actorId }),
      )
    },

    reactivateSubscription({ teacherId, actorId }: { teacherId: string; actorId: string }) {
      return act(teacherId, () => subscriptions.reactivate({ profileId: teacherId, actorId }))
    },
  }
}

export type TeachersService = ReturnType<typeof createTeachersService>

export const teachersService = createTeachersService({
  teachers: teachersRepository,
  subscriptions: subscriptionsService,
  events: subscriptionEventsRepository,
  students: teacherStudentsRepository,
  clock: systemClock,
})

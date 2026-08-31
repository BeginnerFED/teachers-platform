import { z } from 'zod'
import { Constants } from '../database.types'
import { paginationQuery } from './pagination'

/**
 * Taken from the generated database enum rather than typed out again, so adding a status
 * in a migration cannot leave the API validating against a stale list.
 */
export const SUBSCRIPTION_STATUSES = Constants.public.Enums.subscription_status
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

export const listTeachersQuery = paginationQuery.extend({
  status: z.enum(SUBSCRIPTION_STATUSES).optional(),
  /** Matched against name and email. */
  query: z.string().trim().min(1).max(120).optional(),
})

export type ListTeachersQuery = z.infer<typeof listTeachersQuery>

export const extendSubscriptionBody = z.object({
  months: z.number().int().min(1).max(12).default(1),
})

export type ExtendSubscriptionBody = z.infer<typeof extendSubscriptionBody>

export const suspendSubscriptionBody = z.object({
  reason: z.string().trim().max(500).optional(),
})

export type SuspendSubscriptionBody = z.infer<typeof suspendSubscriptionBody>

export const teacherIdParam = z.object({
  teacherId: z.uuid(),
})

export type TeacherSubscription = {
  status: SubscriptionStatus
  /** ISO 8601, or null when nothing governs access yet. */
  accessEndsAt: string | null
  /** Whole days left, rounded up. Zero or negative once it has run out; null with no end date. */
  daysRemaining: number | null
  /**
   * Whether this teacher can actually work right now. Not the same as a date comparison:
   * a suspended account with three weeks left still has no access.
   */
  hasAccess: boolean
}

export type TeacherListItem = {
  id: string
  email: string
  fullName: string | null
  createdAt: string
  /** Null only for a profile promoted to teacher before the trial trigger was fixed. */
  subscription: TeacherSubscription | null
  /** Current students only; a relationship that has ended does not count. */
  studentCount: number
}

export const SUBSCRIPTION_EVENT_TYPES = Constants.public.Enums.subscription_event_type
export type SubscriptionEventType = (typeof SUBSCRIPTION_EVENT_TYPES)[number]

export type SubscriptionEvent = {
  id: string
  type: SubscriptionEventType
  /** Null when the system did it, such as the trial opening at signup. */
  actor: { id: string; fullName: string | null; email: string } | null
  createdAt: string
  /** Whatever the action recorded: months added, the reason for a suspension. */
  payload: Record<string, unknown>
}

export type LinkedStudent = {
  id: string
  fullName: string | null
  email: string
  /** When this teacher started working with them. */
  since: string
}

/**
 * Everything the detail panel shows, including the dates the list has no room for.
 * studentCount is dropped rather than inherited: the detail carries students.total,
 * and two fields holding the same number is one of them waiting to be wrong.
 */
export type TeacherDetail = Omit<TeacherListItem, 'subscription' | 'studentCount'> & {
  subscription:
    | (TeacherSubscription & {
        trialEndsAt: string | null
        currentPeriodEnd: string | null
        startedAt: string
      })
    | null
  events: SubscriptionEvent[]
  students: {
    /** Every current student, even beyond the handful listed. */
    total: number
    items: LinkedStudent[]
  }
}

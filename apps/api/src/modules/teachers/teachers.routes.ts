import { Hono } from 'hono'
import type { AppEnv } from '../../http/context'
import {
  extendSubscription,
  listTeachers,
  reactivateSubscription,
  suspendSubscription,
} from './teachers.controller'

/**
 * Subscription changes are commands, not a PATCH of the status field. A client that can
 * set the status directly is a client that gets to invent state transitions; naming the
 * action keeps the rule about which transitions are legal on this side.
 */
export const teachersRoutes = new Hono<AppEnv>()
  .get('/', ...listTeachers)
  .post('/:teacherId/subscription/extend', ...extendSubscription)
  .post('/:teacherId/subscription/suspend', ...suspendSubscription)
  .post('/:teacherId/subscription/reactivate', ...reactivateSubscription)

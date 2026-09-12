import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { AppEnv } from '../../http/context'
import { rateLimit } from '../../middleware/rate-limit'
import {
  applyLiveOps,
  checkLiveStep,
  endLive,
  gatherLive,
  getLiveRoom,
  getLiveSnapshot,
  getPublicLiveRoom,
  joinableLive,
  myLive,
  recentLiveMaterials,
  setLiveStep,
  startLive,
  studentLiveInvitations,
  readLiveInvitations,
  respondToLiveInvitation,
} from './live.controller'

/** A batch of gestures — a few answers, a card turned — with room to spare. */
const OPS_BODY_BYTES = 64 * 1024
/** A whole step's answers, essays included. */
const CHECK_BODY_BYTES = 256 * 1024
/** Gestures per second one address may make in one room: a fast typist, not a loop. */
const OPS_PER_SECOND = 10

/**
 * Moving the room and closing it are commands, not PATCHes of a status column: what each
 * may change, and who may do it, is a rule that lives on the server. One unbroken chain,
 * for `AppType`; the fixed paths sit above `/:sessionId`, or "mine" would be read as an id.
 */
export const liveRoutes = new Hono<AppEnv>()
  .post('/', ...startLive)
  .get('/mine', ...myLive)
  .get('/recent-materials', ...recentLiveMaterials)
  .get('/joinable', ...joinableLive)
  .get('/invitations', ...studentLiveInvitations)
  .post('/invitations/read', ...readLiveInvitations)
  .post('/invitations/:sessionId/respond', ...respondToLiveInvitation)
  // No authentication on these: the link is the key. What they hand out is the lesson
  // while the room is open, where the room stands, and a way to change the shared board.
  // What they take in is capped and paced: a gesture is a few hundred bytes a few times a
  // second, and a room open to whoever holds the link must not be a way to fill the
  // database or to hold its row lock.
  .get('/public/:sessionId', ...getPublicLiveRoom)
  .get('/public/:sessionId/snapshot', ...getLiveSnapshot)
  .post(
    '/public/:sessionId/ops',
    bodyLimit({ maxSize: OPS_BODY_BYTES }),
    rateLimit({ perSecond: OPS_PER_SECOND, burst: OPS_PER_SECOND * 3 }),
    ...applyLiveOps,
  )
  .get('/:sessionId', ...getLiveRoom)
  .post('/:sessionId/step', ...setLiveStep)
  .post('/:sessionId/gather', ...gatherLive)
  // Marking locks the step for the whole room and reads the answer key: the host's alone.
  .post('/:sessionId/check', bodyLimit({ maxSize: CHECK_BODY_BYTES }), ...checkLiveStep)
  .post('/:sessionId/end', ...endLive)

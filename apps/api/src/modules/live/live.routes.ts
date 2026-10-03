import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { liveSessionIdParam } from '@tp/shared'
import type { AppEnv } from '../../http/context'
import { byParam, forwardedPeer, rateLimit } from '../../middleware/rate-limit'
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
  setLiveTimer,
  setLiveMedia,
  startLive,
  studentLiveInvitations,
  readLiveInvitations,
  respondToLiveInvitation,
} from './live.controller'

/** A batch of gestures — a few answers, a card turned — with room to spare. */
const OPS_BODY_BYTES = 64 * 1024
/** A whole step's answers, essays included. */
const CHECK_BODY_BYTES = 256 * 1024
/** Shared budgets are scoped to a room, so one busy class cannot slow every other class. */
const roomId = byParam('sessionId', liveSessionIdParam.shape.sessionId)
/**
 * Every guest's request reaches this API from the web server, so by address alone everybody
 * in every room would share one budget. Each participant has their own instead, and the
 * address keeps a ceiling that no name the web server forwards can multiply. Made-up rooms,
 * each a room of its own, are kept from the database by the list of open rooms, and by the
 * address's budget where a room missing from it is still looked up (see the controller).
 */
const publicTrafficByCaller = rateLimit({ perSecond: 1_000, burst: 2_000 })
const publicTrafficByPeer = rateLimit({ perSecond: 120, burst: 240, identify: forwardedPeer })
const publicRoomReads = rateLimit({ perSecond: 30, burst: 90, identify: roomId })
/** Gestures per second the whole room may make: a working class, not an unbounded loop. */
const OPS_PER_SECOND = 30
const publicRoomOps = rateLimit({
  perSecond: OPS_PER_SECOND,
  burst: OPS_PER_SECOND * 3,
  identify: roomId,
})
const TIMER_BODY_BYTES = 2 * 1024
const MEDIA_BODY_BYTES = 2 * 1024

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
  .get(
    '/public/:sessionId',
    publicTrafficByCaller,
    publicTrafficByPeer,
    publicRoomReads,
    ...getPublicLiveRoom,
  )
  .get(
    '/public/:sessionId/snapshot',
    publicTrafficByCaller,
    publicTrafficByPeer,
    publicRoomReads,
    ...getLiveSnapshot,
  )
  .post(
    '/public/:sessionId/ops',
    bodyLimit({ maxSize: OPS_BODY_BYTES }),
    publicTrafficByCaller,
    publicTrafficByPeer,
    publicRoomOps,
    ...applyLiveOps,
  )
  .get('/:sessionId', ...getLiveRoom)
  .post('/:sessionId/step', ...setLiveStep)
  .post('/:sessionId/gather', ...gatherLive)
  .post('/:sessionId/timer', bodyLimit({ maxSize: TIMER_BODY_BYTES }), ...setLiveTimer)
  .post('/:sessionId/media', bodyLimit({ maxSize: MEDIA_BODY_BYTES }), ...setLiveMedia)
  // Marking locks the step for the whole room and reads the answer key: the host's alone.
  .post('/:sessionId/check', bodyLimit({ maxSize: CHECK_BODY_BYTES }), ...checkLiveStep)
  .post('/:sessionId/end', ...endLive)

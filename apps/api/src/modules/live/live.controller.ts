import {
  applyLiveOpsBody,
  gatherLiveBody,
  liveCheckBody,
  liveSessionIdParam,
  setLiveStepBody,
  startLiveSessionBody,
  liveInvitationResponseBody,
  readLiveInvitationsBody,
  setLiveTimerBody,
  setLiveMediaBody,
} from '@tp/shared'
import { getAuth, type AppEnv } from '../../http/context'
import { NotFoundError } from '../../http/errors'
import { factory } from '../../http/factory'
import { validate } from '../../http/validate'
import { requireAuth } from '../../middleware/auth'
import { rateLimit } from '../../middleware/rate-limit'
import { requireRole } from '../../middleware/require-role'
import { accountsRepository } from '../accounts/accounts.repository'
import type { Viewer } from '../materials/materials.service'
import { liveService, nameOf } from './live.service'
import { openRooms } from './open-rooms'
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'

/**
 * Hosts open, move and close rooms; students find and enter them; everyone in one reads
 * it; whoever holds the link may stand in it without an account at all. The service
 * decides whose room it is — these only decide who may knock.
 */
const hosts = [requireAuth, requireRole('admin', 'teacher')] as const
const students = [requireAuth, requireRole('student')] as const
/** Timer commands are paced per authenticated host, including behind a shared web server. */
const timerCommands = rateLimit({
  perSecond: 4,
  burst: 8,
  identify: (c) => getAuth(c).userId,
})
const mediaCommands = rateLimit({
  perSecond: 6,
  burst: 12,
  identify: (c) => getAuth(c).userId,
})

const viewer = (c: Context<AppEnv>): Viewer => {
  const auth = getAuth(c)

  return { id: auth.userId, role: auth.role }
}

export const startLive = factory.createHandlers(
  ...hosts,
  validate('json', startLiveSessionBody),
  async (c) => {
    const data = await liveService.start(c.req.valid('json'), viewer(c))

    return c.json({ data }, 201)
  },
)

export const myLive = factory.createHandlers(...hosts, async (c) => {
  const data = await liveService.mine(viewer(c))

  c.header('Cache-Control', 'private, no-store')
  return c.json({ data })
})

export const recentLiveMaterials = factory.createHandlers(...hosts, async (c) => {
  const data = await liveService.recentMaterials(viewer(c))
  c.header('Cache-Control', 'private, no-store')
  return c.json({ data })
})

export const joinableLive = factory.createHandlers(...students, async (c) => {
  const data = await liveService.joinable(viewer(c))

  return c.json({ data })
})

export const studentLiveInvitations = factory.createHandlers(...students, async (c) => {
  const data = await liveService.studentInvitations(viewer(c))
  c.header('Cache-Control', 'private, no-store')
  return c.json({ data })
})

export const readLiveInvitations = factory.createHandlers(
  ...students,
  validate('json', readLiveInvitationsBody),
  async (c) => {
    await liveService.readInvitations(c.req.valid('json').sessionIds, viewer(c))
    return c.json({ data: { ok: true } })
  },
)

export const respondToLiveInvitation = factory.createHandlers(
  ...students,
  validate('param', liveSessionIdParam),
  validate('json', liveInvitationResponseBody),
  async (c) => {
    await liveService.respondToInvitation(
      c.req.valid('param').sessionId,
      c.req.valid('json').response,
      viewer(c),
    )
    return c.json({ data: { ok: true } })
  },
)

export const getLiveRoom = factory.createHandlers(
  requireAuth,
  validate('param', liveSessionIdParam),
  async (c) => {
    const auth = getAuth(c)
    // The name the others will see beside this person's pointer.
    const profile = await accountsRepository.findProfile(auth.userId)
    const data = await liveService.room(c.req.valid('param').sessionId, viewer(c), {
      name: nameOf(profile, auth.email),
    })

    return c.json({ data })
  },
)

/* ------------------------------------------------- for whoever holds the link --- */

/**
 * A made-up room is a room of its own, asked about under whatever name, so no budget in front
 * of these routes bounds what a stream of them costs: the list of open rooms does. Where only
 * an open room answers, a room missing from it is turned away without being looked up.
 */
const listedRoom = createMiddleware<AppEnv>(async (c, next) => {
  if (!(await openRooms.find(c.req.param('sessionId') ?? ''))) {
    throw new NotFoundError('No such live lesson')
  }

  await next()
})

/**
 * A snapshot answers for a room that has closed too, which is how the class learns that it
 * has, so any room missing from the list is looked up there: out of a budget kept by address,
 * which no name the web server forwards can multiply.
 */
const unlistedRoomLookups = rateLimit({ perSecond: 120, burst: 240 })
const listedRoomOrLookup = createMiddleware<AppEnv>(async (c, next) =>
  (await openRooms.find(c.req.param('sessionId') ?? '')) ? next() : unlistedRoomLookups(c, next),
)

export const getPublicLiveRoom = factory.createHandlers(
  validate('param', liveSessionIdParam),
  listedRoom,
  async (c) => {
    const data = await liveService.publicRoom(c.req.valid('param').sessionId)

    return c.json({ data })
  },
)

export const getLiveSnapshot = factory.createHandlers(
  validate('param', liveSessionIdParam),
  listedRoomOrLookup,
  async (c) => {
    const data = await liveService.snapshot(c.req.valid('param').sessionId)

    return c.json({ data })
  },
)

export const applyLiveOps = factory.createHandlers(
  validate('param', liveSessionIdParam),
  listedRoom,
  validate('json', applyLiveOpsBody),
  async (c) => {
    const data = await liveService.applyOps(c.req.valid('param').sessionId, c.req.valid('json'))

    return c.json({ data })
  },
)

export const checkLiveStep = factory.createHandlers(
  ...hosts,
  validate('param', liveSessionIdParam),
  validate('json', liveCheckBody),
  async (c) => {
    const data = await liveService.check(
      c.req.valid('param').sessionId,
      c.req.valid('json'),
      viewer(c),
    )

    return c.json({ data })
  },
)

export const setLiveStep = factory.createHandlers(
  ...hosts,
  validate('param', liveSessionIdParam),
  validate('json', setLiveStepBody),
  async (c) => {
    const data = await liveService.setStep(
      c.req.valid('param').sessionId,
      c.req.valid('json'),
      viewer(c),
    )

    return c.json({ data })
  },
)

export const gatherLive = factory.createHandlers(
  ...hosts,
  validate('param', liveSessionIdParam),
  validate('json', gatherLiveBody),
  async (c) => {
    const data = await liveService.gather(
      c.req.valid('param').sessionId,
      c.req.valid('json'),
      viewer(c),
    )

    return c.json({ data })
  },
)

export const setLiveTimer = factory.createHandlers(
  ...hosts,
  timerCommands,
  validate('param', liveSessionIdParam),
  validate('json', setLiveTimerBody),
  async (c) => {
    const data = await liveService.setTimer(
      c.req.valid('param').sessionId,
      c.req.valid('json'),
      viewer(c),
    )

    return c.json({ data })
  },
)

export const setLiveMedia = factory.createHandlers(
  ...hosts,
  mediaCommands,
  validate('param', liveSessionIdParam),
  validate('json', setLiveMediaBody),
  async (c) => {
    const data = await liveService.setMedia(
      c.req.valid('param').sessionId,
      c.req.valid('json'),
      viewer(c),
    )
    return c.json({ data })
  },
)

export const endLive = factory.createHandlers(
  ...hosts,
  validate('param', liveSessionIdParam),
  async (c) => {
    const data = await liveService.end(c.req.valid('param').sessionId, viewer(c))

    return c.json({ data })
  },
)

import { assetIdParam, createUploadBody, liveSessionIdParam, materialIdParam } from '@tp/shared'
import { getAuth, type AppEnv } from '../../http/context'
import { factory } from '../../http/factory'
import { validate } from '../../http/validate'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/require-role'
import type { Viewer } from '../materials/materials.service'
import { assetsService } from './assets.service'
import type { Context } from 'hono'

/**
 * Only an author uploads, but anyone who may sit through the lesson has to be able to fetch
 * what is in it — so the read route takes no role guard, the way the player's does not.
 */
const authors = [requireAuth, requireRole('admin', 'teacher')] as const

const viewer = (c: Context<AppEnv>): Viewer => {
  const auth = getAuth(c)

  return { id: auth.userId, role: auth.role }
}

export const createUpload = factory.createHandlers(
  ...authors,
  validate('json', createUploadBody),
  async (c) => {
    const data = await assetsService.createUpload(c.req.valid('json'), viewer(c))

    return c.json({ data }, 201)
  },
)

export const confirmUpload = factory.createHandlers(
  ...authors,
  validate('param', assetIdParam),
  async (c) => {
    const data = await assetsService.confirmUpload(c.req.valid('param').assetId, viewer(c))

    return c.json({ data })
  },
)

/** Where the file actually is, for the page that redirects a browser to it. */
export const getAssetUrl = factory.createHandlers(
  requireAuth,
  validate('param', assetIdParam),
  async (c) => {
    const data = await assetsService.urlFor(c.req.valid('param').assetId, viewer(c))

    return c.json({ data })
  },
)

/**
 * How long a participant's browser may keep a room's file. The copy is of bytes the room has
 * already shown that browser, so keeping it opens nothing new; ten minutes lets a class go
 * back to a step it has just left without everyone downloading it again, and lets the copy
 * go soon after the lesson. Private, so nothing between the browser and here keeps one.
 */
const LIVE_CACHE_SECONDS = 600

/** A public room's media never exposes a storage URL; the room must be open to get any. */
export const getLiveAsset = factory.createHandlers(
  validate('param', assetIdParam.merge(liveSessionIdParam)),
  async (c) => {
    const { assetId, sessionId } = c.req.valid('param')
    const signedUrl = await assetsService.urlForLive(assetId, sessionId)
    const range = c.req.header('range')
    const upstream = await fetch(signedUrl, {
      headers: range ? { range } : undefined,
      signal: c.req.raw.signal,
    })

    if (!upstream.ok && upstream.status !== 416) {
      return new Response(null, {
        status: upstream.status === 404 ? 404 : 502,
        headers: { 'cache-control': 'no-store' },
      })
    }

    const headers = new Headers({
      'cache-control': upstream.ok ? `private, max-age=${LIVE_CACHE_SECONDS}` : 'no-store',
    })
    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    return new Response(upstream.body, { status: upstream.status, headers })
  },
)

export const listAssets = factory.createHandlers(
  ...authors,
  validate('query', materialIdParam),
  async (c) => {
    const data = await assetsService.list(c.req.valid('query').materialId, viewer(c))

    return c.json({ data })
  },
)

export const deleteAsset = factory.createHandlers(
  ...authors,
  validate('param', assetIdParam),
  async (c) => {
    const { assetId } = c.req.valid('param')
    await assetsService.remove(assetId, viewer(c))

    return c.json({ data: { id: assetId } })
  },
)

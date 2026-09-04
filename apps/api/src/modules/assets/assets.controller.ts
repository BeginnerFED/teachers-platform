import { assetIdParam, createUploadBody, materialIdParam } from '@tp/shared'
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

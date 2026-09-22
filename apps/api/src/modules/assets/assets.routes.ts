import { Hono } from 'hono'
import type { Context } from 'hono'
import type { AppEnv } from '../../http/context'
import { rateLimit } from '../../middleware/rate-limit'
import {
  confirmUpload,
  createUpload,
  deleteAsset,
  getAssetUrl,
  getLiveAsset,
  listAssets,
} from './assets.controller'

/** Range requests are normal; one room's media traffic must not consume another's budget. */
const liveMediaByPeer = rateLimit({ perSecond: 100, burst: 200 })
const liveMediaReads = rateLimit({
  perSecond: 20,
  burst: 40,
  identify: (c: Context<AppEnv>) => c.req.param('sessionId') || 'invalid-room',
})

/**
 * Ordinary readers receive signed links to the private bucket. A public live room uses
 * this API as a streaming proxy so its media access ends when the room closes.
 *
 * One unbroken chain, for `AppType`.
 */
export const assetsRoutes = new Hono<AppEnv>()
  .get('/', ...listAssets)
  .post('/', ...createUpload)
  .get('/:assetId/url', ...getAssetUrl)
  .get('/:assetId/live/:sessionId', liveMediaByPeer, liveMediaReads, ...getLiveAsset)
  .post('/:assetId/confirm', ...confirmUpload)
  .delete('/:assetId', ...deleteAsset)

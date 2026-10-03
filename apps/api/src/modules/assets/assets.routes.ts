import { Hono } from 'hono'
import { liveSessionIdParam } from '@tp/shared'
import type { AppEnv } from '../../http/context'
import { byParam, forwardedPeer, rateLimit } from '../../middleware/rate-limit'
import {
  confirmUpload,
  createUpload,
  deleteAsset,
  getAssetUrl,
  getLiveAsset,
  listAssets,
} from './assets.controller'

/**
 * Every guest's request for a room's file reaches this API from the web server, so by
 * address alone everyone in every room would share one budget. Each participant has their
 * own instead, roomy enough for a whole class behind one school's address, and the address
 * itself keeps a ceiling that no name the web server forwards can multiply. A made-up room
 * costs no database lookup of its own, whichever budget it comes out of (see open-rooms).
 */
const liveMediaByCaller = rateLimit({ perSecond: 1_000, burst: 2_000 })
const liveMediaByPeer = rateLimit({ perSecond: 100, burst: 200, identify: forwardedPeer })
/**
 * One room's budget, so a busy class cannot slow another: about fifteen people arriving at a
 * step with a few pictures and a recording ask for a hundred files at once, range requests
 * included, and the next such step straight after asks for as many again. It refills more
 * slowly, because between steps a class asks for little, and the pace it refills at is what
 * anyone holding the room's link could go on drawing from storage.
 */
const liveMediaReads = rateLimit({
  perSecond: 30,
  burst: 240,
  identify: byParam('sessionId', liveSessionIdParam.shape.sessionId),
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
  .get(
    '/:assetId/live/:sessionId',
    liveMediaByCaller,
    liveMediaByPeer,
    liveMediaReads,
    ...getLiveAsset,
  )
  .post('/:assetId/confirm', ...confirmUpload)
  .delete('/:assetId', ...deleteAsset)

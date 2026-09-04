import { Hono } from 'hono'
import type { AppEnv } from '../../http/context'
import {
  confirmUpload,
  createUpload,
  deleteAsset,
  getAssetUrl,
  listAssets,
} from './assets.controller'

/**
 * The bytes never come through here. This mints a place to put them and, later, a brief
 * signed link to read them back — which is what keeps a lesson's media as private as the
 * lesson without ever putting a 20 MB recording through our own server.
 *
 * One unbroken chain, for `AppType`.
 */
export const assetsRoutes = new Hono<AppEnv>()
  .get('/', ...listAssets)
  .post('/', ...createUpload)
  .get('/:assetId/url', ...getAssetUrl)
  .post('/:assetId/confirm', ...confirmUpload)
  .delete('/:assetId', ...deleteAsset)

import { Hono } from 'hono'
import type { AppEnv } from '../../http/context'
import { getPublicSettings, getSettings, updateSettings } from './settings.controller'

/** Mounted at /v1/settings. Open, because the sign-in page is themed from it. */
export const settingsRoutes = new Hono<AppEnv>().get('/', ...getPublicSettings)

/** Mounted at /v1/admin/settings. */
export const adminSettingsRoutes = new Hono<AppEnv>()
  .get('/', ...getSettings)
  .patch('/', ...updateSettings)

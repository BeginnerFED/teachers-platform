import { Hono } from 'hono'
import type { AppEnv } from '../../http/context'
import { resetPassword, updateAccount } from './accounts.controller'

/**
 * A reset is a command rather than a PATCH of a password field: what it does — mint a
 * password, show it once, store it nowhere readable — is a rule the server keeps, and a
 * client that could write a password of its choosing would be a client that could write
 * a weak one. One unbroken chain, for `AppType`.
 */
export const accountsRoutes = new Hono<AppEnv>()
  .patch('/:accountId', ...updateAccount)
  .post('/:accountId/password', ...resetPassword)

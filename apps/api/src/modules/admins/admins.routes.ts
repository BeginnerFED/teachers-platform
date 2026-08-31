import { Hono } from 'hono'
import type { AppEnv } from '../../http/context'
import { inviteAdmin, listAdmins, revokeAdmin } from './admins.controller'

/**
 * Mounted at /v1/admin/admins. DELETE takes the role away rather than deleting the
 * account — the collection this route addresses is "who is an administrator", not
 * "who has an account".
 */
export const adminsRoutes = new Hono<AppEnv>()
  .get('/', ...listAdmins)
  .post('/', ...inviteAdmin)
  .delete('/:adminId', ...revokeAdmin)

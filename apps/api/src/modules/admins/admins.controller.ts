import { adminIdParam, inviteAdminBody } from '@tp/shared'
import { getAuth } from '../../http/context'
import { factory } from '../../http/factory'
import { validate } from '../../http/validate'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/require-role'
import { adminsService } from './admins.service'

const adminOnly = [requireAuth, requireRole('admin')] as const

export const listAdmins = factory.createHandlers(...adminOnly, async (c) => {
  const data = await adminsService.list(getAuth(c).userId)

  return c.json({ data })
})

export const inviteAdmin = factory.createHandlers(
  ...adminOnly,
  validate('json', inviteAdminBody),
  async (c) => {
    const { email, fullName } = c.req.valid('json')

    const data = await adminsService.invite({ email, fullName, actorId: getAuth(c).userId })

    return c.json({ data }, 201)
  },
)

export const revokeAdmin = factory.createHandlers(
  ...adminOnly,
  validate('param', adminIdParam),
  async (c) => {
    await adminsService.revoke({
      adminId: c.req.valid('param').adminId,
      actorId: getAuth(c).userId,
    })

    return c.json({ data: { id: c.req.valid('param').adminId } })
  },
)

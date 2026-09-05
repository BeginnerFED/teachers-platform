import { accountIdParam, updateAccountBody } from '@tp/shared'
import { getAuth } from '../../http/context'
import { factory } from '../../http/factory'
import { validate } from '../../http/validate'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/require-role'
import { accountsService } from './accounts.service'

/**
 * Whatever is true of every account regardless of role — its name, its address, its way
 * back in — lives here rather than three times over. Administrator only: these reach into
 * other people's accounts.
 */
const adminOnly = [requireAuth, requireRole('admin')] as const

export const updateAccount = factory.createHandlers(
  ...adminOnly,
  validate('param', accountIdParam),
  validate('json', updateAccountBody),
  async (c) => {
    const data = await accountsService.update(c.req.valid('param').accountId, c.req.valid('json'))

    return c.json({ data })
  },
)

export const resetPassword = factory.createHandlers(
  ...adminOnly,
  validate('param', accountIdParam),
  async (c) => {
    const data = await accountsService.resetPassword(
      c.req.valid('param').accountId,
      getAuth(c).userId,
    )

    return c.json({ data })
  },
)

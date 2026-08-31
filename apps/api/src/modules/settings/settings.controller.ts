import { updateSettingsBody } from '@tp/shared'
import { getAuth } from '../../http/context'
import { factory } from '../../http/factory'
import { validate } from '../../http/validate'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/require-role'
import { settingsService } from './settings.service'

const adminOnly = [requireAuth, requireRole('admin')] as const

/**
 * Deliberately unauthenticated. The login page is themed from these values, so they have
 * to be readable before there is a session to read them with. Nothing here is a secret:
 * a colour, a language, a trial length and a price are all things the product tells
 * people anyway. The admin-only view below is the one that adds who last changed them.
 */
export const getPublicSettings = factory.createHandlers(async (c) => {
  const data = await settingsService.getPublic()

  return c.json({ data })
})

export const getSettings = factory.createHandlers(...adminOnly, async (c) => {
  const data = await settingsService.getForAdmin()

  return c.json({ data })
})

export const updateSettings = factory.createHandlers(
  ...adminOnly,
  validate('json', updateSettingsBody),
  async (c) => {
    const data = await settingsService.update({
      body: c.req.valid('json'),
      actorId: getAuth(c).userId,
    })

    return c.json({ data })
  },
)

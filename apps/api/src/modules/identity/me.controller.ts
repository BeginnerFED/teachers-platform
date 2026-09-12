import { updateMeBody } from '@tp/shared'
import { getAuth } from '../../http/context'
import { factory } from '../../http/factory'
import { validate } from '../../http/validate'
import { requireAuth } from '../../middleware/auth'
import { identityService } from './identity.service'
import { teachingAccess } from '../subscriptions/teaching-access'

/**
 * The smallest possible proof that the whole chain works: token verified, profile loaded,
 * caller identified. If this returns the right person, everything downstream can rely on
 * `getAuth(c)`.
 */
export const getMe = factory.createHandlers(requireAuth, async (c) => {
  const auth = getAuth(c)

  return c.json({
    data: {
      id: auth.userId,
      email: auth.email,
      role: auth.role,
      subscription: auth.role === 'teacher' ? await teachingAccess(auth.userId) : null,
    },
  })
})

/**
 * Anyone may edit their own name and language — this is not an admin route. Email is not
 * accepted: changing it needs a confirmation link with somewhere to land, and accepting
 * the field before that exists would mean saving a change that never takes effect.
 */
export const updateMe = factory.createHandlers(
  requireAuth,
  validate('json', updateMeBody),
  async (c) => {
    const data = await identityService.updateMe({
      userId: getAuth(c).userId,
      body: c.req.valid('json'),
    })

    return c.json({ data })
  },
)

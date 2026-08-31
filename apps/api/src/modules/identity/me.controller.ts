import { getAuth } from '../../http/context'
import { factory } from '../../http/factory'
import { requireAuth } from '../../middleware/auth'

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
    },
  })
})

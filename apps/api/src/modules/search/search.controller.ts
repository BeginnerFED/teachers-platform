import { searchQuery } from '@tp/shared'
import { getAuth } from '../../http/context'
import { factory } from '../../http/factory'
import { validate } from '../../http/validate'
import { requireAuth } from '../../middleware/auth'
import { searchService } from './search.service'

export const search = factory.createHandlers(
  requireAuth,
  validate('query', searchQuery),
  async (c) => {
    const { userId, role } = getAuth(c)
    const data = await searchService.find(c.req.valid('query'), { id: userId, role })
    c.header('Cache-Control', 'private, no-store')
    return c.json({ data })
  },
)

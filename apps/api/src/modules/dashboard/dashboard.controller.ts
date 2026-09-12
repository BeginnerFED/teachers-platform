import { getAuth } from '../../http/context'
import { factory } from '../../http/factory'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/require-role'
import { dashboardService } from './dashboard.service'
import { dashboardActivityService } from './dashboard-activity.service'

export const getDashboard = factory.createHandlers(requireAuth, requireRole('admin'), async (c) => {
  const { userId, role } = getAuth(c)
  const data = await dashboardService.overview({ id: userId, role })
  c.header('Cache-Control', 'private, no-store')
  return c.json({ data })
})

export const getDashboardActivity = factory.createHandlers(
  requireAuth,
  requireRole('admin'),
  async (c) => {
    const data = await dashboardActivityService.list()
    c.header('Cache-Control', 'private, no-store')
    return c.json({ data })
  },
)

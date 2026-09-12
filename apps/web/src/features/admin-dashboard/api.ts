import 'server-only'
import { unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

export async function getAdminDashboard() {
  const api = await getApi()
  return unwrap(await api.v1.admin.dashboard.$get({}, { init: { cache: 'no-store' } }))
}

export async function getAdminDashboardActivity() {
  const api = await getApi()
  return unwrap(await api.v1.admin.dashboard.activity.$get({}, { init: { cache: 'no-store' } }))
}

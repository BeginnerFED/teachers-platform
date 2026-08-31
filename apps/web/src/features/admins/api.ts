import 'server-only'
import type { AdminListItem } from '@tp/shared'
import { unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

export async function listAdmins(): Promise<AdminListItem[]> {
  const api = await getApi()

  return unwrap(await api.v1.admin.admins.$get())
}

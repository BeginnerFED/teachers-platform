import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getApi } from '@/lib/api/server'
import { unwrap } from '@/lib/api/errors'
import { getViewer } from '@/lib/auth'

export const getTeachingAccess = cache(async () => {
  const viewer = await getViewer()
  if (viewer?.role !== 'teacher') return true
  const api = await getApi()
  const me = await unwrap(await api.v1.me.$get())
  return me.subscription?.hasAccess ?? false
})

export async function requireTeachingAccess() {
  if (!(await getTeachingAccess())) redirect('/dashboard/access')
}

import 'server-only'
import type { NotificationPreferences, StudyUpdate } from '@tp/shared'
import { getApi } from '@/lib/api/server'
import { unwrap } from '@/lib/api/errors'

export async function accountNotifications(): Promise<StudyUpdate[]> {
  const api = await getApi()
  return unwrap(await api.v1.me.notifications.$get({}, { init: { cache: 'no-store' } }))
}

export async function notificationPreferences(): Promise<NotificationPreferences> {
  const api = await getApi()
  return unwrap(await api.v1.me.notifications.preferences.$get({}, { init: { cache: 'no-store' } }))
}

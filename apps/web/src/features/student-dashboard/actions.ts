'use server'

import { readStudyUpdatesBody } from '@tp/shared'
import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

export async function readStudyUpdates(items: { id: string; updatedAt: string }[]) {
  const parsed = readStudyUpdatesBody.safeParse({ items })
  if (!parsed.success) return { error: 'validation_failed' }
  try {
    const api = await getApi()
    await unwrap(await api.v1.me.notifications.read.$post({ json: parsed.data }))
    return { error: null }
  } catch (error) {
    return { error: error instanceof ApiError ? error.code : 'internal' }
  }
}

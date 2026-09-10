'use server'

import { startConversationBody, type ErrorCode } from '@tp/shared'
import { revalidatePath } from 'next/cache'
import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

export async function openSearchContact(
  recipientId: string,
): Promise<{ href: string; error?: never } | { href?: never; error: ErrorCode }> {
  const parsed = startConversationBody.safeParse({ recipientId })
  if (!parsed.success) return { error: 'validation_failed' }
  try {
    const api = await getApi()
    const { id } = await unwrap(await api.v1.conversations.$post({ json: parsed.data }))
    revalidatePath('/inbox', 'layout')
    return { href: `/inbox/${id}` }
  } catch (error) {
    return { error: error instanceof ApiError ? error.code : 'internal' }
  }
}

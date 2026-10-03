'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  conversationIdParam,
  sendMessageBody,
  startConversationBody,
  type Correspondent,
} from '@tp/shared'
import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'
import type { SendState, StartState } from './action-state'

/**
 * Fetched when the picker is opened rather than with every render of the inbox. It is a
 * round trip that most visits never need, and it was being paid on every navigation
 * between conversations.
 */
export async function loadRecipients(): Promise<Correspondent[]> {
  const api = await getApi()

  return unwrap(await api.v1.conversations.recipients.$get())
}

export async function sendMessage(_previous: SendState, formData: FormData): Promise<SendState> {
  const params = conversationIdParam.safeParse({
    conversationId: formData.get('conversationId'),
  })
  const body = sendMessageBody.safeParse({ body: formData.get('body') })

  if (!params.success || !body.success) return { error: 'validation_failed', sent: false }

  try {
    const api = await getApi()
    await unwrap(
      await api.v1.conversations[':conversationId'].messages.$post({
        param: { conversationId: params.data.conversationId },
        json: body.data,
      }),
    )

    // The thread and the list beside it both change: a new line at the bottom, and this
    // conversation moving to the top with a fresh preview.
    revalidatePath('/inbox', 'layout')

    return { error: null, sent: true }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code, sent: false }

    throw error
  }
}

/**
 * Opening a conversation is idempotent on the API side, so this lands on the existing
 * thread when there is one rather than making a second.
 *
 * A refusal comes back as a code rather than as a throw. The picker calls this from inside
 * a transition, and a throw from there passes every boundary in the inbox and takes the
 * whole page down with it.
 */
export async function openConversation(formData: FormData): Promise<StartState> {
  const parsed = startConversationBody.safeParse({ recipientId: formData.get('recipientId') })
  if (!parsed.success) return { error: 'validation_failed' }

  let conversation: { id: string }

  try {
    const api = await getApi()
    conversation = await unwrap(await api.v1.conversations.$post({ json: parsed.data }))
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code }

    throw error
  }

  // Outside the try: redirect works by throwing, and catching that would cancel it.
  revalidatePath('/inbox', 'layout')
  redirect(`/inbox/${conversation.id}`)
}

/** Called when a thread is opened, so the badge stops counting what has been seen. */
export async function markRead(conversationId: string): Promise<void> {
  const parsed = conversationIdParam.safeParse({ conversationId })
  if (!parsed.success) return

  try {
    const api = await getApi()
    await unwrap(
      await api.v1.conversations[':conversationId'].read.$post({
        param: { conversationId: parsed.data.conversationId },
      }),
    )

    revalidatePath('/inbox', 'layout')
  } catch (error) {
    // Failing to mark something read is not worth breaking the page somebody is reading.
    if (!(error instanceof ApiError)) throw error
  }
}

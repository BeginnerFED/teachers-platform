import 'server-only'
import type { ConversationSummary, Correspondent, InboxActivity, Thread } from '@tp/shared'
import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

/** The only place the web app asks the API about conversations. */
export async function listConversations(): Promise<ConversationSummary[]> {
  const api = await getApi()

  return unwrap(await api.v1.conversations.$get())
}

export async function listRecipients(): Promise<Correspondent[]> {
  const api = await getApi()

  return unwrap(await api.v1.conversations.recipients.$get())
}

/**
 * Read by the shell on every page, so a failure here must not take the page with it: a
 * badge nobody can see is a smaller problem than a screen nobody can.
 */
export async function unreadTotal(): Promise<number> {
  try {
    const api = await getApi()
    const { unread } = await unwrap(await api.v1.conversations.unread.$get())

    return unread
  } catch (error) {
    if (error instanceof ApiError) return 0

    throw error
  }
}

/**
 * Null rather than a thrown error when it is not yours or not there: the API answers both
 * with a 404 on purpose, and a page reached by a stale link should say so quietly rather
 * than break. A link that is not a conversation id at all, say one cut short when it was
 * pasted, gets a 422 instead and is the same dead end.
 */
export async function getThread(conversationId: string): Promise<Thread | null> {
  const api = await getApi()

  try {
    return await unwrap(
      await api.v1.conversations[':conversationId'].$get({ param: { conversationId } }),
    )
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 422)) return null

    throw error
  }
}

/** Asked every few seconds by an open inbox, so never from a cache: that is the point. */
export async function getActivity(signal?: AbortSignal): Promise<InboxActivity> {
  const api = await getApi()

  return unwrap(
    await api.v1.conversations.activity.$get({}, { init: { signal, cache: 'no-store' } }),
  )
}

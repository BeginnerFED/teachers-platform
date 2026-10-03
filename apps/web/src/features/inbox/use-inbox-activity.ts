'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import type { ConversationSummary, InboxActivity } from '@tp/shared'

/** How often an open inbox that somebody can see asks whether anything in it moved. */
const EVERY_MS = 10_000

/**
 * The two things a poll compares, written out so that the list on screen and the server's
 * answer come out identical when nothing has happened. Times as instants, not as text.
 */
function keyOf({ unread, lastMessageAt }: InboxActivity): string {
  return `${unread}:${lastMessageAt ? Date.parse(lastMessageAt) : ''}`
}

/** The same two things, read off the list the page was rendered with. */
function activityOf(conversations: ConversationSummary[]): InboxActivity {
  let lastMessageAt: string | null = null

  for (const conversation of conversations) {
    const at = conversation.lastMessage?.createdAt ?? null

    if (at && (!lastMessageAt || Date.parse(at) > Date.parse(lastMessageAt))) lastMessageAt = at
  }

  return {
    unread: conversations.reduce((total, conversation) => total + conversation.unread, 0),
    lastMessageAt,
  }
}

/**
 * Keeps an open inbox current. Nothing pushes messages to the browser, so while the inbox
 * is on screen this asks every few seconds for the two numbers that move whenever anything
 * in it does, and fetches the page again only when they have — which brings the new line
 * into the open thread and the list beside it together.
 */
export function useInboxActivity(conversations: ConversationSummary[]) {
  const router = useRouter()
  const shown = keyOf(activityOf(conversations))

  /**
   * The newest state this page knows the server to be in: the list it was rendered with,
   * or a later answer from a poll. Comparing against this rather than against the list
   * alone asks for one refresh per change, even when the count includes something the list
   * leaves out; and a message sent from this tab, whose action already brought the new
   * list with it, is not fetched a second time.
   */
  const known = useRef(shown)

  useEffect(() => {
    known.current = shown
  }, [shown])

  useEffect(() => {
    let request: AbortController | null = null

    async function check() {
      if (document.visibilityState !== 'visible' || request) return

      const controller = new AbortController()
      request = controller

      try {
        const response = await fetch('/inbox/activity', {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(EVERY_MS)]),
        })
        if (!response.ok) return

        const { data } = (await response.json()) as { data: InboxActivity }
        const latest = keyOf(data)

        if (latest !== known.current) {
          known.current = latest
          router.refresh()
        }
      } catch {
        // Offline, or a slow answer cut short. The next beat asks again.
      } finally {
        if (request === controller) request = null
      }
    }

    // Not straight away: the page was rendered a moment ago, and opening a thread marks it
    // read, which renders it again anyway. A check racing that would fetch it a third time.
    const timer = setInterval(check, EVERY_MS)
    window.addEventListener('focus', check)
    window.addEventListener('online', check)
    document.addEventListener('visibilitychange', check)

    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', check)
      window.removeEventListener('online', check)
      document.removeEventListener('visibilitychange', check)
      request?.abort()
    }
  }, [router])
}

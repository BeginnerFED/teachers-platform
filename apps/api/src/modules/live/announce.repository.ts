import { env } from '../../env'
import { logger } from '../../lib/logger'

export type BroadcastMessage = {
  topic: string
  event: string
  payload: unknown
}

/** A slow Realtime must never hold a request hostage: the write has already landed. */
const TIMEOUT_MS = 3_000

/**
 * Tells everyone on a channel that something happened — from the server, over Realtime's
 * REST door, with the service key. This is how the API remains the only voice on a room's
 * state: a browser hears about a change from here, never from another browser.
 *
 * Fire-and-forget by design. A change that landed in the database is a change; if the
 * announcement fails, every browser in the room re-reads the board on its own within
 * seconds, so the loss is a moment of staleness rather than a wrong screen.
 */
export async function broadcast(messages: BroadcastMessage[]): Promise<void> {
  if (messages.length === 0) return

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${env.SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages.map((message) => ({ ...message, private: false })),
      }),
    })

    if (!response.ok) {
      logger.warn(
        { status: response.status, topics: messages.map((m) => m.topic) },
        'broadcast refused',
      )
    }
  } catch (error) {
    logger.warn({ err: error, topics: messages.map((m) => m.topic) }, 'broadcast failed')
  } finally {
    clearTimeout(timer)
  }
}

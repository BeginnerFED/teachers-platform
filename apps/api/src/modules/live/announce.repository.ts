import { env } from '../../env'
import { logger } from '../../lib/logger'

export type BroadcastMessage = {
  topic: string
  event: string
  payload: unknown
}

/** A slow Realtime must never hold a request hostage: the write has already landed. */
const ATTEMPTS = 2
const ATTEMPT_TIMEOUT_MS = 1_500

/**
 * Tells everyone on a channel that something happened — from the server, over Realtime's
 * REST door, with the service key. Browsers treat this message as an invalidation signal
 * and fetch the authoritative state; the public room cannot prove a broadcast's sender.
 *
 * Most callers fire-and-forget; classroom commands may await this bounded delivery
 * attempt. A change that landed in the database is still the truth if announcement
 * fails, and every browser periodically re-reads the board.
 */
export async function broadcast(messages: BroadcastMessage[]): Promise<void> {
  if (messages.length === 0) return

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS)

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

      if (response.ok) return
      logger.warn(
        { attempt, status: response.status, topics: messages.map((m) => m.topic) },
        'broadcast refused',
      )
      // A client error is stable; retrying it only delays the request.
      if (response.status < 500 && response.status !== 429) return
    } catch (error) {
      logger.warn({ attempt, err: error, topics: messages.map((m) => m.topic) }, 'broadcast failed')
    } finally {
      clearTimeout(timer)
    }
  }
}

import { getConnInfo } from '@hono/node-server/conninfo'
import { createMiddleware } from 'hono/factory'
import type { Context } from 'hono'
import type { AppEnv } from '../http/context'
import { TooManyRequestsError } from '../http/errors'

type Bucket = { tokens: number; at: number }

/** Buckets nobody has touched for this long are forgotten. */
const IDLE_MS = 60_000
/** How often the forgotten are swept, in requests. */
const SWEEP_EVERY = 500

/**
 * A token bucket per caller and route, in memory: enough to keep a loop from holding a
 * database row hostage, and no more. One process, one map — a second instance keeps its
 * own count, which is fine for what this guards against and wrong for anything that
 * needs an exact number.
 *
 * The caller is normally the address the request came from. A route may instead supply a
 * trusted identity after authentication, which avoids grouping users behind one proxy.
 */
export function rateLimit({
  perSecond,
  burst,
  identify,
}: {
  perSecond: number
  burst: number
  /** Optional trusted identity, used only after authentication middleware has run. */
  identify?: (context: Context<AppEnv>) => string
}) {
  const buckets = new Map<string, Bucket>()
  let served = 0

  return createMiddleware<AppEnv>(async (c, next) => {
    const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    const address = forwarded || getConnInfo(c).remote.address || 'unknown'
    const caller = identify?.(c) ?? address
    const key = `${caller} ${c.req.routePath}`
    const now = Date.now()

    const bucket = buckets.get(key) ?? { tokens: burst, at: now }
    // Tokens come back at a steady rate, up to the burst.
    bucket.tokens = Math.min(burst, bucket.tokens + ((now - bucket.at) / 1000) * perSecond)
    bucket.at = now

    if (bucket.tokens < 1) {
      buckets.set(key, bucket)
      throw new TooManyRequestsError()
    }

    bucket.tokens -= 1
    buckets.set(key, bucket)

    if (++served % SWEEP_EVERY === 0) {
      for (const [id, entry] of buckets) {
        if (now - entry.at > IDLE_MS) buckets.delete(id)
      }
    }

    await next()
  })
}

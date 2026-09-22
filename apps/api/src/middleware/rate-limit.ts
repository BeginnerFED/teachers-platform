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
 * stable bucket identity: usually an authenticated user, or a public resource id when all
 * visitors to that resource should share one protective budget.
 */
export function rateLimit({
  perSecond,
  burst,
  identify,
}: {
  perSecond: number
  burst: number
  /** Optional stable bucket identity; never use an unverified forwarding header here. */
  identify?: (context: Context<AppEnv>) => string
}) {
  const buckets = new Map<string, Bucket>()
  let served = 0

  return createMiddleware<AppEnv>(async (c, next) => {
    // Forwarding headers are controlled by the caller unless the server has an explicit,
    // verified trust boundary with its ingress. Hosting has not established one, so using
    // X-Forwarded-For here would let a public caller rotate that header and receive a new
    // bucket on every request. The socket peer is the only address this process knows to
    // be genuine; behind a future reverse proxy it deliberately fails closed by grouping
    // callers under that proxy until a provider-specific trust policy is configured.
    const address = getConnInfo(c).remote.address || 'unknown'
    const caller = identify?.(c) ?? address
    const key = `${caller} ${c.req.routePath}`
    const now = Date.now()

    const bucket = buckets.get(key) ?? { tokens: burst, at: now }
    // Tokens come back at a steady rate, up to the burst.
    bucket.tokens = Math.min(burst, bucket.tokens + ((now - bucket.at) / 1000) * perSecond)
    bucket.at = now

    if (bucket.tokens < 1) {
      buckets.set(key, bucket)
      const retryAfterSeconds = Math.max(1, Math.ceil((1 - bucket.tokens) / perSecond))
      c.header('Retry-After', String(retryAfterSeconds))
      throw new TooManyRequestsError('Too many requests', {
        scope: 'request',
        reason: 'rate_limit',
        retryAfterSeconds,
      })
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

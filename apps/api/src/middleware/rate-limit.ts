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

function getCallerAddress(context: Context<AppEnv>): string {
  // Vercel overwrites these headers at its ingress, so they cannot be rotated by a
  // caller. The Hono Node adapter's socket metadata is not available inside a Vercel
  // Function, while it remains the trustworthy source for the standalone local server.
  if (process.env.VERCEL === '1') {
    return (
      context.req.header('x-vercel-forwarded-for') ??
      context.req.header('x-forwarded-for') ??
      'unknown'
    )
  }

  try {
    return getConnInfo(context).remote.address || 'unknown'
  } catch {
    // A future Fetch-based host without a documented trusted IP header fails closed:
    // callers share one bucket instead of gaining arbitrary identities.
    return 'unknown'
  }
}

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
    const address = getCallerAddress(c)
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

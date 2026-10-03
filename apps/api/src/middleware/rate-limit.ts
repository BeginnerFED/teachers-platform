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
 * Where the web server names the browser it is passing a request on for. A page's requests
 * that go through the web server all reach this API from that one server's address, so by
 * address alone every guest of every live room is the same caller.
 */
export const PEER_HEADER = 'x-tp-peer'
/** Longer than any address written out; anything past it only makes a key bigger. */
const PEER_MAX_LENGTH = 64

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
 * A caller told apart by the browser it says it is passing the request on for. Anyone can
 * send that header, so it decides nothing but which of the caller's own buckets a request
 * lands in: the caller's address stays in the key, and a name somebody made up only ever
 * opens a new bucket of their own, never reaches into another caller's. A route keyed this
 * way therefore still needs a budget the header cannot multiply in front of anything that
 * costs; it must never be what grants access.
 */
export function forwardedPeer(context: Context<AppEnv>): string {
  const address = getCallerAddress(context)
  const peer = context.req.header(PEER_HEADER)?.trim().slice(0, PEER_MAX_LENGTH)

  return peer ? `${address} ${peer}` : address
}

/**
 * A budget per value of a route parameter, for something everybody asking about it shares,
 * such as one room. Only a value the route would accept is a bucket of its own: limiters run
 * before a route checks its parameters, a bucket stays in memory for a minute after its last
 * use, and a made-up value may be as long as a URL. Every other value shares one bucket.
 */
export function byParam(
  name: string,
  accepts: { safeParse(value: unknown): { success: boolean } },
): (context: Context<AppEnv>) => string {
  return (context) => {
    const value = context.req.param(name)

    // Every caller passes a uuid schema, and a uuid matches in any case: lower-casing keeps
    // the case variants of one id in one bucket instead of a fresh one each.
    return value !== undefined && accepts.safeParse(value).success
      ? value.toLowerCase()
      : `invalid ${name}`
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
  /**
   * Optional stable bucket identity; never an unverified forwarding header on its own (see
   * `forwardedPeer`, which keeps the caller's address in the key).
   */
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

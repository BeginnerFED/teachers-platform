import 'server-only'
import { hc } from 'hono/client'
import { headers } from 'next/headers'
import { cache } from 'react'
import type { AppType } from '@tp/api/app'
import { getAccessToken } from '@/lib/supabase/token'

// Server-only on purpose: the browser never calls the API directly under this design, so
// inlining the address into the client bundle would leak it for nothing. hc is fussy
// about a trailing slash, hence the trim.
const API_URL = (process.env.API_URL ?? 'http://localhost:3001').replace(/\/+$/, '')

/**
 * The typed client. Paths and response shapes come from the API's own route types, so a
 * renamed endpoint fails this build rather than failing in production.
 *
 * cache() keeps one client — and one token read — per request.
 */
export const getApi = cache(async () => {
  const token = await getAccessToken()

  return hc<AppType>(API_URL, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
})

/**
 * The same client with nobody attached to it, for the handful of endpoints that answer
 * the same thing for everyone.
 *
 * Kept separate rather than reusing getApi() with the header dropped: a response cached
 * under a request that carried somebody's token is a response that can be handed to
 * somebody else, and the way to never have that argument is to never send the token.
 */
export const getPublicApi = cache(() => hc<AppType>(API_URL))

/** Where the API's rate limits read the browser a request is passed on for. */
const PEER_HEADER = 'x-tp-peer'

/**
 * Who a public request passed on to the API is really from, for the API's per-person
 * budgets: without it, every guest of every live room is this one server. It only ever
 * splits this server's own budget there, so it lets nobody into anything.
 *
 * On Vercel the address is the one its edge wrote, which a caller cannot choose. Elsewhere
 * Next fills `x-forwarded-for` in from the connection when the request did not bring one,
 * and a proxy in front of it appends; the last entry is the hop nearest to us either way.
 */
export function peerHeaders(incoming: Pick<Headers, 'get'>): Record<string, string> {
  const forwarded = incoming.get('x-vercel-forwarded-for') ?? incoming.get('x-forwarded-for')
  const address = forwarded?.split(',').at(-1)?.trim()

  return address ? { [PEER_HEADER]: address } : {}
}

/** The same, for a page or a server action, whose request is read through next/headers. */
export async function requestPeerHeaders(): Promise<Record<string, string>> {
  return peerHeaders(await headers())
}

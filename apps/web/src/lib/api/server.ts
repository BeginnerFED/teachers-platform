import 'server-only'
import { hc } from 'hono/client'
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
